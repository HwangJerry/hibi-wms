import { describe, expect, it } from "vitest";
import { Prisma } from "@hibi/db";
import type { FastifyReply } from "fastify";
import type { ApiContext, Session, User } from "../context.js";
import { appRouter } from "./index.js";

type Account = {
  id: string;
  name: string;
  kind: "CASH" | "BANK" | "CARD" | "OTHER";
  currency: string;
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
  status: "PENDING" | "POSTED" | "REVERSED";
  approvalId: string | null;
  occurredAt: Date;
  postedAt: Date | null;
  reversedById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type Category = {
  id: string;
  name: string;
  kind: "INCOME" | "EXPENSE";
  createdAt: Date;
  updatedAt: Date;
};

type Budget = {
  id: string;
  categoryId: string;
  periodStart: Date;
  periodEnd: Date;
  limit: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
};

type ApprovalRequest = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  requesterId: string;
  approverId: string;
  state: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  decidedAt: Date | null;
};

type Reference = {
  id: string;
  fromType: string;
  fromId: string;
  toType: string;
  toId: string;
  relation: string;
  createdAt: Date;
};

type AuditLog = {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: Date;
};

class InMemoryFinanceRouterDb {
  readonly accounts: Account[] = [];
  readonly categories: Category[] = [];
  readonly budgets: Budget[] = [];
  readonly transactions: TransactionRecord[] = [];
  readonly approvalRequests: ApprovalRequest[] = [];
  readonly references: Reference[] = [];
  readonly auditLogs: AuditLog[] = [];
  private nextAccountNumber = 1;
  private nextCategoryNumber = 1;
  private nextBudgetNumber = 1;
  private nextTransactionNumber = 1;
  private nextAuditNumber = 1;
  private nextApprovalRequestNumber = 1;
  private nextReferenceNumber = 1;

  readonly account = {
    findFirst: (args: { where: { id: string } }) => {
      const account = this.accounts.find((candidate) => candidate.id === args.where.id) ?? null;
      return Promise.resolve(account ? { ...account } : null);
    },
    create: (args: { data: { name: string; kind: Account["kind"]; currency: string } }) => {
      const now = new Date("2026-06-17T00:00:00.000Z");
      const account: Account = {
        id: `account-${this.nextAccountNumber}`,
        name: args.data.name,
        kind: args.data.kind,
        currency: args.data.currency,
        createdAt: now,
        updatedAt: now,
      };

      this.nextAccountNumber += 1;
      this.accounts.push(account);
      return Promise.resolve({ ...account });
    },
    findMany: () => Promise.resolve(this.accounts.map((row) => ({ ...row }))),
    update: (args: {
      where: { id: string };
      data: Partial<Pick<Account, "name" | "kind" | "currency">>;
    }) => {
      const target = this.accounts.find((candidate) => candidate.id === args.where.id);
      if (!target) {
        throw new Error(`Account ${args.where.id} not found`);
      }

      Object.assign(target, args.data, { updatedAt: new Date("2026-06-17T00:00:00.000Z") });
      return Promise.resolve({ ...target });
    },
    delete: (args: { where: { id: string } }) => {
      const index = this.accounts.findIndex((candidate) => candidate.id === args.where.id);
      if (index === -1) {
        throw new Error(`Account ${args.where.id} not found`);
      }

      const [deleted] = this.accounts.splice(index, 1);
      return Promise.resolve({ ...deleted });
    },
  };

  readonly category = {
    findMany: () => Promise.resolve(this.categories.map((row) => ({ ...row }))),
    findFirst: () => Promise.resolve(null),
    create: (args: { data: { name: string; kind: Category["kind"] } }) => {
      const now = new Date("2026-06-17T00:00:00.000Z");
      const category: Category = {
        id: `category-${this.nextCategoryNumber}`,
        name: args.data.name,
        kind: args.data.kind,
        createdAt: now,
        updatedAt: now,
      };

      this.nextCategoryNumber += 1;
      this.categories.push(category);
      return Promise.resolve({ ...category });
    },
    update: (args: {
      where: { id: string };
      data: Partial<Pick<Category, "name" | "kind">>;
    }) => {
      const target = this.categories.find((candidate) => candidate.id === args.where.id);
      if (!target) {
        throw new Error(`Category ${args.where.id} not found`);
      }

      Object.assign(target, args.data, { updatedAt: new Date("2026-06-17T00:00:00.000Z") });
      return Promise.resolve({ ...target });
    },
    delete: (args: { where: { id: string } }) => {
      const index = this.categories.findIndex((candidate) => candidate.id === args.where.id);
      if (index === -1) {
        throw new Error(`Category ${args.where.id} not found`);
      }

      const [deleted] = this.categories.splice(index, 1);
      return Promise.resolve({ ...deleted });
    },
  };

