import { badRequest, createReference, notFound, writeAuditLog } from "@hibi/core";
import { EntityType, Prisma } from "@hibi/db";
import type { PrismaClient } from "@hibi/db";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;
const APPROVAL_TYPE_FINANCIAL = "FINANCIAL" as const;
const APPROVAL_STATES_APPROVED = "APPROVED" as const;
export const FINANCIAL_APPROVAL_TRANSACTION_REFERENCE = "finance.approval.transaction" as const;
const APPROVAL_THRESHOLD_ENV = "FINANCE_APPROVAL_THRESHOLD";
const MAX_DECIMAL_PLACES = 2;
const CURRENCY_LENGTH = 3;
const ZERO_DECIMAL = "0";
const FINANCE_AUDIT_VERSION = 1;

const TX_STATUSES = {
  PENDING: "PENDING" as const,
  POSTED: "POSTED" as const,
  REVERSED: "REVERSED" as const,
} as const;

type TxStatus = (typeof TX_STATUSES)[keyof typeof TX_STATUSES];

type AccountKind = "CASH" | "BANK" | "CARD" | "OTHER";
type CategoryKind = "INCOME" | "EXPENSE";

const ACCOUNT_KINDS: ReadonlyArray<AccountKind> = ["CASH", "BANK", "CARD", "OTHER"];
const CATEGORY_KINDS: ReadonlyArray<CategoryKind> = ["INCOME", "EXPENSE"];

const DECIMAL_RE = /^\d+(?:\.\d{1,2})?$/;

type PaginationInput = {
  cursor?: string;
  limit?: number;
};

type AccountRecord = {
  id: string;
  name: string;
  kind: AccountKind;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
};

type CategoryRecord = {
  id: string;
  name: string;
  kind: CategoryKind;
  createdAt: Date;
  updatedAt: Date;
};

type BudgetRecord = {
  id: string;
  categoryId: string;
  periodStart: Date;
  periodEnd: Date;
  limit: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
};

