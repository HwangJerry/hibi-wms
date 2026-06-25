import { badRequest, notFound, writeAuditLog } from "@hibi/core";
import type { AuditLogTransaction } from "@hibi/core";
import {
  type Prisma,
  type PrismaClient,
  EntityType,
} from "@hibi/db";
import { FINANCIAL_APPROVAL_TRANSACTION_REFERENCE } from "../finance/index.js";
import {
  createNotification,
  NOTIFICATION_TYPES,
} from "../notifications/service.js";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

const APPROVAL_STATES = {
  DRAFT: "DRAFT" as const,
  PENDING: "PENDING" as const,
  APPROVED: "APPROVED" as const,
  REJECTED: "REJECTED" as const,
  CANCELLED: "CANCELLED" as const,
};
const APPROVAL_TYPES = {
  FINANCIAL: "FINANCIAL" as const,
  WORK: "WORK" as const,
};
const APPROVAL_ACTIONS = {
  SUBMIT: "SUBMIT" as const,
  APPROVE: "APPROVE" as const,
  REJECT: "REJECT" as const,
  CANCEL: "CANCEL" as const,
  COMMENT: "COMMENT" as const,
};

const TX_STATUSES = {
  PENDING: "PENDING" as const,
  POSTED: "POSTED" as const,
  REVERSED: "REVERSED" as const,
};

type TxStatus = (typeof TX_STATUSES)[keyof typeof TX_STATUSES];


type ApprovalRequestState = (typeof APPROVAL_STATES)[keyof typeof APPROVAL_STATES];
type ApprovalActionKind =
  | (typeof APPROVAL_ACTIONS)[keyof typeof APPROVAL_ACTIONS];
type ApprovalType = (typeof APPROVAL_TYPES)[keyof typeof APPROVAL_TYPES];

