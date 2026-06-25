import { describe, expect, it } from "vitest";
import {
  EntityType,
  Priority,
  TaskStatus,
  type Task,
} from "@hibi/db";
import type { Prisma } from "@hibi/db";
import { BacklogService } from "./service.js";

type TaskWhere = {
  id?: string | { not: string };
  parentId?: string | null;
  deletedAt?: null;
};

type TaskOrderBy = {
  order: "asc" | "desc";
};

type TaskFindArgs = {
  where?: TaskWhere;
  orderBy?: TaskOrderBy;
};

type TaskCreateArgs = {
  data: {
    title: string;
    description?: string | null;
    status?: TaskStatus;
    priority?: Priority;
    assigneeId?: string | null;
    parentId?: string | null;
    order: number;
  };
};

type TaskUpdateArgs = {
  where: { id: string };
  data: Partial<
    Pick<
      Task,
      | "title"
      | "description"
      | "status"
      | "priority"
      | "assigneeId"
      | "parentId"
      | "order"
      | "deletedAt"
    >
  >;
};

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

class InMemoryBacklogDb {
  readonly tasks: Task[] = [];
  readonly auditLogs: AuditLogEntry[] = [];
  private nextTaskNumber = 1;
  private nextAuditNumber = 1;

  readonly task = {
    findFirst: (args: TaskFindArgs) => {
      const tasks = this.findTasks(args);
      const task = tasks.at(0);
      return Promise.resolve(task ? copyTask(task) : null);
    },
    findMany: (args: TaskFindArgs) => {
      return Promise.resolve(this.findTasks(args).map((task) => copyTask(task)));
    },
    count: (args: TaskFindArgs) => {
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
      const task = this.tasks.find((candidate) => candidate.id === args.where.id);
      if (!task) {
        throw new Error(`Missing task ${args.where.id}`);
      }

      Object.assign(task, args.data, {
        updatedAt: new Date("2026-06-17T00:00:00.000Z"),
      });
      return Promise.resolve(copyTask(task));
    },
  };

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