type TransactionRecord = {
  id: string;
  accountId: string;
  categoryId: string | null;
  amount: Prisma.Decimal;
  currency: string;
  description: string | null;
  status: TxStatus;
  approvalId: string | null;
  occurredAt: Date;
  postedAt: Date | null;
  reversedById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ApprovalRequestRecord = {
  id: string;
  type: string;
  state: string;
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

type AuditLogRecord = Prisma.AuditLogGetPayload<object>;
type FinanceAuditResource = "account" | "category" | "budget" | "transaction";

type FinanceAuditPayload = {
  version: number;
  module: "finance";
  operation: string;
  resourceType: FinanceAuditResource;
  resourceId: string;
  details: Prisma.InputJsonObject;
};

type BaseFindArgs = {
  where?: Record<string, unknown>;
  orderBy?:
    | {
        id?: "asc" | "desc";
        occurredAt?: "asc" | "desc";
      }
    | Array<{ id?: "asc" | "desc"; occurredAt?: "asc" | "desc" }>;
  take?: number;
  cursor?: {
    id: string;
  };
  skip?: number;
};

export type FinanceServiceDb = {
  $transaction<T>(fn: (tx: FinanceServiceDb) => Promise<T>): Promise<T>;
  account: {
    findMany(args: BaseFindArgs): Promise<AccountRecord[]>;
    findFirst(args: { where: { id: string } }): Promise<AccountRecord | null>;
    create(args: { data: { name: string; kind: AccountKind; currency: string } }): Promise<AccountRecord>;
    update(args: {
      where: { id: string };
      data: Partial<Pick<AccountRecord, "name" | "kind" | "currency">>;
    }): Promise<AccountRecord>;
    delete(args: { where: { id: string } }): Promise<AccountRecord>;
  };
  category: {
    findMany(args: BaseFindArgs): Promise<CategoryRecord[]>;
    findFirst(args: { where: { id: string } }): Promise<CategoryRecord | null>;
    create(args: { data: { name: string; kind: CategoryKind } }): Promise<CategoryRecord>;
    update(args: {
      where: { id: string };
      data: Partial<Pick<CategoryRecord, "name" | "kind">>;
    }): Promise<CategoryRecord>;
    delete(args: { where: { id: string } }): Promise<CategoryRecord>;
  };
  budget: {
    findMany(args: BaseFindArgs): Promise<BudgetRecord[]>;
    findFirst(args: { where: { id?: string; categoryId?: string } }): Promise<BudgetRecord | null>;
    create(args: {
      data: {
        categoryId: string;
        periodStart: Date;
        periodEnd: Date;
        limit: Prisma.Decimal;
      };
    }): Promise<BudgetRecord>;
    update(args: {
      where: { id: string };
      data: Partial<Pick<BudgetRecord, "categoryId" | "periodStart" | "periodEnd" | "limit">>;
    }): Promise<BudgetRecord>;
    delete(args: { where: { id: string } }): Promise<BudgetRecord>;
  };
  transaction: {
    findMany(args: BaseFindArgs): Promise<TransactionRecord[]>;
    findFirst(args: {
      where: {
        id?: string;
        approvalId?: string;
        status?: TxStatus;
        accountId?: string;
        categoryId?: string;
        occurredAt?: {
          gte?: Date;
          lte?: Date;
        };
      };
    }): Promise<TransactionRecord | null>;
    create(args: {
      data: {
        accountId: string;
        categoryId: string | null;
        amount: Prisma.Decimal;
        currency: string;
        description: string | null;
        status: TxStatus;
        approvalId: string | null;
        occurredAt: Date;
        postedAt: Date | null;
        reversedById: string | null;
      };
    }): Promise<TransactionRecord>;
    update(args: {
      where: { id: string };
      data: Partial<
        Pick<
          TransactionRecord,
          | "categoryId"
          | "status"
          | "amount"
          | "currency"
          | "description"
          | "approvalId"
          | "occurredAt"
          | "postedAt"
          | "reversedById"
        >
      >;
    }): Promise<TransactionRecord>;
  };
  approvalRequest: {
    create(args: {
      data: {
        type: string;
        title: string;
        description?: string | null;
        requesterId: string;
        approverId: string;
        state?: string;
      };
    }): Promise<ApprovalRequestRecord>;
    findFirst(args: { where: { id: string } }): Promise<ApprovalRequestRecord | null>;
  };
  user: {
    findMany(args: { where: { id?: { not: string } } }): Promise<Array<{ id: string }>>;
  };
  reference: {
    create(args: {
      data: {
        fromType: EntityType;
        fromId: string;
        toType: EntityType;
        toId: string;
        relation: string;
      };
    }): Promise<ReferenceRecord>;
    findFirst(args: {
      where: {
        fromType?: EntityType;
        fromId?: string;
        toType?: EntityType;
        toId?: string;
        relation?: string;
      };
    }): Promise<ReferenceRecord | null>;
    findMany(args: Prisma.ReferenceFindManyArgs): Promise<ReferenceRecord[]>;
  };
  auditLog: {
    create(args: {
      data: Prisma.AuditLogCreateInput;
    }): Promise<AuditLogRecord>;
  };
};

type ListResult<T> = {
  items: T[];
  nextCursor?: string;
};

export type CreateAccountInput = {
  actorId: string;
  name: string;
  kind: AccountKind;
  currency: string;
};

export type UpdateAccountInput = {
  actorId: string;
  id: string;
  patch: {
    name?: string;
    kind?: AccountKind;
    currency?: string;
  };
};

export type CreateCategoryInput = {
  actorId: string;
  name: string;
  kind: CategoryKind;
};

export type UpdateCategoryInput = {
  actorId: string;
  id: string;
  patch: {
    name?: string;
    kind?: CategoryKind;
  };
};

export type CreateBudgetInput = {
  actorId: string;
  categoryId: string;
  periodStart: Date;
  periodEnd: Date;
  limit: Prisma.Decimal;
};

export type UpdateBudgetInput = {
  actorId: string;
  id: string;
  patch: {
    categoryId?: string;
    periodStart?: Date;
    periodEnd?: Date;
    limit?: Prisma.Decimal;
  };
};

export type TransactionRangeInput = {
  from?: Date;
  to?: Date;
};

export type ReportPeriodInput = {
  periodStart: Date;
  periodEnd: Date;
};

type AccountBalanceItem = {
  accountId: string;
  currency: string;
  balance: Prisma.Decimal;
};

export type BudgetVsActualItem = {
  budgetId: string;
  categoryId: string;
  periodStart: Date;
  periodEnd: Date;
  limit: Prisma.Decimal;
  actual: Prisma.Decimal;
};

export type CreateTransactionInput = {
  actorId: string;
  accountId: string;
  categoryId?: string | null;
  amount: Prisma.Decimal;
  isFlagged?: boolean;
  reason?: string | null;
  occurredAt: Date;
};

export type ReverseTransactionInput = {
  actorId: string;
  id: string;
  reason: string;
};

export type FinalizeApprovalInput = {
  actorId: string;
  approvalId: string;
};

export type ListTransactionsInput = PaginationInput & {
  accountId?: string;
  categoryId?: string;
  status?: TxStatus;
  range?: TransactionRangeInput;
};

export class FinanceService {
  constructor(private readonly db: FinanceServiceDb) {}

  async listAccounts(input: PaginationInput): Promise<ListResult<AccountRecord>> {
    return await this.listWithCursor((args) => this.db.account.findMany(args), input);
  }

  async listCategories(input: PaginationInput): Promise<ListResult<CategoryRecord>> {
    return await this.listWithCursor((args) => this.db.category.findMany(args), input);
  }

  async listBudgets(input: PaginationInput): Promise<ListResult<BudgetRecord>> {
    return await this.listWithCursor((args) => this.db.budget.findMany(args), input);
  }

  async createAccount(input: CreateAccountInput) {
    validateAccountKind(input.kind);
    validateCurrencyCode(input.currency);

    return await this.db.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          name: input.name,
          kind: input.kind,
          currency: input.currency,
        },
      });

      await writeStandardFinanceAuditLog(tx, {
        actorId: input.actorId,
        action: "finance.account.created",
        entityType: EntityType.TRANSACTION,
        entityId: account.id,
        resourceType: "account",
        details: {
          accountId: account.id,
          name: account.name,
          kind: account.kind,
          currency: account.currency,
        },
      });

      return account;
    });
  }

  async updateAccount(input: UpdateAccountInput) {
    await this.db.$transaction(async (tx) => {
      await getAccountOrThrow(tx, input.id);
      if (input.patch.kind !== undefined) {
        validateAccountKind(input.patch.kind);
      }
      if (input.patch.currency !== undefined) {
        validateCurrencyCode(input.patch.currency);
      }

      return await tx.account.update({
        where: { id: input.id },
        data: input.patch,
      });
    });

    return this.db.account.findFirst({ where: { id: input.id } });
  }

  async deleteAccount(input: { actorId: string; id: string }) {
    return await this.db.$transaction(async (tx) => {
      const account = await getAccountOrThrow(tx, input.id);
      const deleted = await tx.account.delete({ where: { id: input.id } });

      await writeStandardFinanceAuditLog(tx, {
        actorId: input.actorId,
        action: "finance.account.deleted",
        entityType: EntityType.TRANSACTION,
        entityId: deleted.id,
        resourceType: "account",
        details: {
          accountId: deleted.id,
          accountCurrency: account.currency,
        },
      });

      return deleted;
    });
  }

  async createCategory(input: CreateCategoryInput) {
    validateCategoryKind(input.kind);

    return await this.db.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          name: input.name,
          kind: input.kind,
        },
      });

      await writeStandardFinanceAuditLog(tx, {
        actorId: input.actorId,
        action: "finance.category.created",
        entityType: EntityType.TRANSACTION,
        entityId: category.id,
        resourceType: "category",
        details: {
          categoryId: category.id,
          name: category.name,
          kind: category.kind,
        },
      });

      return category;
    });
  }

  async updateCategory(input: UpdateCategoryInput) {
    return await this.db.$transaction(async (tx) => {
      await getCategoryOrThrow(tx, input.id);
      if (input.patch.kind !== undefined) {
        validateCategoryKind(input.patch.kind);
      }

      return await tx.category.update({
        where: { id: input.id },
        data: input.patch,
      });
    });
  }

  async deleteCategory(input: { actorId: string; id: string }) {
    return await this.db.$transaction(async (tx) => {
      await getCategoryOrThrow(tx, input.id);
      const category = await tx.category.delete({ where: { id: input.id } });

      await writeStandardFinanceAuditLog(tx, {
        actorId: input.actorId,
        action: "finance.category.deleted",
        entityType: EntityType.TRANSACTION,
        entityId: category.id,
        resourceType: "category",
        details: {
          categoryId: category.id,
          kind: category.kind,
        },
      });

      return category;
    });
  }

  async createBudget(input: CreateBudgetInput) {
    validateDecimal(input.limit, "limit");

    return await this.db.$transaction(async (tx) => {
      await getCategoryOrThrow(tx, input.categoryId);
      if (input.periodEnd.getTime() <= input.periodStart.getTime()) {
        throw badRequest("periodEnd must be after periodStart.");
      }

      const budget = await tx.budget.create({
        data: {
          categoryId: input.categoryId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          limit: input.limit,
        },
      });

      await writeStandardFinanceAuditLog(tx, {
        actorId: input.actorId,
        action: "finance.budget.created",
        entityType: EntityType.TRANSACTION,
        entityId: budget.id,
        resourceType: "budget",
        details: {
          budgetId: budget.id,
          categoryId: budget.categoryId,
          limit: budget.limit.toString(),
        },
      });

      return budget;
    });
  }

  async updateBudget(input: UpdateBudgetInput) {
    return await this.db.$transaction(async (tx) => {
      const existing = await getBudgetOrThrow(tx, input.id);
      if (input.patch.categoryId !== undefined) {
        await getCategoryOrThrow(tx, input.patch.categoryId);
      }
      if (input.patch.limit !== undefined) {
        validateDecimal(input.patch.limit, "limit");
      }
      if (input.patch.periodStart !== undefined || input.patch.periodEnd !== undefined) {
        const periodStart = input.patch.periodStart ?? existing.periodStart;
        const periodEnd = input.patch.periodEnd ?? existing.periodEnd;

        if (periodEnd.getTime() <= periodStart.getTime()) {
          throw badRequest("periodEnd must be after periodStart.");
        }
      }

      return await tx.budget.update({
        where: { id: input.id },
        data: input.patch,
      });
    });
  }

  async deleteBudget(input: { actorId: string; id: string }) {
    return await this.db.$transaction(async (tx) => {
      const budget = await getBudgetOrThrow(tx, input.id);
      const deleted = await tx.budget.delete({ where: { id: input.id } });

      await writeStandardFinanceAuditLog(tx, {
        actorId: input.actorId,
        action: "finance.budget.deleted",
        entityType: EntityType.TRANSACTION,
        entityId: deleted.id,
        resourceType: "budget",
        details: {
          budgetId: deleted.id,
          categoryId: budget.categoryId,
        },
      });

      return deleted;
    });
  }

  async listTransactions(input: ListTransactionsInput): Promise<ListResult<TransactionRecord>> {
    const rows = await this.db.transaction.findMany({
      where: normalizeTransactionWhere(input),
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: normalizeLimit(input.limit),
      cursor: input.cursor ? { id: input.cursor } : undefined,
      skip: input.cursor ? 1 : undefined,
    });

    const limit = normalizeLimit(input.limit);
    const items = rows.slice(0, limit);
    return {
      items,
      nextCursor: rows.length > limit ? items.at(-1)?.id : undefined,
    };
  }

  async createTransaction(input: CreateTransactionInput): Promise<TransactionRecord> {
    validateDecimalAmount(input.amount);

    return await this.db.$transaction(async (tx) => {
      const account = await getAccountOrThrow(tx, input.accountId);
      validateCurrencyCode(account.currency);
      if (input.categoryId !== null && input.categoryId !== undefined) {
        await getCategoryOrThrow(tx, input.categoryId);
      }

      const amount = normalizeAmount(input.amount);
      const needsApproval = calculateIfNeedsApproval(tx, amount, Boolean(input.isFlagged));

      const approval = needsApproval
        ? await tx.approvalRequest.create({
            data: {
              type: APPROVAL_TYPE_FINANCIAL,
              title: `Financial transaction for ${account.id}`,
              description: input.reason,
              requesterId: input.actorId,
              approverId: await getFinanceApproverId(tx, input.actorId),
              state: "PENDING",
            },
          })
        : null;

      const transaction = await tx.transaction.create({
        data: {
          accountId: account.id,
          categoryId: input.categoryId ?? null,
          amount,
          currency: account.currency,
          description: input.reason ?? null,
          status: TX_STATUSES.PENDING,
          approvalId: approval?.id ?? null,
          occurredAt: input.occurredAt,
          postedAt: null,
          reversedById: null,
        },
      });

      if (approval !== null) {
        await createReference(tx, {
          from: {
            type: EntityType.APPROVAL,
            id: approval.id,
          },
          to: {
            type: EntityType.TRANSACTION,
            id: transaction.id,
          },
          relation: FINANCIAL_APPROVAL_TRANSACTION_REFERENCE,
        });
      }

      await writeStandardFinanceAuditLog(tx, {
        actorId: input.actorId,
        action: "finance.transaction.created",
        entityType: EntityType.TRANSACTION,
        entityId: transaction.id,
        resourceType: "transaction",
        details: {
          accountId: transaction.accountId,
          categoryId: transaction.categoryId,
          amount: transaction.amount.toString(),
          status: transaction.status,
          approvalId: transaction.approvalId,
          needsApproval,
        },
      });

      return transaction;
    });
  }

  async finalizeApprovedTransaction(input: FinalizeApprovalInput): Promise<TransactionRecord> {
    return await this.db.$transaction(async (tx) => {
      const request = await tx.approvalRequest.findFirst({ where: { id: input.approvalId } });
      if (!request) {
        throw notFound("Approval request not found.");
      }

      if (request.type !== APPROVAL_TYPE_FINANCIAL) {
        throw badRequest("Only financial approvals can finalize transactions.");
      }
      if (request.state !== APPROVAL_STATES_APPROVED) {
        throw badRequest("Approval request is not approved.");
      }

      const transaction = await resolveTransactionByApproval(tx, input.approvalId);
      if (!transaction) {
        throw notFound("Pending transaction not found for this approval.");
      }

      if (transaction.status === TX_STATUSES.POSTED) {
        return transaction;
      }

      const updated = await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TX_STATUSES.POSTED,
          postedAt: new Date(),
        },
      });

      await writeStandardFinanceAuditLog(tx, {
        actorId: input.actorId,
        action: "finance.transaction.posted",
        entityType: EntityType.TRANSACTION,
        entityId: updated.id,
        resourceType: "transaction",
        details: {
          approvalId: request.id,
          previousStatus: transaction.status,
          nextStatus: updated.status,
        },
      });

      return updated;
    });
  }

  async reverseTransaction(input: ReverseTransactionInput) {
    return await this.db.$transaction(async (tx) => {
      const original = await getTransactionOrThrow(tx, input.id);
      if (original.status !== TX_STATUSES.POSTED) {
        throw badRequest("Only posted transactions can be reversed.");
      }
      if (original.reversedById !== null) {
        throw badRequest("Transaction is already reversed.") ;
      }

      const reversal = await tx.transaction.create({
        data: {
          accountId: original.accountId,
          categoryId: original.categoryId,
          amount: original.amount.neg(),
          currency: original.currency,
          description: `Reversal of ${original.id}: ${input.reason}`,
          status: TX_STATUSES.POSTED,
          approvalId: null,
          occurredAt: original.occurredAt,
          postedAt: new Date(),
          reversedById: null,
        },
      });

      const updated = await tx.transaction.update({
        where: { id: original.id },
        data: {
          status: TX_STATUSES.REVERSED,
          reversedById: reversal.id,
        },
      });

      await writeStandardFinanceAuditLog(tx, {
        actorId: input.actorId,
        action: "finance.transaction.reversed",
        entityType: EntityType.TRANSACTION,
        entityId: original.id,
        resourceType: "transaction",
        details: {
          fromStatus: original.status,
          toStatus: updated.status,
          originalTransactionId: original.id,
          reversalTransactionId: reversal.id,
          reversalAmount: reversal.amount.toString(),
          reason: input.reason,
        },
      });

      return reversal;
    });
  }

  async accountBalances(): Promise<{ items: AccountBalanceItem[] }> {
    const rows = await this.db.transaction.findMany({
      where: {
        status: TX_STATUSES.POSTED,
      },
    });

    const balances = rows.reduce((accumulator, transaction) => {
      const current = accumulator.get(transaction.accountId);
      accumulator.set(transaction.accountId, {
        accountId: transaction.accountId,
        currency: transaction.currency,
        balance: (current?.balance ?? new Prisma.Decimal(ZERO_DECIMAL)).plus(transaction.amount),
      });
      return accumulator;
    }, new Map<string, AccountBalanceItem>());

    return {
      items: Array.from(balances.values()).sort((left, right) =>
        left.accountId.localeCompare(right.accountId),
      ),
    };
  }

  async budgetVsActual(input: ReportPeriodInput): Promise<{ period: ReportPeriodInput; items: BudgetVsActualItem[] }> {
    if (input.periodEnd.getTime() <= input.periodStart.getTime()) {
      throw badRequest("periodEnd must be after periodStart.");
    }

    const budgets = await this.db.budget.findMany({
      orderBy: { id: "asc" },
    });
    const expenseBudgets: BudgetRecord[] = [];
    for (const budget of budgets) {
      if (!isOverlappingPeriod({
        budgetStart: budget.periodStart,
        budgetEnd: budget.periodEnd,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      })) {
        continue;
      }

      const category = await getCategoryOrThrow(this.db, budget.categoryId);
      if (category.kind !== "EXPENSE") {
        continue;
      }

      expenseBudgets.push(budget);
    }

    const postedTransactions = await this.db.transaction.findMany({
      where: {
        status: TX_STATUSES.POSTED,
        occurredAt: {
          gte: input.periodStart,
          lte: input.periodEnd,
        },
      },
    });

    const expenseCategoryIds = new Set(expenseBudgets.map((budget) => budget.categoryId));
    const actualByCategory = postedTransactions.reduce((accumulator, tx) => {
      if (tx.categoryId === null || !expenseCategoryIds.has(tx.categoryId)) {
        return accumulator;
      }

      const nextActual = (accumulator.get(tx.categoryId) ?? new Prisma.Decimal(ZERO_DECIMAL)).plus(tx.amount);
      accumulator.set(tx.categoryId, nextActual);
      return accumulator;
    }, new Map<string, Prisma.Decimal>());

    const items = expenseBudgets.map((budget) => ({
      budgetId: budget.id,
      categoryId: budget.categoryId,
      periodStart: budget.periodStart,
      periodEnd: budget.periodEnd,
      limit: budget.limit,
      actual: actualByCategory.get(budget.categoryId) ?? new Prisma.Decimal(ZERO_DECIMAL),
    }));

    return {
      period: {
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      },
      items,
    };
  }

  private async listWithCursor<TEntity extends { id: string }>(
    findMany: (args: BaseFindArgs) => Promise<TEntity[]>,
    input: PaginationInput,
  ): Promise<ListResult<TEntity>> {
    const limit = normalizeLimit(input.limit);
    const rows = await findMany({
      take: limit + 1,
      orderBy: {
        id: "asc",
      },
      cursor: input.cursor ? { id: input.cursor } : undefined,
      skip: input.cursor ? 1 : undefined,
    });

    const items = rows.slice(0, limit);
    return {
      items,
      nextCursor: rows.length > limit ? items.at(-1)?.id : undefined,
    };
  }
}

