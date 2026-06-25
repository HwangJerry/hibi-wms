import { describe, expect, it } from "vitest";
import {
  EntityType,
  Prisma,
} from "@hibi/db";
import { FINANCIAL_APPROVAL_TRANSACTION_REFERENCE } from "../finance/index.js";
import { ApprovalService } from "./service.js";

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

type ApprovalRequestRecord = {
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
  action: string;
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

type TransactionRecord = {
  id: string;
  status: "PENDING" | "POSTED" | "REVERSED";
  accountId: string;
  amount: Prisma.Decimal;
  approvalId: string | null;
  postedAt: Date | null;
  occurredAt: Date;
};

type ReferenceRecord = {
  id: string;
  fromType: EntityType;
  fromId: string;
  toType: EntityType;
  toId: string;
  relation: string;
  createdAt: Date;
};

type ApprovalFindArgs = {
  where?: {
    id?: string | { not: string };
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
  where: { id: string };
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

class InMemoryApprovalDb {
  readonly users = ["user-1", "user-2"];
  readonly requests: ApprovalRequestRecord[] = [];
  readonly approvalActions: ApprovalActionRecord[] = [];
  readonly auditLogs: AuditLogEntry[] = [];
  readonly transactions: TransactionRecord[] = [];
  readonly references: ReferenceRecord[] = [];
  private nextRequestNumber = 1;
  private nextActionNumber = 1;
  private nextAuditNumber = 1;
  private nextReferenceNumber = 1;

  readonly approvalRequest = {
    findMany: (args: ApprovalFindArgs) => {
      const requestRows = this.findRequests(args);
      return Promise.resolve(requestRows.slice(0, args.take));
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
      const request: ApprovalRequestRecord = {
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
      this.requests.push(request);
      return Promise.resolve({ ...request });
    },
    update: (args: ApprovalUpdateArgs) => {
      const request = this.requests.find((candidate) => candidate.id === args.where.id);
      if (!request) {
        throw new Error(`Missing approval request ${args.where.id}`);
      }

      Object.assign(request, args.data, { updatedAt: new Date("2026-06-17T00:00:00.000Z") });
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

  readonly transaction = {
    findFirst: (args: { where: { id?: string; approvalId?: string | null; status?: string } }) => {
      const row = this.transactions.find((candidate) => {
        if (args.where.id !== undefined && candidate.id !== args.where.id) {
          return false;
        }

        if (args.where.approvalId !== undefined && candidate.approvalId !== args.where.approvalId) {
          return false;
        }

        if (args.where.status !== undefined && candidate.status !== args.where.status) {
          return false;
        }

        return true;
      });

      return Promise.resolve(row ? { ...row } : null);
    },
    update: (args: { where: { id: string }; data: Partial<Pick<TransactionRecord, "status" | "postedAt">> }) => {
      const target = this.transactions.find((candidate) => candidate.id === args.where.id);
      if (!target) {
        throw new Error(`Missing transaction ${args.where.id}`);
      }

      Object.assign(target, args.data);
      return Promise.resolve({ ...target });
    },
  };

  readonly reference = {
    findFirst: (args: {
      where: {
        fromType?: EntityType;
        fromId?: string;
        toType?: EntityType;
        toId?: string;
        relation?: string;
      };
    }) => {
      const row = this.references.find((candidate) => {
        if (args.where.fromType !== undefined && candidate.fromType !== args.where.fromType) {
          return false;
        }

        if (args.where.fromId !== undefined && candidate.fromId !== args.where.fromId) {
          return false;
        }

        if (args.where.toType !== undefined && candidate.toType !== args.where.toType) {
          return false;
        }

        if (args.where.toId !== undefined && candidate.toId !== args.where.toId) {
          return false;
        }

        if (args.where.relation !== undefined && candidate.relation !== args.where.relation) {
          return false;
        }

        return true;
      });

      return Promise.resolve(row ? { ...row } : null);
    },
  };

  readonly user = {
    findMany: (args: { where: { id?: string | { not: string }; }; take?: number }) => {
      const requestedId = typeof args.where.id === "string" ? args.where.id : undefined;
      const excludedId =
        typeof args.where.id === "object" && "not" in args.where.id
          ? args.where.id.not
          : undefined;

      const matching = this.users.filter((userId) => {
        if (requestedId !== undefined) {
          return userId === requestedId;
        }

        if (excludedId !== undefined) {
          return userId !== excludedId;
        }

        return true;
      });

      const limited = args.take === undefined ? matching : matching.slice(0, args.take);
      return Promise.resolve(limited.map((id) => ({ id })));
    },
    findFirst: (args: { where: { id: string } }) => {
      const found = this.users.includes(args.where.id);
      return Promise.resolve(found ? { id: args.where.id } : null);
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

  async $transaction<T>(fn: (tx: InMemoryApprovalDb) => Promise<T>) {
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
    this.requests.push({
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

  addTransaction(input: Omit<TransactionRecord, "occurredAt">) {
    this.transactions.push({
      ...input,
      occurredAt: new Date("2026-06-17T00:00:00.000Z"),
    });
  }

  addReference(input: Omit<ReferenceRecord, "id" | "createdAt">) {
    const now = new Date("2026-06-17T00:00:00.000Z");
    this.references.push({
      id: `reference-${this.nextReferenceNumber}`,
      createdAt: now,
      ...input,
    });
    this.nextReferenceNumber += 1;
  }

  private findRequests(args: ApprovalFindArgs) {
    const where = args.where;
    const matched = this.requests.filter((request) => {
      if (!where) {
        return true;
      }

      if (where.id !== undefined) {
        const isMatch = typeof where.id === "string"
          ? request.id === where.id
          : request.id !== where.id.not;
        if (!isMatch) {
          return false;
        }
      }

      if (where.type !== undefined && request.type !== where.type) {
        return false;
      }

      if (where.state !== undefined && request.state !== where.state) {
        return false;
      }

      if (where.requesterId !== undefined && request.requesterId !== where.requesterId) {
        return false;
      }

      if (where.approverId !== undefined && request.approverId !== where.approverId) {
        return false;
      }

      if (where.OR !== undefined) {
        const matchesOr = where.OR.some((condition) => {
          const matchRequester =
            condition.requesterId !== undefined
              ? request.requesterId === condition.requesterId
              : false;
          const matchApprover =
            condition.approverId !== undefined
              ? request.approverId === condition.approverId
              : false;
          return matchRequester || matchApprover;
        });

        if (!matchesOr) {
          return false;
        }
      }

      return true;
    });

    const ordered = this.orderRequests(
      matched,
      args.orderBy,
    );

    const cursorIndex = args.cursor
      ? ordered.findIndex((request) => request.id === args.cursor?.id)
      : -1;
    const startIndex = cursorIndex >= 0 ? cursorIndex + (args.skip ?? 0) : 0;
    const endIndex = args.take ? startIndex + args.take : undefined;

    return ordered.slice(startIndex, endIndex);
  }

  private orderRequests(
    requests: ApprovalRequestRecord[],
    orderBy?: ApprovalFindArgs["orderBy"],
  ) {
    if (!orderBy) {
      return requests;
    }

    const orderings = Array.isArray(orderBy) ? orderBy : [orderBy];
    return [...requests].sort((left, right) => {
      for (const ordering of orderings) {
        if (ordering.updatedAt) {
          const updatedAtDirection = ordering.updatedAt === "asc" ? 1 : -1;
          const updatedAtDiff =
            (left.updatedAt.getTime() - right.updatedAt.getTime()) * updatedAtDirection;
          if (updatedAtDiff !== 0) {
            return updatedAtDiff;
          }
        }

        if (ordering.id) {
          const idDirection = ordering.id === "asc" ? 1 : -1;
          const idDiff = left.id.localeCompare(right.id) * idDirection;
          if (idDiff !== 0) {
            return idDiff;
          }
        }
      }

      return 0;
    });
  }
}

function createService() {
  const db = new InMemoryApprovalDb();
  return {
    db,
    service: new ApprovalService(db),
  };
}

describe("ApprovalService", () => {
  it("counts pending approvals for a user", async () => {
    const { db, service } = createService();
    db.addApprovalRequest({
      id: "pending-requester",
      state: APPROVAL_STATES.PENDING,
      requesterId: "user-1",
      approverId: "user-2",
    });
    db.addApprovalRequest({
      id: "pending-approver",
      state: APPROVAL_STATES.PENDING,
      requesterId: "user-2",
      approverId: "user-1",
    });
    db.addApprovalRequest({
      id: "approved-requester",
      state: APPROVAL_STATES.APPROVED,
      requesterId: "user-1",
      approverId: "user-2",
    });
    db.addApprovalRequest({
      id: "pending-other-user",
      state: APPROVAL_STATES.PENDING,
      requesterId: "user-2",
      approverId: "user-2",
    });

    await expect(service.countPendingForUser("user-1")).resolves.toBe(2);
  });

  it("creates with default approver and writes a request audit log", async () => {
    const { db, service } = createService();

    const request = await service.create({
      actorId: "user-1",
      type: APPROVAL_TYPES.WORK,
      title: "Work request",
    });

    expect(request).toMatchObject({
      requesterId: "user-1",
      approverId: "user-2",
      state: APPROVAL_STATES.PENDING,
      type: APPROVAL_TYPES.WORK,
      title: "Work request",
    });
    expect(db.approvalActions).toHaveLength(0);
    expect(db.auditLogs).toMatchObject([
      {
        actorId: "user-1",
        action: "approval.requested",
        entityType: EntityType.APPROVAL,
        entityId: request.id,
      },
    ]);
  });

  it("writes action and audit log for legal submit", async () => {
    const { db, service } = createService();
    db.addApprovalRequest({ id: "a-draft", state: APPROVAL_STATES.DRAFT, requesterId: "user-1" });
    const initialActionCount = db.approvalActions.length;
    const initialAuditCount = db.auditLogs.length;

    const submitted = await service.submit({
      actorId: "user-1",
      id: "a-draft",
    });

    expect(submitted.state).toBe(APPROVAL_STATES.PENDING);
    expect(db.approvalActions).toHaveLength(initialActionCount + 1);
    expect(db.auditLogs).toHaveLength(initialAuditCount + 1);
    expect(db.approvalActions.at(-1)).toMatchObject({
      requestId: "a-draft",
      actorId: "user-1",
      action: APPROVAL_ACTIONS.SUBMIT,
    });
    expect(db.auditLogs.at(-1)).toMatchObject({
      action: "approval.submitted",
      entityId: "a-draft",
    });
  });

  it("writes action and audit log when approver approves", async () => {
    const { db, service } = createService();
    db.addApprovalRequest({ id: "a-pending", state: APPROVAL_STATES.PENDING, approverId: "user-2" });
    const initialActionCount = db.approvalActions.length;
    const initialAuditCount = db.auditLogs.length;

    const approved = await service.approve({
      actorId: "user-2",
      id: "a-pending",
      note: "Looks good",
    });

    expect(approved.state).toBe(APPROVAL_STATES.APPROVED);
    expect(approved.decidedAt).toBeInstanceOf(Date);
    expect(db.approvalActions).toHaveLength(initialActionCount + 1);
    expect(db.auditLogs).toHaveLength(initialAuditCount + 1);
    expect(db.approvalActions.at(-1)).toMatchObject({
      requestId: "a-pending",
      actorId: "user-2",
      action: APPROVAL_ACTIONS.APPROVE,
      note: "Looks good",
    });
    expect(db.auditLogs.at(-1)).toMatchObject({
      action: "approval.approved",
      entityId: "a-pending",
    });
  });

  it("prevents double approval after request reaches terminal state", async () => {
    const { db, service } = createService();
    db.addApprovalRequest({ id: "a-pending", state: APPROVAL_STATES.PENDING, approverId: "user-2" });

    const firstApproval = await service.approve({
      actorId: "user-2",
      id: "a-pending",
      note: "Looks fine",
    });
    expect(firstApproval.state).toBe(APPROVAL_STATES.APPROVED);

    const actionCountAfterFirst = db.approvalActions.length;
    const auditCountAfterFirst = db.auditLogs.length;

    await expect(
      service.approve({
        actorId: "user-2",
        id: "a-pending",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Terminal approvals are immutable.",
    });

    expect(db.approvalActions).toHaveLength(actionCountAfterFirst);
    expect(db.auditLogs).toHaveLength(auditCountAfterFirst);
  });

  it("posts linked transaction when financial request is approved", async () => {
    const { db, service } = createService();
    db.addApprovalRequest({ id: "a-financial", state: APPROVAL_STATES.PENDING, type: APPROVAL_TYPES.FINANCIAL, approverId: "user-2" });
    db.addTransaction({
      id: "tx-pending",
      status: "PENDING",
      accountId: "account-1",
      amount: new Prisma.Decimal("120.00"),
      approvalId: "a-financial",
      postedAt: null,
    });
    db.addReference({
      fromType: EntityType.APPROVAL,
      fromId: "a-financial",
      toType: EntityType.TRANSACTION,
      toId: "tx-pending",
      relation: FINANCIAL_APPROVAL_TRANSACTION_REFERENCE,
    });

    const approved = await service.approve({
      actorId: "user-2",
      id: "a-financial",
      note: "Looks good",
    });

    const transaction = db.transactions.find((candidate) => candidate.id === "tx-pending");

    expect(approved.state).toBe(APPROVAL_STATES.APPROVED);
    expect(transaction?.status).toBe("POSTED");
    expect(transaction?.postedAt).toBeInstanceOf(Date);
    expect(getPostedBalanceForAccount(db.transactions, "account-1").toFixed(2)).toBe("120.00");
    expect(db.auditLogs.at(-1)).toMatchObject({
      action: "finance.transaction.posted",
      entityId: "tx-pending",
      entityType: EntityType.TRANSACTION,
      data: {
        approvalId: "a-financial",
      },
    });
  });

  it("does not post linked transaction when financial request is rejected", async () => {
    const { db, service } = createService();
    db.addApprovalRequest({ id: "a-financial", state: APPROVAL_STATES.PENDING, type: APPROVAL_TYPES.FINANCIAL, approverId: "user-2" });
    db.addTransaction({
      id: "tx-pending",
      status: "PENDING",
      accountId: "account-1",
      amount: new Prisma.Decimal("120.00"),
      approvalId: "a-financial",
      postedAt: null,
    });
    db.addReference({
      fromType: EntityType.APPROVAL,
      fromId: "a-financial",
      toType: EntityType.TRANSACTION,
      toId: "tx-pending",
      relation: FINANCIAL_APPROVAL_TRANSACTION_REFERENCE,
    });

    const rejected = await service.reject({
      actorId: "user-2",
      id: "a-financial",
      note: "Need more detail",
    });

    const transaction = db.transactions.find((candidate) => candidate.id === "tx-pending");

    expect(rejected.state).toBe(APPROVAL_STATES.REJECTED);
    expect(transaction?.status).toBe("PENDING");
    expect(transaction?.postedAt).toBeNull();
    expect(getPostedBalanceForAccount(db.transactions, "account-1").toString()).toBe("0");
    expect(db.auditLogs.at(-1)).toMatchObject({
      action: "approval.rejected",
      entityId: "a-financial",
      entityType: EntityType.APPROVAL,
    });
  });

  it("writes action and audit log when approver rejects", async () => {
    const { db, service } = createService();
    db.addApprovalRequest({ id: "a-pending", state: APPROVAL_STATES.PENDING, approverId: "user-2" });
    const initialActionCount = db.approvalActions.length;
    const initialAuditCount = db.auditLogs.length;

    const rejected = await service.reject({
      actorId: "user-2",
      id: "a-pending",
      note: "Needs update",
    });

    expect(rejected.state).toBe(APPROVAL_STATES.REJECTED);
    expect(rejected.decidedAt).toBeInstanceOf(Date);
    expect(db.approvalActions).toHaveLength(initialActionCount + 1);
    expect(db.auditLogs).toHaveLength(initialAuditCount + 1);
    expect(db.approvalActions.at(-1)).toMatchObject({
      requestId: "a-pending",
      actorId: "user-2",
      action: APPROVAL_ACTIONS.REJECT,
      note: "Needs update",
    });
    expect(db.auditLogs.at(-1)).toMatchObject({
      action: "approval.rejected",
      entityId: "a-pending",
    });
  });

  it("writes action and audit log when requester cancels pending request", async () => {
    const { db, service } = createService();
    db.addApprovalRequest({ id: "a-pending", state: APPROVAL_STATES.PENDING, requesterId: "user-1" });
    const initialActionCount = db.approvalActions.length;
    const initialAuditCount = db.auditLogs.length;

    const cancelled = await service.cancel({
      actorId: "user-1",
      id: "a-pending",
    });

    expect(cancelled.state).toBe(APPROVAL_STATES.CANCELLED);
    expect(cancelled.decidedAt).toBeInstanceOf(Date);
    expect(db.approvalActions).toHaveLength(initialActionCount + 1);
    expect(db.auditLogs).toHaveLength(initialAuditCount + 1);
    expect(db.approvalActions.at(-1)).toMatchObject({
      requestId: "a-pending",
      actorId: "user-1",
      action: APPROVAL_ACTIONS.CANCEL,
    });
    expect(db.auditLogs.at(-1)).toMatchObject({
      action: "approval.cancelled",
      entityId: "a-pending",
    });
  });

  it("writes action and audit log when either participant comments on pending", async () => {
    const { db, service } = createService();
    db.addApprovalRequest({ id: "a-pending", state: APPROVAL_STATES.PENDING, approverId: "user-2" });
    const initialActionCount = db.approvalActions.length;
    const initialAuditCount = db.auditLogs.length;

    const commented = await service.comment({
      actorId: "user-2",
      id: "a-pending",
      note: "Add details",
    });

    expect(commented.state).toBe(APPROVAL_STATES.PENDING);
    expect(db.approvalActions).toHaveLength(initialActionCount + 1);
    expect(db.auditLogs).toHaveLength(initialAuditCount + 1);
    expect(db.approvalActions.at(-1)).toMatchObject({
      requestId: "a-pending",
      actorId: "user-2",
      action: APPROVAL_ACTIONS.COMMENT,
      note: "Add details",
    });
    expect(db.auditLogs.at(-1)).toMatchObject({
      action: "approval.commented",
      entityId: "a-pending",
    });
  });

  it("rejects non-requester from cancelling or terminal-state actions", async () => {
    const { db, service } = createService();
    db.addApprovalRequest({ id: "a-pending", state: APPROVAL_STATES.PENDING, requesterId: "user-1" });
    db.addApprovalRequest({ id: "a-approved", state: APPROVAL_STATES.APPROVED, approverId: "user-2" });

    await expect(
      service.cancel({
        actorId: "user-2",
        id: "a-pending",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Only the requester can cancel.",
    });

    await expect(
      service.comment({
        actorId: "user-1",
        id: "a-approved",
        note: "Late note",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Terminal approvals are immutable.",
    });
  });

  it("rejects approving or rejecting when actor is not approver", async () => {
    const { db, service } = createService();

    db.addApprovalRequest({ id: "a-pending", state: APPROVAL_STATES.PENDING, approverId: "user-2" });
    await expect(
      service.approve({
        actorId: "user-1",
        id: "a-pending",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Only the assigned approver can approve.",
    });

    await expect(
      service.reject({
        actorId: "user-1",
        id: "a-pending",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Only the assigned approver can reject.",
    });
  });

  it("rejects submit for non-draft requests", async () => {
    const { db, service } = createService();

    for (const state of [
      APPROVAL_STATES.PENDING,
      APPROVAL_STATES.APPROVED,
      APPROVAL_STATES.REJECTED,
      APPROVAL_STATES.CANCELLED,
    ]) {
      const requestId = `state-${state.toLowerCase()}`;
      db.addApprovalRequest({ id: requestId, state, approverId: "user-2" });

      await expect(
        service.submit({ actorId: "user-1", id: requestId }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "Only draft approvals can be submitted.",
      });
    }
  });

  it("rejects approve/reject operations outside pending", async () => {
    const { db, service } = createService();

    for (const state of [APPROVAL_STATES.DRAFT, APPROVAL_STATES.APPROVED, APPROVAL_STATES.REJECTED, APPROVAL_STATES.CANCELLED]) {
      const requestId = `state-${state.toLowerCase()}-for-approve`;
      db.addApprovalRequest({ id: requestId, state, approverId: "user-2" });

      await expect(
        service.approve({
          actorId: "user-2",
          id: requestId,
        }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      await expect(
        service.reject({
          actorId: "user-2",
          id: requestId,
        }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    }
  });

  it("rejects approving, rejecting, and cancelling terminal requests", async () => {
    const { db, service } = createService();
    for (const state of [APPROVAL_STATES.APPROVED, APPROVAL_STATES.REJECTED, APPROVAL_STATES.CANCELLED]) {
      const requestId = `locked-${state.toLowerCase()}`;
      db.addApprovalRequest({ id: requestId, state, approverId: "user-2", requesterId: "user-1" });

      await expect(
        service.approve({
          actorId: "user-2",
          id: requestId,
        }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "Terminal approvals are immutable.",
      });
      await expect(
        service.reject({
          actorId: "user-2",
          id: requestId,
        }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "Terminal approvals are immutable.",
      });
      await expect(
        service.cancel({
          actorId: "user-1",
          id: requestId,
        }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "Terminal approvals are immutable.",
      });
      await expect(
        service.comment({
          actorId: "user-2",
          id: requestId,
          note: "Nope",
        }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "Terminal approvals are immutable.",
      });
    }
  });

  it("rejects comment from non-participants", async () => {
    const { db, service } = createService();
    db.addApprovalRequest({ id: "a-pending", state: APPROVAL_STATES.PENDING });

    await expect(
      service.comment({
        actorId: "stranger",
        id: "a-pending",
        note: "Nope",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Only request participants can comment.",
    });
  });
});

function getPostedBalanceForAccount(
  rows: TransactionRecord[],
  accountId: string,
): Prisma.Decimal {
  return rows
    .filter((row) => row.accountId === accountId && row.status === "POSTED")
    .reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal("0"));
}
