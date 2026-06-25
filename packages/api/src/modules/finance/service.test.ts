import { describe, expect, it } from "vitest";
import { EntityType, Prisma } from "@hibi/db";
import {
  FINANCIAL_APPROVAL_TRANSACTION_REFERENCE,
  FinanceService,
} from "./service.js";

const FINANCE_TEST_DATES = {
  now: new Date("2026-06-17T00:00:00.000Z"),
} as const;

type Account = {
  id: string;
  name: string;
  kind: "CASH" | "BANK" | "CARD" | "OTHER";
  currency: string;
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

type Transaction = {
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

type ApprovalRequest = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  requesterId: string;
  approverId: string;
  state: "PENDING" | "APPROVED";
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

type AuditLog = {
  actorId: string;
  action: string;
  entityType: EntityType;
  entityId: string;
  data: Prisma.InputJsonValue;
  createdAt: Date;
};

class InMemoryFinanceDb {
  readonly accounts: Account[] = [];
  readonly categories: Category[] = [];
  readonly budgets: Budget[] = [];
  readonly transactions: Transaction[] = [];
  readonly approvalRequests: ApprovalRequest[] = [];
  readonly auditLogs: AuditLog[] = [];
  readonly references: ReferenceRecord[] = [];
  readonly users = ["user-1", "user-2"];
  private nextAccountNumber = 1;
  private nextCategoryNumber = 1;
  private nextBudgetNumber = 1;
  private nextTransactionNumber = 1;
  private nextApprovalNumber = 1;
  private nextAuditNumber = 1;
  private nextReferenceNumber = 1;

  readonly account = {
    findMany: (args: { take?: number; cursor?: { id: string } }) => {
      const rows = this.findByCursor({ rows: this.accounts, input: args, defaultSorted: (left, right) => left.id.localeCompare(right.id) });
      return Promise.resolve(rows);
    },
    findFirst: (args: { where: { id: string } }) => {
      const row = this.accounts.find((candidate) => candidate.id === args.where.id);
      return Promise.resolve(row ? { ...row } : null);
    },
    create: (args: { data: { name: string; kind: string; currency: string } }) => {
      const now = new Date(FINANCE_TEST_DATES.now);
      const account: Account = {
        id: `account-${this.nextAccountNumber}`,
        name: args.data.name,
        kind: args.data.kind as Account["kind"],
        currency: args.data.currency,
        createdAt: now,
        updatedAt: now,
      };

      this.nextAccountNumber += 1;
      this.accounts.push(account);
      return Promise.resolve({ ...account });
    },
    update: (args: { where: { id: string }; data: Partial<Account> }) => {
      const target = this.accounts.find((candidate) => candidate.id === args.where.id);
      if (!target) {
        throw new Error(`Account ${args.where.id} not found`);
      }

      Object.assign(target, args.data, { updatedAt: new Date(FINANCE_TEST_DATES.now) });
      return Promise.resolve({ ...target });
    },
    delete: (args: { where: { id: string } }) => {
      const index = this.accounts.findIndex((candidate) => candidate.id === args.where.id);
      if (index === -1) {
        throw new Error(`Account ${args.where.id} not found`);
      }

      const [removed] = this.accounts.splice(index, 1);
      return Promise.resolve({ ...removed });
    },
  };

  readonly category = {
    findMany: (args: { take?: number; cursor?: { id: string }; where?: { id?: string; kind?: string } }) => {
      const filter = args.where
        ? this.categories.filter((candidate) => {
            if (args.where?.id !== undefined) {
              return candidate.id === args.where.id;
            }

            if (args.where?.kind !== undefined) {
              return candidate.kind === args.where.kind;
            }

            return true;
          })
        : [...this.categories];
      const rows = this.findByCursor({ rows: filter, input: args, defaultSorted: (left, right) => left.id.localeCompare(right.id) });
      return Promise.resolve(rows);
    },
    findFirst: (args: { where: { id: string } }) => {
      const row = this.categories.find((candidate) => candidate.id === args.where.id);
      return Promise.resolve(row ? { ...row } : null);
    },
    create: (args: { data: { name: string; kind: string } }) => {
      const now = new Date(FINANCE_TEST_DATES.now);
      const category: Category = {
        id: `category-${this.nextCategoryNumber}`,
        name: args.data.name,
        kind: args.data.kind as Category["kind"],
        createdAt: now,
        updatedAt: now,
      };

      this.nextCategoryNumber += 1;
      this.categories.push(category);
      return Promise.resolve({ ...category });
    },
    update: (args: { where: { id: string }; data: Partial<Category> }) => {
      const target = this.categories.find((candidate) => candidate.id === args.where.id);
      if (!target) {
        throw new Error(`Category ${args.where.id} not found`);
      }

      Object.assign(target, args.data, { updatedAt: new Date(FINANCE_TEST_DATES.now) });
      return Promise.resolve({ ...target });
    },
    delete: (args: { where: { id: string } }) => {
      const index = this.categories.findIndex((candidate) => candidate.id === args.where.id);
      if (index === -1) {
        throw new Error(`Category ${args.where.id} not found`);
      }

      const [removed] = this.categories.splice(index, 1);
      return Promise.resolve({ ...removed });
    },
  };

  readonly budget = {
    findMany: (args: { take?: number; cursor?: { id: string }; where?: { categoryId?: string; id?: string } }) => {
      const filtered = this.budgets.filter((candidate) => {
        if (args.where?.categoryId !== undefined) {
          return candidate.categoryId === args.where.categoryId;
        }

        if (args.where?.id !== undefined) {
          return candidate.id === args.where.id;
        }

        return true;
      });
      const rows = this.findByCursor({ rows: filtered, input: args, defaultSorted: (left, right) => left.id.localeCompare(right.id) });
      return Promise.resolve(rows);
    },
    findFirst: (args: { where: { id?: string; categoryId?: string } }) => {
      const row = this.budgets.find((candidate) => {
        if (args.where.id !== undefined) {
          return candidate.id === args.where.id;
        }

        if (args.where.categoryId !== undefined) {
          return candidate.categoryId === args.where.categoryId;
        }

        return false;
      });

      return Promise.resolve(row ? { ...row } : null);
    },
    create: (args: {
      data: { categoryId: string; periodStart: Date; periodEnd: Date; limit: Prisma.Decimal };
    }) => {
      const now = new Date(FINANCE_TEST_DATES.now);
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
    update: (args: { where: { id: string }; data: Partial<Budget> }) => {
      const target = this.budgets.find((candidate) => candidate.id === args.where.id);
      if (!target) {
        throw new Error(`Budget ${args.where.id} not found`);
      }

      Object.assign(target, args.data, { updatedAt: new Date(FINANCE_TEST_DATES.now) });
      return Promise.resolve({ ...target });
    },
    delete: (args: { where: { id: string } }) => {
      const index = this.budgets.findIndex((candidate) => candidate.id === args.where.id);
      if (index === -1) {
        throw new Error(`Budget ${args.where.id} not found`);
      }

      const [removed] = this.budgets.splice(index, 1);
      return Promise.resolve({ ...removed });
    },
  };

  readonly transaction = {
    findMany: (args: {
      where?: {
        accountId?: string;
        categoryId?: string;
        status?: Transaction["status"];
        id?: string;
        occurredAt?: { gte?: Date; lte?: Date };
      };
      take?: number;
      cursor?: { id: string };
      skip?: number;
    }) => {
      const rows = this.transactions.filter((candidate) => {
        if (args.where?.accountId !== undefined && candidate.accountId !== args.where.accountId) {
          return false;
        }
        if (args.where?.categoryId !== undefined && candidate.categoryId !== args.where.categoryId) {
          return false;
        }
        if (args.where?.status !== undefined && candidate.status !== args.where.status) {
          return false;
        }

        if (args.where?.id !== undefined && candidate.id !== args.where.id) {
          return false;
        }

        if (args.where?.occurredAt?.gte !== undefined && candidate.occurredAt < args.where.occurredAt.gte) {
          return false;
        }

        if (args.where?.occurredAt?.lte !== undefined && candidate.occurredAt > args.where.occurredAt.lte) {
          return false;
        }

        return true;
      });

      rows.sort((left, right) => {
        const occurredAt = right.occurredAt.getTime() - left.occurredAt.getTime();
        if (occurredAt !== 0) {
          return occurredAt;
        }

        return left.id.localeCompare(right.id);
      });

      const start = args.cursor ? rows.findIndex((row) => row.id === args.cursor?.id) + (args.skip ?? 0) : 0;
      const taken = args.take !== undefined ? rows.slice(Math.max(0, start), start + args.take) : rows;
      return Promise.resolve(taken.map((row) => ({ ...row })));
    },
    findFirst: (args: {
      where: {
        id?: string;
        approvalId?: string;
        status?: Transaction["status"];
        accountId?: string;
        categoryId?: string;
        occurredAt?: { gte?: Date; lte?: Date };
      };
    }) => {
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

        if (args.where.accountId !== undefined && candidate.accountId !== args.where.accountId) {
          return false;
        }

        if (args.where.categoryId !== undefined && candidate.categoryId !== args.where.categoryId) {
          return false;
        }

        if (args.where.occurredAt?.gte !== undefined && candidate.occurredAt < args.where.occurredAt.gte) {
          return false;
        }

        if (args.where.occurredAt?.lte !== undefined && candidate.occurredAt > args.where.occurredAt.lte) {
          return false;
        }

        return true;
      });

      return Promise.resolve(row ? { ...row } : null);
    },
    create: (args: {
      data: {
        accountId: string;
        categoryId: string | null;
        amount: Prisma.Decimal;
        currency: string;
        description: string | null;
        status: Transaction["status"];
        approvalId: string | null;
        occurredAt: Date;
        postedAt: Date | null;
        reversedById: string | null;
      };
    }) => {
      const now = new Date(FINANCE_TEST_DATES.now);
      const transaction: Transaction = {
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
      data: Partial<{
        categoryId: string | null;
        status: Transaction["status"];
        amount: Prisma.Decimal;
        currency: string;
        description: string | null;
        approvalId: string | null;
        occurredAt: Date;
        postedAt: Date | null;
        reversedById: string | null;
      }>;
    }) => {
      const target = this.transactions.find((candidate) => candidate.id === args.where.id);
      if (!target) {
        throw new Error(`Transaction ${args.where.id} not found`);
      }

      Object.assign(target, args.data, { updatedAt: new Date(FINANCE_TEST_DATES.now) });
      return Promise.resolve({ ...target });
    },
  };

  readonly approvalRequest = {
    create: (args: {
      data: {
        type: string;
        title: string;
        description?: string;
        requesterId: string;
        approverId: string;
        state?: string;
      };
    }) => {
      const now = new Date(FINANCE_TEST_DATES.now);
      const request: ApprovalRequest = {
        id: `approval-${this.nextApprovalNumber}`,
        type: args.data.type,
        title: args.data.title,
        description: args.data.description ?? null,
        requesterId: args.data.requesterId,
        approverId: args.data.approverId,
        state: (args.data.state ?? "PENDING") as ApprovalRequest["state"],
      };

      this.nextApprovalNumber += 1;
      this.approvalRequests.push(request);
      return Promise.resolve({ ...request });
    },
    findFirst: (args: { where: { id: string } }) => {
      const request = this.approvalRequests.find((candidate) => candidate.id === args.where.id);
      return Promise.resolve(request ? { ...request } : null);
    },
  };

  readonly user = {
    findMany: (args: { where: { id?: { not: string } } }) => {
      const not = args.where.id && "not" in args.where.id ? args.where.id.not : undefined;
      if (not === undefined) {
        return Promise.resolve(this.users.map((id) => ({ id })));
      }

      return Promise.resolve(this.users.filter((id) => id !== not).map((id) => ({ id })));
    },
  };

  readonly auditLog = {
    create: (args: { data: { actorId: string; action: string; entityType: EntityType; entityId: string; data: Prisma.InputJsonValue } }) => {
      const now = new Date(FINANCE_TEST_DATES.now);
      const auditLog: AuditLog = {
        ...args.data,
        createdAt: now,
      };

      this.auditLogs.push(auditLog);
      return Promise.resolve(auditLog);
    },
  };

  readonly reference = {
    create: (args: { data: { fromType: EntityType; fromId: string; toType: EntityType; toId: string; relation: string } }) => {
      const now = new Date(FINANCE_TEST_DATES.now);
      const reference: ReferenceRecord = {
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
      return Promise.resolve({ ...reference });
    },
    findFirst: (args: { where: { fromType?: EntityType; fromId?: string; toType?: EntityType; toId?: string; relation?: string } }) => {
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

  async $transaction<T>(fn: (tx: this) => Promise<T>) {
    return await fn(this);
  }

  addAccount(input: { id: string; currency: string; kind: Account["kind"]; name: string }) {
    this.accounts.push({
      id: input.id,
      currency: input.currency,
      kind: input.kind,
      name: input.name,
      createdAt: new Date(FINANCE_TEST_DATES.now),
      updatedAt: new Date(FINANCE_TEST_DATES.now),
    });
  }

  addCategory(input: { id: string; name: string; kind: Category["kind"] }) {
    this.categories.push({
      id: input.id,
      name: input.name,
      kind: input.kind,
      createdAt: new Date(FINANCE_TEST_DATES.now),
      updatedAt: new Date(FINANCE_TEST_DATES.now),
    });
  }

  addTransaction(input: Omit<Transaction, "createdAt" | "updatedAt">) {
    this.transactions.push({
      ...input,
      createdAt: new Date(FINANCE_TEST_DATES.now),
      updatedAt: new Date(FINANCE_TEST_DATES.now),
    });
  }

  addBudget(input: Omit<Budget, "createdAt" | "updatedAt">) {
    this.budgets.push({
      ...input,
      createdAt: new Date(FINANCE_TEST_DATES.now),
      updatedAt: new Date(FINANCE_TEST_DATES.now),
    });
  }

  private findByCursor<T extends { id: string }>(params: {
    rows: T[];
    input: { take?: number; cursor?: { id: string }; skip?: number };
    defaultSorted: (left: T, right: T) => number;
  }): T[] {
    const copy = [...params.rows].sort(params.defaultSorted);

    const start = params.input.cursor
      ? copy.findIndex((row) => (row as { id: string }).id === params.input.cursor?.id) + (params.input.skip ?? 0)
      : 0;

    const cappedStart = Math.max(0, start);
    return params.input.take === undefined ? copy.slice(cappedStart) : copy.slice(cappedStart, cappedStart + params.input.take);
  }
}

function createService() {
  const db = new InMemoryFinanceDb();
  return {
    db,
    service: new FinanceService(db),
  };
}

describe("FinanceService", () => {
  it("creates a pending transaction and links a financial approval when flagged", async () => {
    const { db, service } = createService();
    db.addAccount({ id: "account-1", name: "Primary", currency: "USD", kind: "BANK" });
    db.addCategory({ id: "category-1", name: "Ops", kind: "EXPENSE" });
    process.env.FINANCE_APPROVAL_THRESHOLD = "100.00";

    const transaction = await service.createTransaction({
      actorId: "user-1",
      accountId: "account-1",
      categoryId: "category-1",
      amount: new Prisma.Decimal("150.00"),
      reason: "Over threshold",
      occurredAt: new Date("2026-06-17T00:00:00.000Z"),
      isFlagged: true,
    });

    expect(transaction.status).toBe("PENDING");
    expect(transaction.approvalId).toBeTruthy();
    const request = db.approvalRequests.at(-1);
    expect(request).toMatchObject({
      id: transaction.approvalId,
      type: "FINANCIAL",
      state: "PENDING",
    });
    expect(db.references).toHaveLength(1);
    expect(db.references.at(-1)).toMatchObject({
      fromType: EntityType.APPROVAL,
      fromId: request?.id,
      toType: EntityType.TRANSACTION,
      toId: transaction.id,
      relation: FINANCIAL_APPROVAL_TRANSACTION_REFERENCE,
    });
    expect(db.auditLogs.at(-1)).toMatchObject({
      action: "finance.transaction.created",
      entityType: EntityType.TRANSACTION,
      entityId: transaction.id,
      data: {
        version: 1,
        module: "finance",
        operation: "transaction.created",
        resourceType: "transaction",
        resourceId: transaction.id,
      },
    });
  });

  it("does not create a financial approval when below threshold and not flagged", async () => {
    const { db, service } = createService();
    db.addAccount({ id: "account-1", name: "Primary", currency: "USD", kind: "BANK" });
    db.addCategory({ id: "category-1", name: "Ops", kind: "EXPENSE" });
    process.env.FINANCE_APPROVAL_THRESHOLD = "100.00";

    const transaction = await service.createTransaction({
      actorId: "user-1",
      accountId: "account-1",
      categoryId: "category-1",
      amount: new Prisma.Decimal("12.34"),
      reason: "Low value",
      occurredAt: new Date("2026-06-17T00:00:00.000Z"),
    });

    expect(transaction.approvalId).toBeNull();
    expect(db.approvalRequests).toHaveLength(0);
    expect(db.references).toHaveLength(0);
  });

  it("reverses a posted transaction by creating a new inverse row and marking original as reversed", async () => {
    const { db, service } = createService();
    db.addAccount({ id: "account-1", name: "Primary", currency: "USD", kind: "BANK" });
    db.addTransaction({
      id: "tx-source",
      accountId: "account-1",
      categoryId: null,
      amount: new Prisma.Decimal("55.50"),
      currency: "USD",
      description: "posted item",
      status: "POSTED",
      approvalId: null,
      occurredAt: new Date("2026-06-17T00:00:00.000Z"),
      postedAt: new Date("2026-06-17T00:00:00.000Z"),
      reversedById: null,
    });

    const reversal = await service.reverseTransaction({
      actorId: "user-1",
      id: "tx-source",
      reason: "Correction",
    });

    const original = db.transactions.find((candidate) => candidate.id === "tx-source");
    expect(original).not.toBeUndefined();
    expect(original?.status).toBe("REVERSED");
    expect(original?.reversedById).toBe(reversal.id);
    expect(reversal.status).toBe("POSTED");
    expect(reversal.amount.toString()).toBe("-55.5");
    expect(original?.amount.toString()).toBe("55.5");
    expect(db.auditLogs.at(-1)).toMatchObject({
      action: "finance.transaction.reversed",
      entityId: "tx-source",
      data: {
        version: 1,
        module: "finance",
        operation: "transaction.reversed",
        resourceType: "transaction",
        resourceId: "tx-source",
      },
    });
  });

  it("rejects reversing a non-posted transaction", async () => {
    const { db, service } = createService();
    db.addAccount({ id: "account-1", name: "Primary", currency: "USD", kind: "BANK" });
    db.addTransaction({
      id: "tx-pending",
      accountId: "account-1",
      categoryId: null,
      amount: new Prisma.Decimal("25.00"),
      currency: "USD",
      description: null,
      status: "PENDING",
      approvalId: null,
      occurredAt: new Date("2026-06-17T00:00:00.000Z"),
      postedAt: null,
      reversedById: null,
    });

    await expect(
      service.reverseTransaction({
        actorId: "user-1",
        id: "tx-pending",
        reason: "Should fail",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("returns account balances from posted transactions only", async () => {
    const { db, service } = createService();
    db.addAccount({ id: "account-1", name: "Checking", currency: "USD", kind: "BANK" });
    db.addAccount({ id: "account-2", name: "Savings", currency: "USD", kind: "BANK" });

    db.addTransaction({
      id: "tx-posted-checking-a",
      accountId: "account-1",
      categoryId: null,
      amount: new Prisma.Decimal("120.00"),
      currency: "USD",
      description: "posted checking",
      status: "POSTED",
      approvalId: null,
      occurredAt: new Date("2026-06-10T00:00:00.000Z"),
      postedAt: new Date("2026-06-10T00:00:00.000Z"),
      reversedById: null,
    });
    db.addTransaction({
      id: "tx-pending-checking",
      accountId: "account-1",
      categoryId: null,
      amount: new Prisma.Decimal("25.00"),
      currency: "USD",
      description: "pending checking",
      status: "PENDING",
      approvalId: null,
      occurredAt: new Date("2026-06-11T00:00:00.000Z"),
      postedAt: null,
      reversedById: null,
    });
    db.addTransaction({
      id: "tx-posted-savings",
      accountId: "account-2",
      categoryId: null,
      amount: new Prisma.Decimal("75.50"),
      currency: "USD",
      description: "posted savings",
      status: "POSTED",
      approvalId: null,
      occurredAt: new Date("2026-06-12T00:00:00.000Z"),
      postedAt: new Date("2026-06-12T00:00:00.000Z"),
      reversedById: null,
    });
    db.addTransaction({
      id: "tx-reversed-savings",
      accountId: "account-2",
      categoryId: null,
      amount: new Prisma.Decimal("5.00"),
      currency: "USD",
      description: "reversed savings",
      status: "REVERSED",
      approvalId: null,
      occurredAt: new Date("2026-06-13T00:00:00.000Z"),
      postedAt: new Date("2026-06-13T00:00:00.000Z"),
      reversedById: null,
    });

    const balances = await service.accountBalances();

    expect(balances.items).toHaveLength(2);
    expect(balances.items).toMatchObject([
      { accountId: "account-1", currency: "USD", balance: new Prisma.Decimal("120.00") },
      { accountId: "account-2", currency: "USD", balance: new Prisma.Decimal("75.50") },
    ]);
  });

  it("returns budget-vs-actual from posted expense transactions within period", async () => {
    const { db, service } = createService();
    db.addAccount({ id: "account-1", name: "Cash", currency: "USD", kind: "CASH" });
    db.addCategory({ id: "category-expense", name: "Travel", kind: "EXPENSE" });
    db.addCategory({ id: "category-income", name: "Salary", kind: "INCOME" });
    db.addCategory({ id: "category-other", name: "Misc", kind: "EXPENSE" });
    db.addBudget({
      id: "budget-1",
      categoryId: "category-expense",
      periodStart: new Date("2026-06-01T00:00:00.000Z"),
      periodEnd: new Date("2026-06-30T23:59:59.999Z"),
      limit: new Prisma.Decimal("1000.00"),
    });
    db.addBudget({
      id: "budget-2",
      categoryId: "category-income",
      periodStart: new Date("2026-06-01T00:00:00.000Z"),
      periodEnd: new Date("2026-06-30T23:59:59.999Z"),
      limit: new Prisma.Decimal("2000.00"),
    });
    db.addBudget({
      id: "budget-3",
      categoryId: "category-other",
      periodStart: new Date("2026-05-01T00:00:00.000Z"),
      periodEnd: new Date("2026-05-31T23:59:59.999Z"),
      limit: new Prisma.Decimal("500.00"),
    });

    db.addTransaction({
      id: "tx-expense-posted-in-period",
      accountId: "account-1",
      categoryId: "category-expense",
      amount: new Prisma.Decimal("40.00"),
      currency: "USD",
      description: "expense in period",
      status: "POSTED",
      approvalId: null,
      occurredAt: new Date("2026-06-14T00:00:00.000Z"),
      postedAt: new Date("2026-06-14T00:00:00.000Z"),
      reversedById: null,
    });
    db.addTransaction({
      id: "tx-expense-posted-in-period-too",
      accountId: "account-1",
      categoryId: "category-expense",
      amount: new Prisma.Decimal("15.75"),
      currency: "USD",
      description: "more expense in period",
      status: "POSTED",
      approvalId: null,
      occurredAt: new Date("2026-06-20T00:00:00.000Z"),
      postedAt: new Date("2026-06-20T00:00:00.000Z"),
      reversedById: null,
    });
    db.addTransaction({
      id: "tx-income-posted",
      accountId: "account-1",
      categoryId: "category-income",
      amount: new Prisma.Decimal("999.00"),
      currency: "USD",
      description: "income in period",
      status: "POSTED",
      approvalId: null,
      occurredAt: new Date("2026-06-18T00:00:00.000Z"),
      postedAt: new Date("2026-06-18T00:00:00.000Z"),
      reversedById: null,
    });
    db.addTransaction({
      id: "tx-expense-pending-in-period",
      accountId: "account-1",
      categoryId: "category-expense",
      amount: new Prisma.Decimal("99.00"),
      currency: "USD",
      description: "pending expense in period",
      status: "PENDING",
      approvalId: null,
      occurredAt: new Date("2026-06-21T00:00:00.000Z"),
      postedAt: null,
      reversedById: null,
    });
    db.addTransaction({
      id: "tx-expense-out-period",
      accountId: "account-1",
      categoryId: "category-expense",
      amount: new Prisma.Decimal("9.99"),
      currency: "USD",
      description: "expense outside period",
      status: "POSTED",
      approvalId: null,
      occurredAt: new Date("2026-05-15T00:00:00.000Z"),
      postedAt: new Date("2026-05-15T00:00:00.000Z"),
      reversedById: null,
    });

    const report = await service.budgetVsActual({
      periodStart: new Date("2026-06-01T00:00:00.000Z"),
      periodEnd: new Date("2026-06-30T23:59:59.999Z"),
    });

    expect(report).toMatchObject({
      period: {
        periodStart: new Date("2026-06-01T00:00:00.000Z"),
        periodEnd: new Date("2026-06-30T23:59:59.999Z"),
      },
      items: [
        { budgetId: "budget-1", categoryId: "category-expense", actual: new Prisma.Decimal("55.75") },
      ],
    });
    expect(report.items).toHaveLength(1);
  });
});
