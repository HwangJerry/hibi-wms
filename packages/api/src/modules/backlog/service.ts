import { badRequest, notFound, writeAuditLog } from "@hibi/core";
import type { AuditLogTransaction } from "@hibi/core";
import { EntityType, Priority } from "@hibi/db";
import type { Prisma, PrismaClient, Task, TaskStatus } from "@hibi/db";
import {
  createNotification,
  NOTIFICATION_TYPES,
} from "../notifications/service.js";

const INITIAL_ORDER = 1024;
const MIN_ORDER_GAP = 0.000001;
const MENTION_PATTERN = /@([a-z0-9._-]+)/gi;

type TaskDelegate = {
  findMany(args: Prisma.TaskFindManyArgs): Promise<Task[]>;
  findFirst(args: Prisma.TaskFindFirstArgs): Promise<Task | null>;
  count(args: Prisma.TaskCountArgs): Promise<number>;
  create(args: { data: Prisma.TaskUncheckedCreateInput }): Promise<Task>;
  update(args: {
    where: Prisma.TaskWhereUniqueInput;
    data: Prisma.TaskUncheckedUpdateInput;
  }): Promise<Task>;
};

type UserRecord = {
  id: string;
  name: string;
  email: string;
};

type UserDelegate = {
  findMany(args: {
    where?: {
      id?: {
        in: string[];
      };
    };
    select: {
      id: true;
      name: true;
      email: true;
    };
  }): Promise<Array<UserRecord>>;
};

type BacklogTransaction = {
  task: TaskDelegate;
  user?: UserDelegate;
  notification?: {
    create(args: { data: Prisma.NotificationCreateInput }): Promise<Prisma.NotificationGetPayload<object>>;
  };
} & AuditLogTransaction;

type TaskReader = {
  task: Pick<TaskDelegate, "findFirst">;
};

export type BacklogServiceDb = {
  $transaction<T>(fn: (tx: BacklogTransaction) => Promise<T>): Promise<T>;
  task: TaskDelegate;
  user?: UserDelegate;
};

export type ListTasksInput = {
  status?: TaskStatus;
  assigneeId?: string | null;
  parentId?: string | null;
  cursor?: string;
  limit: number;
};

export type GetTaskInput = {
  id: string;
};

export type CreateTaskInput = {
  actorId: string;
  title: string;
  description?: string | null;
  priority?: Priority;
  assigneeId?: string | null;
  parentId?: string | null;
};

export type UpdateTaskInput = {
  actorId: string;
  id: string;
  patch: {
    title?: string;
    description?: string | null;
    priority?: Priority;
    assigneeId?: string | null;
    parentId?: string | null;
  };
};

export type SetTaskStatusInput = {
  id: string;
  status: TaskStatus;
};

export type SoftDeleteTaskInput = {
  actorId: string;
  id: string;
};

export type ReorderTaskInput = {
  id: string;
  beforeId?: string;
  afterId?: string;
};

type OrderNeighbour = Pick<Task, "id" | "parentId" | "order">;

export class BacklogService {
  constructor(private readonly db: BacklogServiceDb) {}

  async list(input: ListTasksInput) {
    const take = input.limit + 1;
    const tasks = await this.db.task.findMany({
      where: {
        status: input.status,
        assigneeId: input.assigneeId,
        parentId: input.parentId,
        deletedAt: null,
      },
      orderBy: [{ order: "asc" }, { id: "asc" }],
      cursor: input.cursor ? { id: input.cursor } : undefined,
      skip: input.cursor ? 1 : undefined,
      take,
    });
    const items = tasks.slice(0, input.limit);
    const assigneeIds = [
      ...new Set(items.map((task) => task.assigneeId).filter((id) => id !== null)),
    ];
    const assignees =
      this.db.user && assigneeIds.length > 0
        ? await this.db.user.findMany({
            where: {
              id: {
                in: assigneeIds,
              },
            },
            select: {
              id: true,
              name: true,
              email: true,
            },
          })
        : [];
    const assigneeNameById = new Map(
      assignees.map((assignee) => [assignee.id, assignee.name]),
    );
    const nextCursor = tasks.length > input.limit ? items.at(-1)?.id : undefined;

    return {
      items: items.map((task) => ({
        ...task,
        assigneeName: task.assigneeId ? assigneeNameById.get(task.assigneeId) ?? null : null,
      })),
      nextCursor,
    };
  }

