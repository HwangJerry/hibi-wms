import { badRequest, notFound, writeAuditLog } from "@hibi/core";
import type { AuditLogTransaction } from "@hibi/core";
import { EntityType, Priority } from "@hibi/db";
import type { Prisma, Task, TaskStatus } from "@hibi/db";

const INITIAL_ORDER = 1024;
const MIN_ORDER_GAP = 0.000001;

type TaskDelegate = {
  findMany(args: Prisma.TaskFindManyArgs): Promise<Task[]>;
  findFirst(args: Prisma.TaskFindFirstArgs): Promise<Task | null>;
  create(args: { data: Prisma.TaskUncheckedCreateInput }): Promise<Task>;
  update(args: {
    where: Prisma.TaskWhereUniqueInput;
    data: Prisma.TaskUncheckedUpdateInput;
  }): Promise<Task>;
};

type BacklogTransaction = {
  task: TaskDelegate;
} & AuditLogTransaction;

type TaskReader = {
  task: Pick<TaskDelegate, "findFirst">;
};

export type BacklogServiceDb = {
  $transaction<T>(fn: (tx: BacklogTransaction) => Promise<T>): Promise<T>;
  task: TaskDelegate;
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
    const nextCursor = tasks.length > input.limit ? items.at(-1)?.id : undefined;

    return {
      items,
      nextCursor,
    };
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

      return task;
    });
  }

  async update(input: UpdateTaskInput) {
    return await this.db.$transaction(async (tx) => {
      await getActiveTaskOrThrow(tx, input.id);
      await ensureParentPatchIsValid(tx, input.id, input.patch.parentId);

      return await tx.task.update({
        where: { id: input.id },
        data: input.patch,
      });
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

export function createBacklogService(db: BacklogServiceDb) {
  return new BacklogService(db);
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
  if (beforeOrder === undefined && afterOrder === undefined) {
    return INITIAL_ORDER;
  }

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
    return true;
  }

  return afterOrder - beforeOrder > MIN_ORDER_GAP;
}

async function getNextOrder(tx: BacklogTransaction, parentId: string | null) {
  const lastTask = await tx.task.findFirst({
    where: {
      parentId,
      deletedAt: null,
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