  async $transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return await fn(this as unknown as Prisma.TransactionClient);
  }

  addTask(input: {
    id: string;
    title?: string;
    status?: TaskStatus;
    priority?: Priority;
    parentId?: string | null;
    order: number;
    deletedAt?: Date | null;
  }) {
    const now = new Date("2026-06-17T00:00:00.000Z");
    this.tasks.push({
      id: input.id,
      title: input.title ?? input.id,
      description: null,
      status: input.status ?? TaskStatus.BACKLOG,
      priority: input.priority ?? Priority.MEDIUM,
      assigneeId: null,
      parentId: input.parentId ?? null,
      order: input.order,
      deletedAt: input.deletedAt ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  private findTasks(args: TaskFindArgs) {
    const where = args.where;
    const matches = this.tasks.filter((task) => {
      if (!where) {
        return true;
      }

      const matchesId =
        where.id === undefined ||
        (typeof where.id === "string" ? task.id === where.id : task.id !== where.id.not);
      const matchesParent = where.parentId === undefined || task.parentId === where.parentId;
      const matchesDeletedAt =
        where.deletedAt === undefined || task.deletedAt === where.deletedAt;

      return matchesId && matchesParent && matchesDeletedAt;
    });

    if (!args.orderBy) {
      return matches;
    }

    return [...matches].sort((left, right) => {
      const difference = left.order - right.order;
      return args.orderBy?.order === "asc" ? difference : -difference;
    });
  }
}

function copyTask(task: Task): Task {
  return { ...task };
}

function createService() {
  const db = new InMemoryBacklogDb();
  return {
    db,
    service: new BacklogService(db),
  };
}

describe("BacklogService", () => {
  it("counts active tasks", async () => {
    const { db, service } = createService();
    db.addTask({ id: "active-1", order: 1024 });
    db.addTask({ id: "active-2", order: 2048 });
    db.addTask({
      id: "deleted",
      order: 3072,
      deletedAt: new Date("2026-06-17T00:00:00.000Z"),
    });

    await expect(service.countActive()).resolves.toBe(2);
  });

  it("creates tasks at the end of the parent list and writes a create audit log", async () => {
    const { db, service } = createService();
    db.addTask({ id: "existing", order: 1024 });

    const task = await service.create({
      actorId: "user-1",
      title: "New task",
      priority: Priority.HIGH,
    });

    expect(task.order).toBe(2048);
    expect(task.status).toBe(TaskStatus.BACKLOG);
    expect(db.auditLogs).toMatchObject([
      {
        actorId: "user-1",
        action: "task.created",
        entityType: EntityType.TASK,
        entityId: task.id,
      },
    ]);
  });

  it("sets status without writing audit logs", async () => {
    const { db, service } = createService();
    db.addTask({ id: "task", order: 1024 });

    const inProgress = await service.setStatus({
      id: "task",
      status: TaskStatus.IN_PROGRESS,
    });
    const inReview = await service.setStatus({
      id: "task",
      status: TaskStatus.IN_REVIEW,
    });
    const blocked = await service.setStatus({
      id: "task",
      status: TaskStatus.BLOCKED,
    });
    const done = await service.setStatus({
      id: "task",
      status: TaskStatus.DONE,
    });

    expect(inProgress.status).toBe(TaskStatus.IN_PROGRESS);
    expect(inReview.status).toBe(TaskStatus.IN_REVIEW);
    expect(blocked.status).toBe(TaskStatus.BLOCKED);
    expect(done.status).toBe(TaskStatus.DONE);
    expect(db.auditLogs).toHaveLength(0);
  });

  it("updates task fields without writing audit logs", async () => {
    const { db, service } = createService();
    db.addTask({ id: "task", order: 1024 });

    const task = await service.update({
      actorId: "user-1",
      id: "task",
      patch: {
        title: "Renamed",
        description: "Details",
        priority: Priority.URGENT,
      },
    });

    expect(task).toMatchObject({
      title: "Renamed",
      description: "Details",
      priority: Priority.URGENT,
    });
    expect(db.auditLogs).toHaveLength(0);
  });

  it("soft deletes active tasks and writes a delete audit log", async () => {
    const { db, service } = createService();
    db.addTask({ id: "task", title: "Delete me", order: 1024 });

    const task = await service.softDelete({
      actorId: "user-1",
      id: "task",
    });

    expect(task.deletedAt).toBeInstanceOf(Date);
    expect(db.auditLogs).toMatchObject([
      {
        actorId: "user-1",
        action: "task.deleted",
        entityType: EntityType.TASK,
        entityId: "task",
        data: {
          title: "Delete me",
        },
      },
    ]);
  });

  it("reorders a task between two neighbours using a fractional order", async () => {
    const { db, service } = createService();
    db.addTask({ id: "before", order: 1024 });
    db.addTask({ id: "moving", order: 2048 });
    db.addTask({ id: "after", order: 3072 });

    const task = await service.reorder({
      id: "moving",
      beforeId: "before",
      afterId: "after",
    });

    expect(task.order).toBe(2048);
  });

  it("reorders a task to the beginning of a list", async () => {
    const { db, service } = createService();
    db.addTask({ id: "after", order: 1024 });
    db.addTask({ id: "moving", order: 2048 });

    const task = await service.reorder({
      id: "moving",
      afterId: "after",
    });

    expect(task.order).toBe(512);
  });

  it("reorders a task to the end of a list", async () => {
    const { db, service } = createService();
    db.addTask({ id: "moving", order: 1024 });
    db.addTask({ id: "before", order: 2048 });

    const task = await service.reorder({
      id: "moving",
      beforeId: "before",
    });

    expect(task.order).toBe(3072);
  });

  it("reorders a task to the end when no neighbours are provided", async () => {
    const { db, service } = createService();
    db.addTask({ id: "before", order: 1024 });
    db.addTask({ id: "moving", order: 1536 });
    db.addTask({ id: "after", order: 3072 });

    const task = await service.reorder({
      id: "moving",
    });

    expect(task.order).toBe(4096);
    expect(db.tasks.find((candidate) => candidate.id === "after")?.order).toBe(3072);
    expect(db.tasks.find((candidate) => candidate.id === "before")?.order).toBe(1024);
  });

  it("moves a task under the neighbours' epic", async () => {
    const { db, service } = createService();
    db.addTask({ id: "epic", order: 1024 });
    db.addTask({ id: "before", parentId: "epic", order: 1024 });
    db.addTask({ id: "moving", order: 2048 });
    db.addTask({ id: "after", parentId: "epic", order: 3072 });

    const task = await service.reorder({
      id: "moving",
      beforeId: "before",
      afterId: "after",
    });

    expect(task).toMatchObject({
      parentId: "epic",
      order: 2048,
    });
  });

  it("lazily rebalances sibling orders when the insert gap is too small", async () => {
    const { db, service } = createService();
    db.addTask({ id: "before", order: 1 });
    db.addTask({ id: "moving", order: 2 });
    db.addTask({ id: "after", order: 1.0000001 });

    const task = await service.reorder({
      id: "moving",
      beforeId: "before",
      afterId: "after",
    });

    expect(db.tasks.find((candidate) => candidate.id === "before")?.order).toBe(1024);
    expect(db.tasks.find((candidate) => candidate.id === "after")?.order).toBe(2048);
    expect(task.order).toBe(1536);
  });

  it("rebalances when prepending to a very small leading gap", async () => {
    const { db, service } = createService();
    db.addTask({ id: "moving", order: 2 });
    db.addTask({ id: "after", order: 0.0000005 });

    const task = await service.reorder({
      id: "moving",
      afterId: "after",
    });

    expect(task.order).toBe(512);
    expect(db.tasks.find((candidate) => candidate.id === "after")?.order).toBe(1024);
  });

  it("supports status transitions through all backlog states", async () => {
    const { db, service } = createService();
    db.addTask({ id: "task", order: 1024 });

    const backlog = await service.setStatus({
      id: "task",
      status: TaskStatus.BACKLOG,
    });
    const todo = await service.setStatus({
      id: "task",
      status: TaskStatus.TODO,
    });
    const inProgress = await service.setStatus({
      id: "task",
      status: TaskStatus.IN_PROGRESS,
    });
    const inReview = await service.setStatus({
      id: "task",
      status: TaskStatus.IN_REVIEW,
    });
    const blocked = await service.setStatus({
      id: "task",
      status: TaskStatus.BLOCKED,
    });
    const done = await service.setStatus({
      id: "task",
      status: TaskStatus.DONE,
    });
    const reopened = await service.setStatus({
      id: "task",
      status: TaskStatus.BACKLOG,
    });

    expect(backlog.status).toBe(TaskStatus.BACKLOG);
    expect(todo.status).toBe(TaskStatus.TODO);
    expect(inProgress.status).toBe(TaskStatus.IN_PROGRESS);
    expect(inReview.status).toBe(TaskStatus.IN_REVIEW);
    expect(blocked.status).toBe(TaskStatus.BLOCKED);
    expect(done.status).toBe(TaskStatus.DONE);
    expect(reopened.status).toBe(TaskStatus.BACKLOG);
    expect(db.auditLogs).toHaveLength(0);
  });

  it("rejects reorder neighbours from different parents", async () => {
    const { db, service } = createService();
    db.addTask({ id: "first-epic", order: 1024 });
    db.addTask({ id: "second-epic", order: 2048 });
    db.addTask({ id: "before", parentId: "first-epic", order: 1024 });
    db.addTask({ id: "moving", order: 2048 });
    db.addTask({ id: "after", parentId: "second-epic", order: 3072 });

    await expect(
      service.reorder({
        id: "moving",
        beforeId: "before",
        afterId: "after",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects reversed before and after neighbours", async () => {
    const { db, service } = createService();
    db.addTask({ id: "before", order: 3072 });
    db.addTask({ id: "moving", order: 2048 });
    db.addTask({ id: "after", order: 1024 });

    await expect(
      service.reorder({
        id: "moving",
        beforeId: "before",
        afterId: "after",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects reordering an epic relative to its own child", async () => {
    const { db, service } = createService();
    db.addTask({ id: "epic", order: 1024 });
    db.addTask({ id: "child", parentId: "epic", order: 1024 });

    await expect(
      service.reorder({
        id: "epic",
        beforeId: "child",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    expect(db.tasks.find((candidate) => candidate.id === "epic")?.parentId).toBeNull();
  });

  it("rejects moving an epic with children under another epic", async () => {
    const { db, service } = createService();
    db.addTask({ id: "target-epic", order: 1024 });
    db.addTask({ id: "target-child", parentId: "target-epic", order: 1024 });
    db.addTask({ id: "moving-epic", order: 2048 });
    db.addTask({ id: "moving-child", parentId: "moving-epic", order: 1024 });

    await expect(
      service.reorder({
        id: "moving-epic",
        afterId: "target-child",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    expect(db.tasks.find((candidate) => candidate.id === "moving-epic")?.parentId).toBeNull();
  });

  it("rejects nesting a task below a non-root task", async () => {
    const { db, service } = createService();
    db.addTask({ id: "epic", order: 1024 });
    db.addTask({ id: "child", parentId: "epic", order: 1024 });
    db.addTask({ id: "task", order: 2048 });

    await expect(
      service.update({
        actorId: "user-1",
        id: "task",
        patch: { parentId: "child" },
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