  async countActive() {
    return await this.db.task.count({
      where: {
        deletedAt: null,
      },
    });
  }

  async get(input: GetTaskInput) {
    return await getActiveTaskOrThrow(this.db, input.id);
  }

  async create(input: CreateTaskInput) {
    return await this.db.$transaction(async (tx) => {
      const parentId = input.parentId ?? null;
      await ensureParentExists(tx, parentId);
      const order = await getNextOrder(tx, parentId);
      const task = await tx.task.create({
        data: {
          title: input.title,
          description: input.description,
          priority: input.priority ?? Priority.MEDIUM,
          assigneeId: input.assigneeId,
          parentId,
          order,
        },
      });

      await writeAuditLog(tx, {
        actorId: input.actorId,
        action: "task.created",
        entityType: EntityType.TASK,
        entityId: task.id,
        data: {
          title: task.title,
          parentId: task.parentId,
          priority: task.priority,
        },
      });

      await createMentionAndAssignmentNotifications(tx, {
        actorId: input.actorId,
        task,
        previousAssigneeId: null,
      });

      return task;
    });
  }

  async update(input: UpdateTaskInput) {
    return await this.db.$transaction(async (tx) => {
      const before = await getActiveTaskOrThrow(tx, input.id);
      await ensureParentPatchIsValid(tx, input.id, input.patch.parentId);

      const updated = await tx.task.update({
        where: { id: input.id },
        data: input.patch,
      });

      await createMentionAndAssignmentNotifications(tx, {
        actorId: input.actorId,
        task: updated,
        previousAssigneeId: before.assigneeId,
        previousDescription: before.description,
        previousTitle: before.title,
      });

      return updated;
    });
  }

  async setStatus(input: SetTaskStatusInput) {
    return await this.db.$transaction(async (tx) => {
      await getActiveTaskOrThrow(tx, input.id);

      return await tx.task.update({
        where: { id: input.id },
        data: { status: input.status },
      });
    });
  }

  async softDelete(input: SoftDeleteTaskInput) {
    return await this.db.$transaction(async (tx) => {
      const existingTask = await getActiveTaskOrThrow(tx, input.id);
      const deletedAt = new Date();
      const task = await tx.task.update({
        where: { id: input.id },
        data: { deletedAt },
      });

      await writeAuditLog(tx, {
        actorId: input.actorId,
        action: "task.deleted",
        entityType: EntityType.TASK,
        entityId: task.id,
        data: {
          title: existingTask.title,
          deletedAt: deletedAt.toISOString(),
        },
      });

      return task;
    });
  }

  async reorder(input: ReorderTaskInput) {
    if (input.beforeId === input.id || input.afterId === input.id) {
      throw badRequest("A task cannot be reordered relative to itself.");
    }

    return await this.db.$transaction(async (tx) => {
      const task = await getActiveTaskOrThrow(tx, input.id);
      const before = await getNeighbour(tx, input.beforeId);
      const after = await getNeighbour(tx, input.afterId);
      const parentId = getReorderParentId(task, before, after);
      await ensureReorderParentIsValid(tx, task.id, parentId);
      const order = await getReorderOrder(tx, {
        taskId: task.id,
        parentId,
        before,
        after,
      });

      return await tx.task.update({
        where: { id: input.id },
        data: { parentId, order },
      });
    });
  }
}

export function createBacklogService(db: BacklogServiceDb | PrismaClient) {
  return new BacklogService(db as BacklogServiceDb);
}

async function getActiveTaskOrThrow(tx: TaskReader, id: string) {
  const task = await tx.task.findFirst({
    where: {
      id,
      deletedAt: null,
    },
  });

  if (!task) {
    throw notFound("Task not found.");
  }

  return task;
}