  readonly budget = {
    findMany: () => Promise.resolve(this.budgets.map((row) => ({ ...row }))),
    findFirst: (args: { where: { id?: string; categoryId?: string } }) => {
      const budget = this.budgets.find((candidate) => {
        if (args.where.id !== undefined && candidate.id !== args.where.id) {
          return false;
        }

        if (args.where.categoryId !== undefined && candidate.categoryId !== args.where.categoryId) {
          return false;
        }

        return true;
      }) ?? null;

      return Promise.resolve(budget ? { ...budget } : null);
    },
    create: (args: {
      data: {
        categoryId: string;
        periodStart: Date;
        periodEnd: Date;
        limit: Prisma.Decimal;
      };
    }) => {
      const now = new Date("2026-06-17T00:00:00.000Z");
      const budget: Budget = {
        id: `budget-${this.nextBudgetNumber}`,
        categoryId: args.data.categoryId,
        periodStart: args.data.periodStart,
        periodEnd: args.data.periodEnd,
        limit: args.data.limit,
        createdAt: now,
        updatedAt: now,
      };

      this.nextBudgetNumber += 1;
      this.budgets.push(budget);
      return Promise.resolve({ ...budget });
    },
    update: (args: {
      where: { id: string };
      data: Partial<Pick<Budget, "categoryId" | "periodStart" | "periodEnd" | "limit">>;
    }) => {
      const target = this.budgets.find((candidate) => candidate.id === args.where.id);
      if (!target) {
        throw new Error(`Budget ${args.where.id} not found`);
      }

      Object.assign(target, args.data, { updatedAt: new Date("2026-06-17T00:00:00.000Z") });
      return Promise.resolve({ ...target });
    },
    delete: (args: { where: { id: string } }) => {
      const index = this.budgets.findIndex((candidate) => candidate.id === args.where.id);
      if (index === -1) {
        throw new Error(`Budget ${args.where.id} not found`);
      }

      const [deleted] = this.budgets.splice(index, 1);
      return Promise.resolve({ ...deleted });
    },
  };

  readonly transaction = {
    findMany: (args: {
      where?: {
        status?: TransactionRecord["status"];
        accountId?: string;
        occurredAt?: { gte?: Date; lte?: Date };
      };
      orderBy?: { occurredAt?: "asc" | "desc"; id?: "asc" | "desc" }[] | {
        occurredAt?: "asc" | "desc";
        id?: "asc" | "desc";
      };
      take?: number;
      cursor?: { id: string };
      skip?: number;
    }) => {
      const where = args.where;
      const rows = this.transactions.filter((transaction) => {
        if (where?.status !== undefined && transaction.status !== where.status) {
          return false;
        }

        if (where?.accountId !== undefined && transaction.accountId !== where.accountId) {
          return false;
        }

        if (where?.occurredAt?.gte !== undefined && transaction.occurredAt < where.occurredAt.gte) {
          return false;
        }

        if (where?.occurredAt?.lte !== undefined && transaction.occurredAt > where.occurredAt.lte) {
          return false;
        }

        return true;
      });

      const orderings = Array.isArray(args.orderBy)
        ? args.orderBy
        : args.orderBy !== undefined
          ? [args.orderBy]
          : [];

      const ordered = [...rows].sort((left, right) => {
        for (const ordering of orderings) {
          if (ordering.occurredAt !== undefined) {
            const direction = ordering.occurredAt === "asc" ? 1 : -1;
            const leftValue = left.occurredAt.getTime();
            const rightValue = right.occurredAt.getTime();
            const diff = (leftValue - rightValue) * direction;
            if (diff !== 0) {
              return diff;
            }
          }

          if (ordering.id !== undefined) {
            const direction = ordering.id === "asc" ? 1 : -1;
            const diff = left.id.localeCompare(right.id) * direction;
            if (diff !== 0) {
              return diff;
            }
          }
        }

        return 0;
      });

      const cursorIndex = args.cursor
        ? ordered.findIndex((candidate) => candidate.id === args.cursor?.id)
        : -1;
      const startIndex = cursorIndex >= 0 ? cursorIndex + (args.skip ?? 0) : 0;
      const endIndex = args.take !== undefined ? startIndex + args.take : undefined;
      return Promise.resolve(ordered.slice(startIndex, endIndex));
    },
    findFirst: (args: { where: { id: string } }) => {
      const transaction = this.transactions.find((candidate) => candidate.id === args.where.id) ?? null;
      return Promise.resolve(transaction ? { ...transaction } : null);
    },
    create: (args: {
      data: {
        accountId: string;
        categoryId: string | null;
        amount: Prisma.Decimal;
        currency: string;
        description: string | null;
        status: TransactionRecord["status"];
        approvalId: string | null;
        occurredAt: Date;
        postedAt: Date | null;
        reversedById: string | null;
      };
    }) => {
      const now = new Date("2026-06-17T00:00:00.000Z");
      const transaction: TransactionRecord = {
        id: `transaction-${this.nextTransactionNumber}`,
        accountId: args.data.accountId,
        categoryId: args.data.categoryId,
        amount: args.data.amount,
        currency: args.data.currency,
        description: args.data.description,
        status: args.data.status,
        approvalId: args.data.approvalId,
        occurredAt: args.data.occurredAt,
        postedAt: args.data.postedAt,
        reversedById: args.data.reversedById,
        createdAt: now,
        updatedAt: now,
      };

      this.nextTransactionNumber += 1;
      this.transactions.push(transaction);
      return Promise.resolve({ ...transaction });
    },
    update: (args: {
      where: { id: string };
      data: Partial<
        Pick<
          TransactionRecord,
          "accountId" | "categoryId" | "status" | "amount" | "currency" | "description" | "approvalId" | "occurredAt" | "postedAt" | "reversedById"
        >
      >;
    }) => {
      const target = this.transactions.find((candidate) => candidate.id === args.where.id);
      if (!target) {
        throw new Error(`Transaction ${args.where.id} not found`);
      }

      Object.assign(target, args.data, { updatedAt: new Date("2026-06-17T00:00:00.000Z") });
      return Promise.resolve({ ...target });
    },
  };