function createFinanceAuditPayload(
  action: string,
  resourceType: FinanceAuditResource,
  resourceId: string,
  details: Prisma.InputJsonObject,
): FinanceAuditPayload {
  return {
    version: FINANCE_AUDIT_VERSION,
    module: "finance",
    operation: action.replace("finance.", ""),
    resourceType,
    resourceId,
    details,
  };
}

async function writeStandardFinanceAuditLog(
  tx: FinanceServiceDb,
  params: {
    actorId: string;
    action: string;
    entityType: EntityType;
    entityId: string;
    resourceType: FinanceAuditResource;
    details: Prisma.InputJsonObject;
  },
) {
  await writeAuditLog(tx, {
    actorId: params.actorId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    data: createFinanceAuditPayload(params.action, params.resourceType, params.entityId, params.details),
  });
}

export function createFinanceService(db: FinanceServiceDb | PrismaClient) {
  return new FinanceService(db as FinanceServiceDb);
}

function normalizeLimit(limit?: number) {
  if (limit === undefined) {
    return DEFAULT_LIST_LIMIT;
  }

  return Math.min(Math.max(limit, 1), MAX_LIST_LIMIT);
}

function validateCurrencyCode(currency: string) {
  if (currency.trim().length !== CURRENCY_LENGTH) {
    throw badRequest("currency must be a 3-letter code.");
  }
}