type MentionNotificationInput = {
  actorId: string;
  task: Task;
  previousAssigneeId: string | null;
  previousTitle?: string;
  previousDescription?: string | null;
};

async function createMentionAndAssignmentNotifications(
  tx: BacklogTransaction,
  input: MentionNotificationInput,
) {
  const mentionedUserIds = await getMentionedUserIds(tx, {
    text: `${input.task.title} ${input.task.description ?? ""}`,
  });

  const previousMentionedUserIds = input.previousTitle === undefined
    ? new Set<string>()
    : await getMentionedUserIds(tx, {
      text: `${input.previousTitle ?? ""} ${input.previousDescription ?? ""}`,
    });

  const assignedUserId = input.task.assigneeId;
  const isAssigneeChanged =
    assignedUserId !== null && assignedUserId !== input.previousAssigneeId;

  const recipients = new Set<string>([
    ...mentionedUserIds,
    ...(isAssigneeChanged ? [assignedUserId] : []),
  ]);

  for (const recipientId of recipients) {
    if (recipientId === input.actorId) {
      continue;
    }

    if (recipientId === assignedUserId && !isAssigneeChanged) {
      continue;
    }

    if (recipientId === assignedUserId) {
      await createNotification(tx, {
        actorId: input.actorId,
        recipientId,
        type: NOTIFICATION_TYPES.TASK_ASSIGNED,
        entityType: EntityType.TASK,
        entityId: input.task.id,
        title: "Task assigned",
        message: `You were assigned to ${input.task.title}`,
        targetPath: "/backlog",
      });
      continue;
    }

    if (previousMentionedUserIds.has(recipientId)) {
      continue;
    }

    await createNotification(tx, {
      actorId: input.actorId,
      recipientId,
      type: NOTIFICATION_TYPES.TASK_MENTION,
      entityType: EntityType.TASK,
      entityId: input.task.id,
      title: "Task mention",
      message: `${input.actorId} mentioned you in ${input.task.title}`,
      targetPath: "/backlog",
    });
  }
}

