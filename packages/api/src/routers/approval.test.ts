import { describe, expect, it } from "vitest";
import { EntityType, type Prisma } from "@hibi/db";
import type { FastifyReply } from "fastify";
import type { ApiContext, Session, User } from "../context.js";
import { appRouter } from "./index.js";

const APPROVAL_TYPES = {
  FINANCIAL: "FINANCIAL" as const,
  WORK: "WORK" as const,
} as const;

const APPROVAL_STATES = {
  DRAFT: "DRAFT" as const,
  PENDING: "PENDING" as const,
  APPROVED: "APPROVED" as const,
  REJECTED: "REJECTED" as const,
  CANCELLED: "CANCELLED" as const,
} as const;

const APPROVAL_ACTIONS = {
  SUBMIT: "SUBMIT" as const,
  APPROVE: "APPROVE" as const,
  REJECT: "REJECT" as const,
  CANCEL: "CANCEL" as const,
  COMMENT: "COMMENT" as const,
} as const;

type ApprovalType = (typeof APPROVAL_TYPES)[keyof typeof APPROVAL_TYPES];
type ApprovalState = (typeof APPROVAL_STATES)[keyof typeof APPROVAL_STATES];
type ApprovalActionKind = (typeof APPROVAL_ACTIONS)[keyof typeof APPROVAL_ACTIONS];