type ApprovalRequest = {
  id: string;
  type: ApprovalType;
  title: string;
  description: string | null;
  requesterId: string;
  approverId: string;
  state: ApprovalRequestState;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ApprovalAction = {
  id: string;
  requestId: string;
  actorId: string;
  action: ApprovalActionKind;
  note: string | null;
  createdAt: Date;
  actorName?: string;
};

type TransactionRecord = {
  id: string;
  status: TxStatus;
  approvalId: string | null;
  postedAt: Date | null;
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

type ApprovalRequestDelegate = {
  findMany(args: Prisma.ApprovalRequestFindManyArgs): Promise<Array<ApprovalRequest>>;
  findFirst(args: Prisma.ApprovalRequestFindFirstArgs): Promise<ApprovalRequest | null>;
  count(args: Prisma.ApprovalRequestCountArgs): Promise<number>;
  create(args: {
    data: Prisma.ApprovalRequestUncheckedCreateInput;
  }): Promise<ApprovalRequest>;
  update(args: {
    where: Prisma.ApprovalRequestWhereUniqueInput;
    data: Prisma.ApprovalRequestUncheckedUpdateInput;
  }): Promise<ApprovalRequest>;
};

type ApprovalActionDelegate = {
  create(args: {
    data: Prisma.ApprovalActionUncheckedCreateInput;
  }): Promise<ApprovalAction>;
};

type UserDelegate = {
  findMany(args: Prisma.UserFindManyArgs): Promise<Array<{ id: string; name: string }>>;
  findFirst(args: Prisma.UserFindFirstArgs): Promise<{ id: string } | null>;
};

type UserDirectory = Record<string, string>;

type ApprovalActionWithActor = ApprovalAction & {
  actorName: string;
};

type ApprovalRequestWithActions = ApprovalRequest & {
  actions: ApprovalActionWithActor[];
};

type ApprovalTransaction = {
  approvalRequest: ApprovalRequestDelegate;
  approvalAction: ApprovalActionDelegate;
  user: UserDelegate;
  notification?: {
    create(args: { data: Prisma.NotificationCreateInput }): Promise<Prisma.NotificationGetPayload<object>>;
  };
  transaction?: {
    findFirst(args: {
      where: {
        id?: string;
        approvalId?: string;
        status?: TxStatus;
      };
    }): Promise<TransactionRecord | null>;
    update(args: {
      where: { id: string };
      data: Partial<Pick<TransactionRecord, "status" | "postedAt">>;
    }): Promise<TransactionRecord>;
  };
  reference?: {
    findFirst(args: {
      where: {
        fromType: EntityType;
        fromId: string;
        toType: EntityType;
        relation: string;
      };
    }): Promise<ReferenceRecord | null>;
  };
} & AuditLogTransaction;

export type ApprovalServiceDb = {
  $transaction<T>(fn: (tx: ApprovalTransaction) => Promise<T>): Promise<T>;
  approvalRequest: ApprovalRequestDelegate;
  approvalAction: ApprovalActionDelegate;
  user: UserDelegate;
  transaction?: ApprovalTransaction["transaction"];
  reference?: ApprovalTransaction["reference"];
};

export type ListApprovalsInput = {
  actorId: string;
  state?: ApprovalRequestState;
  type?: ApprovalType;
  mine?: boolean;
  cursor?: string;
  limit?: number;
};

export type GetApprovalRequestInput = {
  id: string;
};

export type CreateApprovalRequestInput = {
  actorId: string;
  type: ApprovalType;
  title: string;
  description?: string | null;
  approverId?: string;
};

export type SubmitApprovalRequestInput = {
  actorId: string;
  id: string;
};

export type DecisionApprovalRequestInput = {
  actorId: string;
  id: string;
  note?: string | null;
};

export type CancelApprovalRequestInput = {
  actorId: string;
  id: string;
};

export type CommentApprovalRequestInput = {
  actorId: string;
  id: string;
  note: string;
};

export type ApprovalListResult = {
  items: Array<ApprovalRequest>;
  nextCursor?: string;
};

const TERMINAL_STATES = new Set<ApprovalRequestState>([
  APPROVAL_STATES.APPROVED,
  APPROVAL_STATES.REJECTED,
  APPROVAL_STATES.CANCELLED,
]);

export class ApprovalService {
  constructor(private readonly db: ApprovalServiceDb) {}

  async list(input: ListApprovalsInput): Promise<ApprovalListResult> {
    const limit = normalizeLimit(input.limit);
    const take = limit + 1;

    const requests = await this.db.approvalRequest.findMany({
      where: {
        state: input.state,
        type: input.type,
        ...(input.mine
          ? {
              OR: [
                { requesterId: input.actorId },
                { approverId: input.actorId },
              ],
            }
          : undefined),
      },
      orderBy: [
        { updatedAt: "desc" },
        { id: "desc" },
      ],
      take,
      cursor: input.cursor ? { id: input.cursor } : undefined,
      skip: input.cursor ? 1 : undefined,
    });

    return {
      items: requests.slice(0, limit),
      nextCursor: requests.length > limit ? requests.at(-1)?.id : undefined,
    };
  }

  async countPendingForUser(actorId: string) {
    return await this.db.approvalRequest.count({
      where: {
        state: APPROVAL_STATES.PENDING,
        OR: [
          { requesterId: actorId },
          { approverId: actorId },
        ],
      },
    });
  }

  async get(input: GetApprovalRequestInput) {
    const request = (await this.db.approvalRequest.findFirst({
      where: { id: input.id },
      include: {
        actions: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    })) as ApprovalRequestWithActions | null;

    if (!request) {
      throw notFound("Approval request not found.");
    }

    const requestActions = request.actions ?? [];
    const actorDirectory = await getUserDirectory(
      this.db,
      [request.requesterId, request.approverId, ...requestActions.map((action) => action.actorId)],
    );

    const actions: ApprovalActionWithActor[] = requestActions.map((action) => ({
      ...action,
      actorName: actorDirectory[action.actorId] ?? action.actorId,
    }));

    const actionsWithSubmit = ensureSubmitActionExists(
      request.id,
      request.requesterId,
      actorDirectory[request.requesterId] ?? request.requesterId,
      request.createdAt,
      request.type,
      actions,
    );

    return {
      ...request,
      actions: actionsWithSubmit,
      requesterName: actorDirectory[request.requesterId] ?? request.requesterId,
      approverName: actorDirectory[request.approverId] ?? request.approverId,
    };
  }

  async create(input: CreateApprovalRequestInput) {
    return await this.db.$transaction(async (tx) => {
      const approverId = await getApproverId(tx, input.actorId, input.approverId);

      const request = await tx.approvalRequest.create({
        data: {
          type: input.type,
          title: input.title,
          description: input.description,
          requesterId: input.actorId,
          approverId,
          state: APPROVAL_STATES.PENDING,
        },
      });

      await writeAuditLog(tx, {
        actorId: input.actorId,
        action: "approval.requested",
        entityType: EntityType.APPROVAL,
        entityId: request.id,
        data: {
          requestId: request.id,
          requesterId: request.requesterId,
          approverId: request.approverId,
          title: request.title,
          type: request.type,
          state: request.state,
        },
      });

      await createNotification(tx, {
        actorId: input.actorId,
        recipientId: approverId,
        type: NOTIFICATION_TYPES.APPROVAL_PENDING,
        entityType: EntityType.APPROVAL,
        entityId: request.id,
        title: "Approval pending",
        message: `${input.title}`,
        targetPath: `/approvals`,
      });

      return request;
    });
  }

  async submit(input: SubmitApprovalRequestInput) {
    return await this.db.$transaction(async (tx) => {
      const request = await getApprovalRequestOrThrow(tx, input.id);

      if (request.state !== APPROVAL_STATES.DRAFT) {
        throw badRequest("Only draft approvals can be submitted.");
      }

      const updated = await tx.approvalRequest.update({
        where: { id: request.id },
        data: {
          state: APPROVAL_STATES.PENDING,
        },
      });

      await recordApprovalAction(tx, {
        requestId: request.id,
        actorId: input.actorId,
        action: APPROVAL_ACTIONS.SUBMIT,
      });

      await writeAuditLog(tx, {
        actorId: input.actorId,
        action: "approval.submitted",
        entityType: EntityType.APPROVAL,
        entityId: request.id,
        data: {
          requestId: request.id,
          previousState: request.state,
          nextState: updated.state,
        },
      });

      return updated;
    });
  }

  async approve(input: DecisionApprovalRequestInput) {
    return await this.db.$transaction(async (tx) => {
      const request = await getApprovalRequestOrThrow(tx, input.id);
      assertRequestMutable(request);

      if (request.approverId !== input.actorId) {
        throw badRequest("Only the assigned approver can approve.");
      }

      if (request.state !== APPROVAL_STATES.PENDING) {
        throw badRequest("Only pending approvals can be approved.");
      }

      const updated = await tx.approvalRequest.update({
        where: { id: request.id },
        data: {
          state: APPROVAL_STATES.APPROVED,
          decidedAt: new Date(),
        },
      });

      await recordApprovalAction(tx, {
        requestId: request.id,
        actorId: input.actorId,
        action: APPROVAL_ACTIONS.APPROVE,
        note: input.note,
      });

      await writeAuditLog(tx, {
        actorId: input.actorId,
        action: "approval.approved",
        entityType: EntityType.APPROVAL,
        entityId: request.id,
        data: {
          requestId: request.id,
          previousState: request.state,
          nextState: updated.state,
          note: input.note ?? null,
        },
      });

      await maybePostLinkedFinancialTransaction(tx, {
        approvalId: updated.id,
        requestType: updated.type,
        actorId: input.actorId,
      });

      return updated;
    });
  }

  async reject(input: DecisionApprovalRequestInput) {
    return await this.db.$transaction(async (tx) => {
      const request = await getApprovalRequestOrThrow(tx, input.id);
      assertRequestMutable(request);

      if (request.approverId !== input.actorId) {
        throw badRequest("Only the assigned approver can reject.");
      }

      if (request.state !== APPROVAL_STATES.PENDING) {
        throw badRequest("Only pending approvals can be rejected.");
      }

      const updated = await tx.approvalRequest.update({
        where: { id: request.id },
        data: {
          state: APPROVAL_STATES.REJECTED,
          decidedAt: new Date(),
        },
      });

      await recordApprovalAction(tx, {
        requestId: request.id,
        actorId: input.actorId,
        action: APPROVAL_ACTIONS.REJECT,
        note: input.note,
      });

      await writeAuditLog(tx, {
        actorId: input.actorId,
        action: "approval.rejected",
        entityType: EntityType.APPROVAL,
        entityId: request.id,
        data: {
          requestId: request.id,
          previousState: request.state,
          nextState: updated.state,
          note: input.note ?? null,
        },
      });

      return updated;
    });
  }

  async cancel(input: CancelApprovalRequestInput) {
    return await this.db.$transaction(async (tx) => {
      const request = await getApprovalRequestOrThrow(tx, input.id);
      assertRequestMutable(request);

      if (request.requesterId !== input.actorId) {
        throw badRequest("Only the requester can cancel.");
      }

      if (request.state !== APPROVAL_STATES.PENDING) {
        throw badRequest("Only pending approvals can be cancelled.");
      }

      const updated = await tx.approvalRequest.update({
        where: { id: request.id },
        data: {
          state: APPROVAL_STATES.CANCELLED,
          decidedAt: new Date(),
        },
      });

      await recordApprovalAction(tx, {
        requestId: request.id,
        actorId: input.actorId,
        action: APPROVAL_ACTIONS.CANCEL,
      });

      await writeAuditLog(tx, {
        actorId: input.actorId,
        action: "approval.cancelled",
        entityType: EntityType.APPROVAL,
        entityId: request.id,
        data: {
          requestId: request.id,
          previousState: request.state,
          nextState: updated.state,
        },
      });

      return updated;
    });
  }

  async comment(input: CommentApprovalRequestInput) {
    return await this.db.$transaction(async (tx) => {
      const request = await getApprovalRequestOrThrow(tx, input.id);
      if (!isRequesterOrApprover(input.actorId, request)) {
        throw badRequest("Only request participants can comment.");
      }

      assertRequestMutable(request);

      await recordApprovalAction(tx, {
        requestId: request.id,
        actorId: input.actorId,
        action: APPROVAL_ACTIONS.COMMENT,
        note: input.note,
      });

      await writeAuditLog(tx, {
        actorId: input.actorId,
        action: "approval.commented",
        entityType: EntityType.APPROVAL,
        entityId: request.id,
        data: {
          requestId: request.id,
          state: request.state,
          note: input.note,
        },
      });

      return request;
    });
  }
}

export function createApprovalService(db: ApprovalServiceDb | PrismaClient) {
  return new ApprovalService(db as ApprovalServiceDb);
}

function normalizeLimit(limit?: number) {
  if (limit === undefined) {
    return DEFAULT_LIST_LIMIT;
  }

  return Math.min(Math.max(limit, 1), MAX_LIST_LIMIT);
}

async function getApprovalRequestOrThrow(
  tx: Pick<ApprovalTransaction, "approvalRequest">,
  id: string,
) {
  const request = await tx.approvalRequest.findFirst({
    where: { id },
  });

  if (!request) {
    throw notFound("Approval request not found.");
  }

  return request;
}

function normalizeUserDirectory(
  rows: Array<{ id: string; name: string }>,
): UserDirectory {
  return rows.reduce<UserDirectory>((accumulator, user) => {
    accumulator[user.id] = user.name;
    return accumulator;
  }, {});
}

async function getUserDirectory(
  tx: Pick<ApprovalTransaction, "user">,
  ids: string[],
) {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) {
    return {} as UserDirectory;
  }

  const users = await tx.user.findMany({
    where: {
      id: {
        in: uniqueIds,
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  return normalizeUserDirectory(users);
}

function ensureSubmitActionExists(
  requestId: string,
  requesterId: string,
  requesterName: string,
  createdAt: Date,
  requestType: ApprovalType,
  actions: ApprovalActionWithActor[],
): ApprovalActionWithActor[] {
  const hasSubmitAction = actions.some((action) => action.action === APPROVAL_ACTIONS.SUBMIT);
  if (hasSubmitAction) {
    return actions;
  }

  return [
    {
      id: `${requestId}-submitted`,
      requestId,
      actorId: requesterId,
      actorName: requesterName,
      action: APPROVAL_ACTIONS.SUBMIT,
      note: requestType === APPROVAL_TYPES.FINANCIAL
        ? "Submitted for financial review."
        : "Submitted for review.",
      createdAt,
    },
    ...actions,
  ];
}

async function getApproverId(
  tx: Pick<ApprovalTransaction, "user">,
  requesterId: string,
  approverId?: string,
) {
  if (approverId) {
    if (approverId === requesterId) {
      throw badRequest("Approver must be different from the requester.");
    }

    const matchingUser = await tx.user.findFirst({
      where: { id: approverId },
      select: { id: true },
    });

    if (!matchingUser) {
      throw badRequest("Approver not found.");
    }

    return approverId;
  }

  const candidates = await tx.user.findMany({
    where: {
      id: {
        not: requesterId,
      },
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 1,
  });

  if (candidates.length === 0) {
    throw badRequest("No alternative approver found.");
  }

  const [candidate] = candidates;
  if (!candidate) {
    throw badRequest("No alternative approver found.");
  }

  return candidate.id;
}

function assertRequestMutable(request: ApprovalRequest) {
  if (TERMINAL_STATES.has(request.state)) {
    throw badRequest("Terminal approvals are immutable.");
  }
}

function isRequesterOrApprover(actorId: string, request: ApprovalRequest) {
  return request.requesterId === actorId || request.approverId === actorId;
}

async function recordApprovalAction(
  tx: Pick<ApprovalTransaction, "approvalAction">,
  input: {
    requestId: string;
    actorId: string;
    action: ApprovalActionKind;
    note?: string | null;
  },
) {
  await tx.approvalAction.create({
    data: {
      requestId: input.requestId,
      actorId: input.actorId,
      action: input.action,
      note: input.note,
    },
  });
}

async function maybePostLinkedFinancialTransaction(
  tx: Pick<ApprovalTransaction, "transaction" | "reference" | "auditLog">,
  input: {
    approvalId: string;
    requestType: ApprovalType;
    actorId: string;
  },
) {
  if (input.requestType !== APPROVAL_TYPES.FINANCIAL) {
    return;
  }

  if (!tx.reference || !tx.transaction) {
    return;
  }

  const reference = await tx.reference.findFirst({
    where: {
      fromType: EntityType.APPROVAL,
      fromId: input.approvalId,
      toType: EntityType.TRANSACTION,
      relation: FINANCIAL_APPROVAL_TRANSACTION_REFERENCE,
    },
  });

  if (!reference) {
    return;
  }

  const transaction = await tx.transaction.findFirst({
    where: {
      id: reference.toId,
      status: TX_STATUSES.PENDING,
    },
  });

  if (!transaction) {
    return;
  }

  const updated = await tx.transaction.update({
    where: { id: transaction.id },
    data: {
      status: TX_STATUSES.POSTED,
      postedAt: new Date(),
    },
  });

  await writeAuditLog(tx, {
    actorId: input.actorId,
    action: "finance.transaction.posted",
    entityType: EntityType.TRANSACTION,
    entityId: updated.id,
    data: {
      approvalId: input.approvalId,
      previousStatus: transaction.status,
      nextStatus: updated.status,
    },
  });
}