async function getMentionedUserIds(
  tx: BacklogTransaction,
  input: {
    text: string;
  },
) {
  if (!tx.user) {
    return new Set<string>();
  }

  const candidates = extractMentionCandidates(input.text);
  if (candidates.length === 0) {
    return new Set<string>();
  }

  const users = await tx.user.findMany({
    where: {},
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  const matched = new Set<string>();

  for (const user of users) {
    const aliases = buildMentionAliases(user);
    if (aliases.some((alias) => candidates.includes(alias))) {
      matched.add(user.id);
    }
  }

  return matched;
}

function extractMentionCandidates(input: string) {
  const all = input.matchAll(MENTION_PATTERN);
  const candidates: string[] = [];

  for (const match of all) {
    const candidate = match[1];
    if (candidate) {
      candidates.push(normalizeMention(candidate));
    }
  }

  return candidates;
}

function buildMentionAliases(user: UserRecord) {
  const localPart = user.email.split("@")[0] ?? "";
  const firstName = user.name.split(/\s+/)[0] ?? "";
  const displayName = user.name.replace(/\s+/g, "");

  return [
    normalizeMention(user.id),
    normalizeMention(localPart),
    normalizeMention(firstName),
    normalizeMention(displayName),
  ];
}

function normalizeMention(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function getNeighbour(tx: BacklogTransaction, id: string | undefined) {
  if (!id) {
    return undefined;
  }

  const task = await getActiveTaskOrThrow(tx, id);
  return {
    id: task.id,
    parentId: task.parentId,
    order: task.order,
  };
}

function getReorderParentId(
  task: Task,
  before: OrderNeighbour | undefined,
  after: OrderNeighbour | undefined,
) {
  const parentId = before?.parentId ?? after?.parentId ?? task.parentId;
  const beforeMatchesParent = before === undefined || before.parentId === parentId;
  const afterMatchesParent = after === undefined || after.parentId === parentId;

  if (!beforeMatchesParent || !afterMatchesParent) {
    throw badRequest("Reorder neighbours must share the same parent.");
  }

  if (before && after && before.order >= after.order) {
    throw badRequest("beforeId must come before afterId.");
  }

  return parentId;
}

async function ensureReorderParentIsValid(
  tx: BacklogTransaction,
  taskId: string,
  parentId: string | null,
) {
  if (parentId === taskId) {
    throw badRequest("A task cannot be its own epic.");
  }

  await ensureParentExists(tx, parentId);

  if (parentId === null) {
    return;
  }

  const child = await tx.task.findFirst({
    where: {
      parentId: taskId,
      deletedAt: null,
    },
  });

  if (child) {
    throw badRequest("An epic with children cannot be nested under another task.");
  }
}

async function getReorderOrder(
  tx: BacklogTransaction,
  input: {
    taskId: string;
    parentId: string | null;
    before: OrderNeighbour | undefined;
    after: OrderNeighbour | undefined;
  },
) {
  if (input.before === undefined && input.after === undefined) {
    return await getNextOrder(tx, input.parentId, input.taskId);
  }

  const order = getFractionalOrder(input.before?.order, input.after?.order);

  if (order !== undefined && hasUsableOrderGap(input.before?.order, input.after?.order)) {
    return order;
  }

  const tasks = await tx.task.findMany({
    where: {
      parentId: input.parentId,
      deletedAt: null,
      id: { not: input.taskId },
    },
    orderBy: { order: "asc" },
  });

  const rebalancedTasks = tasks.map((task, index) => ({
    ...task,
    order: getBalancedOrder(index),
  }));

  for (const task of rebalancedTasks) {
    await tx.task.update({
      where: { id: task.id },
      data: { order: task.order },
    });
  }

  const before = input.before
    ? rebalancedTasks.find((task) => task.id === input.before?.id)
    : undefined;
  const after = input.after
    ? rebalancedTasks.find((task) => task.id === input.after?.id)
    : undefined;

  return getFractionalOrder(before?.order, after?.order) ?? getNextBalancedOrder(tasks.length);
}

function getFractionalOrder(beforeOrder: number | undefined, afterOrder: number | undefined) {
  if (beforeOrder === undefined) {
    return afterOrder === undefined ? INITIAL_ORDER : afterOrder / 2;
  }

  if (afterOrder === undefined) {
    return beforeOrder + INITIAL_ORDER;
  }

  return (beforeOrder + afterOrder) / 2;
}

function hasUsableOrderGap(beforeOrder: number | undefined, afterOrder: number | undefined) {
  if (beforeOrder === undefined || afterOrder === undefined) {
    return beforeOrder === undefined && afterOrder !== undefined
      ? afterOrder > MIN_ORDER_GAP
      : true;
  }

  return afterOrder - beforeOrder > MIN_ORDER_GAP;
}

async function getNextOrder(
  tx: BacklogTransaction,
  parentId: string | null,
  excludingTaskId?: string,
) {
  const excludeTaskFilter = excludingTaskId
    ? { not: excludingTaskId }
    : undefined;

  const lastTask = await tx.task.findFirst({
    where: {
      parentId,
      deletedAt: null,
      id: excludeTaskFilter,
    },
    orderBy: { order: "desc" },
  });

  return lastTask ? lastTask.order + INITIAL_ORDER : INITIAL_ORDER;
}

function getBalancedOrder(index: number) {
  return (index + 1) * INITIAL_ORDER;
}

function getNextBalancedOrder(taskCount: number) {
  return (taskCount + 1) * INITIAL_ORDER;
}

async function ensureParentPatchIsValid(
  tx: BacklogTransaction,
  taskId: string,
  parentId: string | null | undefined,
) {
  if (parentId === undefined) {
    return;
  }

  if (parentId === taskId) {
    throw badRequest("A task cannot be its own epic.");
  }

  await ensureParentExists(tx, parentId);
}

async function ensureParentExists(tx: BacklogTransaction, parentId: string | null) {
  if (parentId === null) {
    return;
  }

  const parent = await getActiveTaskOrThrow(tx, parentId);
  if (parent.parentId !== null) {
    throw badRequest("Tasks can only be nested one level under an epic.");
  }
}