function validateAccountKind(kind: AccountKind) {
  if (!ACCOUNT_KINDS.includes(kind)) {
    throw badRequest(`Invalid account kind: ${kind}`);
  }
}

function validateCategoryKind(kind: CategoryKind) {
  if (!CATEGORY_KINDS.includes(kind)) {
    throw badRequest(`Invalid category kind: ${kind}`);
  }
}

function validateDecimal(input: Prisma.Decimal, fieldName: string) {
  if (!input.isFinite() || input.isNaN()) {
    throw badRequest(`${fieldName} must be a valid decimal.`);
  }
  if (input.decimalPlaces() > MAX_DECIMAL_PLACES) {
    throw badRequest(`${fieldName} must have at most ${MAX_DECIMAL_PLACES} decimals.`);
  }
  if (input.lt(0)) {
    throw badRequest(`${fieldName} must be non-negative.`);
  }
}

function validateDecimalAmount(input: Prisma.Decimal) {
  if (!DECIMAL_RE.test(input.toString())) {
    throw badRequest("Amount must be decimal with at most two places.");
  }
  if (input.lte(0)) {
    throw badRequest("Amount must be greater than zero.");
  }
}

function normalizeAmount(input: Prisma.Decimal) {
  return input;
}

function normalizeTransactionWhere(input: ListTransactionsInput) {
  if (input.accountId === undefined && input.categoryId === undefined && input.status === undefined && input.range === undefined) {
    return {};
  }

  return {
    accountId: input.accountId,
    categoryId: input.categoryId,
    status: input.status,
    occurredAt: input.range === undefined ? undefined : {
      gte: input.range.from,
      lte: input.range.to,
    },
  };
}

