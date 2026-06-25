import { describe, expect, it } from "vitest";
import { EntityType, Priority, TaskStatus, type Prisma, type Task } from "@hibi/db";
import type { FastifyReply } from "fastify";
import type { ApiContext, Session, User } from "../context.js";
import { appRouter } from "./index.js";

type TaskFindManyArgs = Prisma.TaskFindManyArgs;
type TaskFindFirstArgs = Prisma.TaskFindFirstArgs;
type TaskCreateArgs = { data: Prisma.TaskUncheckedCreateInput };
type TaskUpdateArgs = {
  where: Prisma.TaskWhereUniqueInput;
  data: Prisma.TaskUncheckedUpdateInput;
};
type TaskCountArgs = Prisma.TaskCountArgs;

type AuditLogEntry = {
  id: string;
  actorId: string;
  action: string;
  entityType: EntityType;
  entityId: string;
  data: Prisma.InputJsonValue;
  createdAt: Date;
};

type AuditLogCreateArgs = {
  data: Omit<AuditLogEntry, "id" | "createdAt">;
};

class InMemoryRouterDb {
  readonly tasks: Task[] = [];
  readonly auditLogs: AuditLogEntry[] = [];
  private nextTaskNumber = 1;
  private nextAuditNumber = 1;

  readonly task = {
    findMany: (args: TaskFindManyArgs) => {
      const tasks = this.findTasks(args).map((task) => copyTask(task));
      return Promise.resolve(tasks);
    },
    findFirst: (args: TaskFindFirstArgs) => {
      const task = this.findTasks(args).at(0);
      return Promise.resolve(task ? copyTask(task) : null);
    },
    count: (args: TaskCountArgs) => {
      return Promise.resolve(this.findTasks(args).length);
    },
    create: (args: TaskCreateArgs) => {
      const now = new Date("2026-06-17T00:00:00.000Z");
      const task: Task = {
        id: `task-${this.nextTaskNumber}`,
        title: args.data.title,
        description: args.data.description ?? null,
        status: args.data.status ?? TaskStatus.BACKLOG,
        priority: args.data.priority ?? Priority.MEDIUM,
        assigneeId: args.data.assigneeId ?? null,
        parentId: args.data.parentId ?? null,
        order: args.data.order,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      this.nextTaskNumber += 1;
      this.tasks.push(task);
      return Promise.resolve(copyTask(task));
    },
    update: (args: TaskUpdateArgs) => {
      const id = typeof args.where.id === "string" ? args.where.id : undefined;
      const task = this.tasks.find((candidate) => candidate.id === id);
      if (!task) {
        throw new Error("Task not found.");
      }

      Object.assign(task, args.data, {
        updatedAt: new Date("2026-06-17T00:00:00.000Z"),
      });
      return Promise.resolve(copyTask(task));
    },
  };

  addTask(input: {
    id: string;
    title?: string;
    deletedAt?: Date | null;
    order?: number;
  }) {
    const now = new Date("2026-06-17T00:00:00.000Z");
    this.tasks.push({
      id: input.id,
      title: input.title ?? input.id,
      description: null,
      status: TaskStatus.BACKLOG,
      priority: Priority.MEDIUM,
      assigneeId: null,
      parentId: null,
      order: input.order ?? this.nextTaskNumber * 1024,
      deletedAt: input.deletedAt ?? null,
      createdAt: now,
      updatedAt: now,
    });
    this.nextTaskNumber += 1;
  }

  readonly auditLog = {
    create: (args: AuditLogCreateArgs) => {
      const auditLog: AuditLogEntry = {
        id: `audit-${this.nextAuditNumber}`,
        createdAt: new Date("2026-06-17T00:00:00.000Z"),
        ...args.data,
      };

      this.nextAuditNumber += 1;
      this.auditLogs.push(auditLog);
      return Promise.resolve(auditLog);
    },
  };

  async $transaction<T>(fn: (tx: this) => Promise<T>) {
    return await fn(this);
  }

  private findTasks(args: TaskFindManyArgs | TaskFindFirstArgs) {
    const where = args.where;
    const matchingTasks = this.tasks.filter((task) => {
      if (!where) {
        return true;
      }

      const matchesId = matchesIdFilter(task.id, where.id);
      const matchesStatus = where.status === undefined || task.status === where.status;
      const matchesAssignee =
        where.assigneeId === undefined || task.assigneeId === where.assigneeId;
      const matchesParent = where.parentId === undefined || task.parentId === where.parentId;
      const matchesDeletedAt =
        where.deletedAt === undefined || task.deletedAt === where.deletedAt;

      return (
        matchesId &&
        matchesStatus &&
        matchesAssignee &&
        matchesParent &&
        matchesDeletedAt
      );
    });

    const orderedTasks = orderTasks(matchingTasks, args.orderBy);
    const cursorIndex = args.cursor?.id
      ? orderedTasks.findIndex((task) => task.id === args.cursor?.id)
      : -1;
    const startIndex = cursorIndex >= 0 ? cursorIndex + (args.skip ?? 0) : 0;
    const endIndex = args.take ? startIndex + args.take : undefined;

    return orderedTasks.slice(startIndex, endIndex);
  }
}

function matchesIdFilter(id: string, idFilter: Prisma.TaskWhereInput["id"]) {
  if (idFilter === undefined) {
    return true;
  }

  if (typeof idFilter === "string") {
    return id === idFilter;
  }

  if ("not" in idFilter && typeof idFilter.not === "string") {
    return id !== idFilter.not;
  }

  return true;
}

function orderTasks(
  tasks: Task[],
  orderBy: Prisma.TaskFindManyArgs["orderBy"],
) {
  if (!orderBy) {
    return tasks;
  }

  const orderings = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...tasks].sort((left, right) => {
    for (const ordering of orderings) {
      if ("order" in ordering && ordering.order) {
        const direction = ordering.order;
        const difference = left.order - right.order;
        if (difference !== 0) {
          return direction === "asc" ? difference : -difference;
        }
      }

      if ("id" in ordering && ordering.id) {
        const direction = ordering.id;
        const difference = left.id.localeCompare(right.id);
        if (difference !== 0) {
          return direction === "asc" ? difference : -difference;
        }
      }
    }

    return 0;
  });
}