  readonly approvalRequest = {
    create: (args: {
      data: {
        type: string;
        title: string;
        description?: string | null;
        requesterId: string;
        approverId: string;
        state?: string;
      };
    }) => {
      const now = new Date("2026-06-17T00:00:00.000Z");
      const request: ApprovalRequest = {
        id: `approval-request-${this.nextApprovalRequestNumber}`,
        type: args.data.type,
        title: args.data.title,
        description: args.data.description ?? null,
        requesterId: args.data.requesterId,
        approverId: args.data.approverId,
        state: (args.data.state as ApprovalRequest["state"]) ?? "PENDING",
        decidedAt: null,
      };

      this.nextApprovalRequestNumber += 1;
      this.approvalRequests.push(request);
      return Promise.resolve({ ...request });
    },
    findFirst: (args: { where: { id: string } }) => {
      const row = this.approvalRequests.find((candidate) => candidate.id === args.where.id) ?? null;
      return Promise.resolve(row ? { ...row } : null);
    },
  };

  readonly user = {
    findMany: () => Promise.resolve([{ id: "user-2" }]),
  };

  readonly reference = {
    create: (args: {
      data: {
        fromType: string;
        fromId: string;
        toType: string;
        toId: string;
        relation: string;
      };
    }) => {
      const now = new Date("2026-06-17T00:00:00.000Z");
      const reference: Reference = {
        id: `reference-${this.nextReferenceNumber}`,
        fromType: args.data.fromType,
        fromId: args.data.fromId,
        toType: args.data.toType,
        toId: args.data.toId,
        relation: args.data.relation,
        createdAt: now,
      };

      this.nextReferenceNumber += 1;
      this.references.push(reference);
      return Promise.resolve(reference);
    },
    findFirst: () => Promise.resolve(null),
  };

  readonly auditLog = {
    create: (args: {
      data: {
        actorId: string;
        action: string;
        entityType: string;
        entityId: string;
      };
    }) => {
      const audit = {
        id: `audit-${this.nextAuditNumber}`,
        actorId: args.data.actorId,
        action: args.data.action,
        entityType: args.data.entityType,
        entityId: args.data.entityId,
        createdAt: new Date("2026-06-17T00:00:00.000Z"),
      };

      this.auditLogs.push(audit);
      this.nextAuditNumber += 1;
      return Promise.resolve(audit);
    },
  };