function isOverlappingPeriod(input: {
  budgetStart: Date;
  budgetEnd: Date;
  periodStart: Date;
  periodEnd: Date;
}): boolean {
  return input.budgetStart <= input.periodEnd && input.budgetEnd >= input.periodStart;
}

function calculateIfNeedsApproval(
  _tx: FinanceServiceDb,
  amount: Prisma.Decimal,
  isFlagged: boolean,
): boolean {
  const threshold = resolveThresholdFromEnv();
  if (isFlagged) {
    return true;
  }

  if (threshold === null) {
    return false;
  }

  return amount.greaterThan(threshold);
}

function resolveThresholdFromEnv(): Prisma.Decimal | null {
  const raw = process.env[APPROVAL_THRESHOLD_ENV]?.trim();
  if (raw === undefined || raw.length === 0) {
    return null;
  }

  if (!DECIMAL_RE.test(raw)) {
    throw badRequest("FINANCE_APPROVAL_THRESHOLD must be a decimal with up to two places.");
  }

  const parsed = new Prisma.Decimal(raw);
  if (!parsed.isFinite() || parsed.isNaN()) {
    throw badRequest("FINANCE_APPROVAL_THRESHOLD must be finite.");
  }
  if (parsed.lt(0)) {
    throw badRequest("FINANCE_APPROVAL_THRESHOLD must be zero or greater.");
  }

  return parsed;
}