type ApprovalRequest = {
  id: string;
  type: ApprovalType;
  title: string;
  description: string | null;
  requesterId: string;
  approverId: string;
  state: ApprovalState;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ApprovalActionRecord = {
  id: string;
  requestId: string;
  actorId: string;
  action: ApprovalActionKind | string;
  note: string | null;
  createdAt: Date;
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

type ApprovalFindArgs = {
  where?: {
    id?: string;
    state?: ApprovalState;
    type?: ApprovalType;
    requesterId?: string;
    approverId?: string;
    OR?: Array<{
      requesterId?: string;
      approverId?: string;
    }>;
  };
  orderBy?:
    | {
        updatedAt?: "asc" | "desc";
        id?: "asc" | "desc";
      }
    | Array<{
        updatedAt?: "asc" | "desc";
        id?: "asc" | "desc";
      }>;
  take?: number;
  cursor?: {
    id: string;
  };
  skip?: number;
};

type ApprovalCreateArgs = {
  data: {
    type: ApprovalType;
    title: string;
    description?: string | null;
    requesterId: string;
    approverId: string;
    state?: ApprovalState;
  };
};

type ApprovalUpdateArgs = {
  where: {
    id: string;
  };
  data: {
    state?: ApprovalState;
    decidedAt?: Date | null;
  };
};

type ApprovalActionCreateArgs = {
  data: {
    requestId: string;
    actorId: string;
    action: string;
    note?: string | null;
  };
};

type AuditLogCreateArgs = {
  data: {
    actorId: string;
    action: string;
    entityType: EntityType;
    entityId: string;
    data: Prisma.InputJsonValue;
  };
};

class InMemoryApprovalRouterDb {
  readonly users = ["user-1", "user-2"];
  readonly userNameById: Record<string, string> = {
    "user-1": "Aria Kessler",
    "user-2": "Dev Maddox",
  };
  readonly approvalRequests: ApprovalRequest[] = [];
  readonly approvalActions: ApprovalActionRecord[] = [];
  readonly auditLogs: AuditLogEntry[] = [];
  private nextRequestNumber = 1;
  private nextActionNumber = 1;
  private nextAuditNumber = 1;

  readonly approvalRequest = {
    findMany: (args: ApprovalFindArgs) => {
      const requests = this.findRequests(args);
      return Promise.resolve(requests.slice(0, args.take));
    },
    findFirst: (args: ApprovalFindArgs) => {
      const request = this.findRequests(args).at(0);
      return Promise.resolve(request ? { ...request } : null);
    },
    count: (args: ApprovalFindArgs) => {
      return Promise.resolve(this.findRequests(args).length);
    },
    create: (args: ApprovalCreateArgs) => {
      const now = new Date("2026-06-17T00:00:00.000Z");
      const request: ApprovalRequest = {
        id: `approval-${this.nextRequestNumber}`,
        type: args.data.type,
        title: args.data.title,
        description: args.data.description ?? null,
        requesterId: args.data.requesterId,
        approverId: args.data.approverId,
        state: args.data.state ?? APPROVAL_STATES.PENDING,
        decidedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      this.nextRequestNumber += 1;
      this.approvalRequests.push(request);
      return Promise.resolve({ ...request });
    },
    update: (args: ApprovalUpdateArgs) => {
      const request = this.approvalRequests.find((candidate) => candidate.id === args.where.id);
      if (!request) {
        throw new Error(`Missing approval request ${args.where.id}`);
      }

      Object.assign(request, args.data, {
        updatedAt: new Date("2026-06-17T00:00:00.000Z"),
      });
      return Promise.resolve({ ...request });
    },
  };

  readonly approvalAction = {
    create: (args: ApprovalActionCreateArgs) => {
      const action: ApprovalActionRecord = {
        id: `approval-action-${this.nextActionNumber}`,
        requestId: args.data.requestId,
        actorId: args.data.actorId,
        action: args.data.action,
        note: args.data.note ?? null,
        createdAt: new Date("2026-06-17T00:00:00.000Z"),
      };

      this.nextActionNumber += 1;
      this.approvalActions.push(action);
      return Promise.resolve(action);
    },
  };

  readonly user = {
    findMany: (args: { where: { id?: string | { not: string }; take?: number } }) => {
      const requestedId = typeof args.where.id === "string" ? args.where.id : undefined;
      const excludedId =
        typeof args.where.id === "object" && "not" in args.where.id ? args.where.id.not : undefined;

      const matching = this.users.filter((userId) => {
        if (requestedId !== undefined) {
          return userId === requestedId;
        }

        if (excludedId !== undefined) {
          return userId !== excludedId;
        }

        return true;
      });

      const limited = args.where.id !== undefined ? matching : matching;
      const taken =
        args.where.id === undefined && args.where.take !== undefined
          ? matching.slice(0, args.where.take)
          : limited;

      return Promise.resolve(
        taken.map((id) => ({ id, name: this.userNameById[id] ?? id })),
      );
    },
    findFirst: (args: { where: { id: string } }) => {
      const found = this.users.includes(args.where.id);
      return Promise.resolve(
        found
          ? { id: args.where.id, name: this.userNameById[args.where.id] ?? args.where.id }
          : null,
      );
    },
  };

  readonly auditLog = {
    create: (args: AuditLogCreateArgs) => {
      const auditLog: AuditLogEntry = {
        id: `audit-${this.nextAuditNumber}`,
        actorId: args.data.actorId,
        action: args.data.action,
        entityType: args.data.entityType,
        entityId: args.data.entityId,
        data: args.data.data,
        createdAt: new Date("2026-06-17T00:00:00.000Z"),
      };

      this.nextAuditNumber += 1;
      this.auditLogs.push(auditLog);
      return Promise.resolve(auditLog);
    },
  };

  async $transaction<T>(fn: (tx: InMemoryApprovalRouterDb) => Promise<T>) {
    return await fn(this);
  }

  addApprovalRequest(input: {
    id: string;
    state?: ApprovalState;
    type?: ApprovalType;
    requesterId?: string;
    approverId?: string;
  }) {
    const now = new Date("2026-06-17T00:00:00.000Z");
    this.approvalRequests.push({
      id: input.id,
      title: input.id,
      description: null,
      type: input.type ?? APPROVAL_TYPES.WORK,
      requesterId: input.requesterId ?? "user-1",
      approverId: input.approverId ?? "user-2",
      state: input.state ?? APPROVAL_STATES.PENDING,
      decidedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  private findRequests(args: ApprovalFindArgs) {
    const where = args.where;
    const matched = this.approvalRequests.filter((request) => {
      if (!where) {
        return true;
      }

      if (where.id !== undefined && request.id !== where.id) {
        return false;
      }

      if (where.state !== undefined && request.state !== where.state) {
        return false;
      }

      if (where.type !== undefined && request.type !== where.type) {
        return false;
      }

      if (where.requesterId !== undefined && request.requesterId !== where.requesterId) {
        return false;
      }

      if (where.approverId !== undefined && request.approverId !== where.approverId) {
        return false;
      }

      if (where.OR !== undefined) {
        const matchesAnyOrCondition = where.OR.some((condition) => {
          const matchesRequester =
            condition.requesterId === undefined || request.requesterId === condition.requesterId;
          const matchesApprover =
            condition.approverId === undefined || request.approverId === condition.approverId;

          return matchesRequester && matchesApprover;
        });

        if (!matchesAnyOrCondition) {
          return false;
        }
      }

      return true;
    });

    const ordered = this.orderRequests(matched, args.orderBy);
    const cursorIndex = args.cursor
      ? ordered.findIndex((request) => request.id === args.cursor?.id)
      : -1;
    const startIndex = cursorIndex >= 0 ? cursorIndex + (args.skip ?? 0) : 0;
    const endIndex = args.take ? startIndex + args.take : undefined;

    return ordered.slice(startIndex, endIndex);
  }

  private orderRequests(
    requests: ApprovalRequest[],
    orderBy?: ApprovalFindArgs["orderBy"],
  ) {
    if (!orderBy) {
      return requests;
    }

    const orderings = Array.isArray(orderBy) ? orderBy : [orderBy];
    return [...requests].sort((left, right) => {
      for (const ordering of orderings) {
        if (ordering.updatedAt !== undefined) {
          const updatedAtDirection = ordering.updatedAt === "asc" ? 1 : -1;
          const diff =
            (left.updatedAt.getTime() - right.updatedAt.getTime()) * updatedAtDirection;
          if (diff !== 0) {
            return diff;
          }
        }

        if (ordering.id !== undefined) {
          const idDirection = ordering.id === "asc" ? 1 : -1;
          const diff = left.id.localeCompare(right.id) * idDirection;
          if (diff !== 0) {
            return diff;
          }
        }
      }

      return 0;
    });
  }
}

function createAuthenticatedContext(
  db: InMemoryApprovalRouterDb,
  userId: string,
): ApiContext {
  const user: User = {
    id: userId,
    email: `${userId}@example.com`,
    name: userId,
  };

  const session: Session = {
    id: `${userId}-session`,
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

describe("approvalRouter", () => {
  it("runs a complete submit -> approve flow", async () => {
    const db = new InMemoryApprovalRouterDb();
    db.addApprovalRequest({
      id: "request-draft",
      state: APPROVAL_STATES.DRAFT,
      type: APPROVAL_TYPES.WORK,
      requesterId: "user-1",
      approverId: "user-2",
    });

    const requesterCaller = appRouter.createCaller(createAuthenticatedContext(db, "user-1"));
    const approverCaller = appRouter.createCaller(createAuthenticatedContext(db, "user-2"));

    const submitted = await requesterCaller.approval.submit({ id: "request-draft" });
    expect(submitted).toMatchObject({
      id: "request-draft",
      state: APPROVAL_STATES.PENDING,
    });

    const approved = await approverCaller.approval.approve({
      id: "request-draft",
      note: "Approved",
    });
    expect(approved).toMatchObject({
      id: "request-draft",
      state: APPROVAL_STATES.APPROVED,
    });

    const retrieved = await approverCaller.approval.get({ id: "request-draft" });
    expect(retrieved).toMatchObject({
      id: "request-draft",
      state: APPROVAL_STATES.APPROVED,
    });

    expect(db.approvalActions).toHaveLength(2);
    expect(db.auditLogs).toHaveLength(2);
    expect(db.approvalActions.at(-1)).toMatchObject({
      requestId: "request-draft",
      action: APPROVAL_ACTIONS.APPROVE,
      actorId: "user-2",
      note: "Approved",
    });
    expect(db.auditLogs.at(-1)).toMatchObject({
      action: "approval.approved",
      actorId: "user-2",
      entityId: "request-draft",
      entityType: EntityType.APPROVAL,
    });
  });

  it("counts pending approvals for the current user", async () => {
    const db = new InMemoryApprovalRouterDb();
    db.addApprovalRequest({
      id: "pending-as-requester",
      state: APPROVAL_STATES.PENDING,
      requesterId: "user-1",
      approverId: "user-2",
    });
    db.addApprovalRequest({
      id: "pending-as-approver",
      state: APPROVAL_STATES.PENDING,
      requesterId: "user-2",
      approverId: "user-1",
    });
    db.addApprovalRequest({
      id: "approved-current-user",
      state: APPROVAL_STATES.APPROVED,
      requesterId: "user-1",
      approverId: "user-2",
    });
    db.addApprovalRequest({
      id: "pending-other-users",
      state: APPROVAL_STATES.PENDING,
      requesterId: "user-2",
      approverId: "user-2",
    });
    const caller = appRouter.createCaller(createAuthenticatedContext(db, "user-1"));

    await expect(caller.approval.count()).resolves.toBe(2);
  });
});