  async $transaction<T>(fn: (tx: InMemoryFinanceRouterDb) => Promise<T>) {
    return await fn(this);
  }
}

function createAuthenticatedContext(db: InMemoryFinanceRouterDb): ApiContext {
  const user: User = {
    id: "user-1",
    email: "user-1@example.com",
    name: "User One",
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

describe("financeRouter", () => {
  it("creates then lists transactions", async () => {
    const db = new InMemoryFinanceRouterDb();
    const caller = appRouter.createCaller(createAuthenticatedContext(db));

    const account = await caller.finance.accounts.create({
      name: "Cash",
      kind: "CASH",
      currency: "USD",
    });

    const created = await caller.finance.transactions.create({
      accountId: account.id,
      amount: "100.00",
      occurredAt: "2026-06-17T00:00:00.000Z",
    });

    const listed = await caller.finance.transactions.list({});

    expect(created).toMatchObject({
      accountId: account.id,
      status: "PENDING",
      approvalId: null,
      amount: new Prisma.Decimal("100.00"),
    });
    expect(listed).toMatchObject({
      items: [
        {
          id: created.id,
          accountId: account.id,
        },
      ],
      nextCursor: undefined,
    });
    expect(listed.items[0]!.amount.toFixed(2)).toBe("100.00");
    expect(db.auditLogs.at(-1)).toMatchObject({
      actorId: "user-1",
      action: "finance.transaction.created",
      entityId: created.id,
    });
  });

  it("supports account update and delete through router", async () => {
    const db = new InMemoryFinanceRouterDb();
    const caller = appRouter.createCaller(createAuthenticatedContext(db));

    const account = await caller.finance.accounts.create({
      name: "Checking",
      kind: "BANK",
      currency: "USD",
    });

    const updated = await caller.finance.accounts.update({
      id: account.id,
      patch: {
        name: "Checking Primary",
      },
    });

    const deleted = await caller.finance.accounts.delete({
      id: updated.id,
    });

    expect(updated.name).toBe("Checking Primary");
    expect(deleted.id).toBe(account.id);
    const listedAccounts = await caller.finance.accounts.list({});
    expect(listedAccounts.items).toHaveLength(0);
  });

  it("supports category and budget create/update/delete", async () => {
    const db = new InMemoryFinanceRouterDb();
    const caller = appRouter.createCaller(createAuthenticatedContext(db));

    const category = await caller.finance.categories.create({
      name: "Ops",
      kind: "EXPENSE",
    });

    const listedCategories = await caller.finance.categories.list({});
    expect(listedCategories.items).toHaveLength(1);
    expect(listedCategories.items[0]).toMatchObject({ id: category.id });

    const updatedCategory = await caller.finance.categories.update({
      id: category.id,
      patch: { name: "Operations" },
    });

    const budget = await caller.finance.budgets.create({
      categoryId: category.id,
      periodStart: "2026-06-01T00:00:00.000Z",
      periodEnd: "2026-06-30T23:59:59.000Z",
      limit: "1000.00",
    });

    expect(updatedCategory.name).toBe("Operations");
    expect(budget.categoryId).toBe(deletedCategory.id);

    const budgetUpdated = await caller.finance.budgets.update({
      id: budget.id,
      patch: {
        limit: "1500.00",
      },
    });

    expect(budgetUpdated.limit.toString()).toBe("1500.00");

    const budgetDeleted = await caller.finance.budgets.delete({ id: budget.id });
    expect(budgetDeleted.id).toBe(budget.id);

    const deletedCategory = await caller.finance.categories.delete({ id: category.id });
    expect(deletedCategory.id).toBe(category.id);
  });

  it("creates flagged transaction and routes approval references without fixture stubs", async () => {
    const db = new InMemoryFinanceRouterDb();
    const caller = appRouter.createCaller(createAuthenticatedContext(db));
    process.env.FINANCE_APPROVAL_THRESHOLD = "100.00";

    const account = await caller.finance.accounts.create({
      name: "Cash",
      kind: "CASH",
      currency: "USD",
    });

    const created = await caller.finance.transactions.create({
      accountId: account.id,
      amount: "150.00",
      occurredAt: "2026-06-17T00:00:00.000Z",
      isFlagged: true,
      reason: "Large invoice",
    });

    expect(created.approvalId).toBeTypeOf("string");
    expect(db.auditLogs.at(-1)).toMatchObject({
      action: "finance.transaction.created",
      entityType: "TRANSACTION",
      entityId: created.id,
    });
  });
});