async function getFinanceApproverId(tx: FinanceServiceDb, actorId: string) {
  const candidates = await tx.user.findMany({
    where: {
      id: {
        not: actorId,
      },
    },
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

async function getAccountOrThrow(tx: FinanceServiceDb, id: string) {
  const account = await tx.account.findFirst({ where: { id } });
  if (!account) {
    throw notFound("Account not found.");
  }

  return account;
}

async function getCategoryOrThrow(tx: FinanceServiceDb, id: string) {
  const category = await tx.category.findFirst({ where: { id } });
  if (!category) {
    throw notFound("Category not found.");
  }

  return category;
}

async function getBudgetOrThrow(tx: FinanceServiceDb, id: string) {
  const budget = await tx.budget.findFirst({ where: { id } });
  if (!budget) {
    throw notFound("Budget not found.");
  }

  return budget;
}

async function getTransactionOrThrow(tx: FinanceServiceDb, id: string) {
  const transaction = await tx.transaction.findFirst({ where: { id } });
  if (!transaction) {
    throw notFound("Transaction not found.");
  }

  return transaction;
}

async function resolveTransactionByApproval(
  tx: FinanceServiceDb,
  approvalId: string,
): Promise<TransactionRecord | null> {
  const reference = await tx.reference.findFirst({
    where: {
      fromType: EntityType.APPROVAL,
      fromId: approvalId,
      toType: EntityType.TRANSACTION,
      relation: FINANCIAL_APPROVAL_TRANSACTION_REFERENCE,
    },
  });

  if (reference) {
    const linkedTransaction = await tx.transaction.findFirst({
      where: {
        id: reference.toId,
        status: TX_STATUSES.PENDING,
      },
    });

    if (linkedTransaction) {
      return linkedTransaction;
    }
  }

  return tx.transaction.findFirst({
    where: {
      approvalId,
      status: TX_STATUSES.PENDING,
    },
  });
}