function copyTask(task: Task): Task {
  return { ...task };
}

function createAuthenticatedContext(db: InMemoryRouterDb): ApiContext {
  const user: User = {
    id: "user-1",
    email: "user@example.com",
    name: "User",
  };
  const session: Session = {
    id: "session-1",
    userId: user.id,
    expiresAt: new Date("2026-06-18T00:00:00.000Z"),
  };

  return {
    db: db as unknown as ApiContext["db"],
    res: { header: () => undefined } as unknown as FastifyReply,
    session,
    user,
  };
}

describe("backlogRouter", () => {
  it("creates and lists tasks through the app router", async () => {
    const db = new InMemoryRouterDb();
    const caller = appRouter.createCaller(createAuthenticatedContext(db));

    const createdTask = await caller.backlog.create({
      title: "Write backlog router",
      priority: Priority.HIGH,
    });
    const listedTasks = await caller.backlog.list({});

    expect(createdTask).toMatchObject({
      title: "Write backlog router",
      status: TaskStatus.BACKLOG,
      priority: Priority.HIGH,
      order: 1024,
    });
    expect(listedTasks).toMatchObject({
      items: [
        {
          id: createdTask.id,
          title: "Write backlog router",
        },
      ],
      nextCursor: undefined,
    });
    expect(db.auditLogs).toMatchObject([
      {
        actorId: "user-1",
        action: "task.created",
        entityType: EntityType.TASK,
        entityId: createdTask.id,
      },
    ]);
  });

  it("counts active tasks for sidebar badges", async () => {
    const db = new InMemoryRouterDb();
    db.addTask({ id: "active-1" });
    db.addTask({ id: "active-2" });
    db.addTask({ id: "deleted", deletedAt: new Date("2026-06-17T00:00:00.000Z") });
    const caller = appRouter.createCaller(createAuthenticatedContext(db));

    await expect(caller.backlog.count()).resolves.toBe(2);
  });
});
