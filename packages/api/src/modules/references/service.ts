import { badRequest, createReference, listReferences, notFound, type AuditLogTransaction, writeAuditLog, UNLABELED_REFERENCE_RELATION } from "@hibi/core";
import { Prisma, type PrismaClient } from "@hibi/db";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;
const SEARCH_TERM_MAX_LENGTH = 200;
const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;
const SEARCH_TERM_MIN_LENGTH = 2;

const REFERENCE_TYPES = ["TASK", "PAGE", "APPROVAL", "TRANSACTION"] as const;

type ReferenceType = (typeof REFERENCE_TYPES)[number];

type ReferenceDelegate = {
  create(args: {
    data: Prisma.ReferenceCreateInput;
  }): Promise<Prisma.ReferenceGetPayload<object>>;
  findMany(args: Prisma.ReferenceFindManyArgs): Promise<Array<Prisma.ReferenceGetPayload<object>>>;
};

type ReferenceDb = {
  $transaction<T>(fn: (tx: ReferenceDb & AuditLogTransaction) => Promise<T>): Promise<T>;
  reference: ReferenceDelegate;
  task: {
    findMany(args: Prisma.TaskFindManyArgs): Promise<Array<{
      id: string;
      title: string;
      status: string;
      deletedAt: Date | null;
    }>>;
    findFirst(args: Prisma.TaskFindFirstArgs): Promise<Pick<{ id: string }, "id"> | null>;
  };
  page: {
    findMany(args: Prisma.PageFindManyArgs): Promise<Array<{
      id: string;
      title: string;
      deletedAt: Date | null;
    }>>;
    findFirst(args: Prisma.PageFindFirstArgs): Promise<Pick<{ id: string }, "id"> | null>;
  };
  approvalRequest: {
    findMany(args: Prisma.ApprovalRequestFindManyArgs): Promise<Array<{
      id: string;
      title: string;
      type: string;
      state: string;
    }>>;
    findFirst(args: Prisma.ApprovalRequestFindFirstArgs): Promise<Pick<{ id: string }, "id"> | null>;
  };
  transaction: {
    findMany(args: Prisma.TransactionFindManyArgs): Promise<Array<{
      id: string;
      description: string | null;
      status: string;
    }>>;
    findFirst(args: Prisma.TransactionFindFirstArgs): Promise<Pick<{ id: string }, "id"> | null>;
  };
  auditLog: {
    create(args: {
      data: Prisma.AuditLogCreateInput;
    }): Promise<Prisma.AuditLogGetPayload<object>>;
  };
  $queryRaw<T>(query: Prisma.Sql): Promise<T>;
};

export type ReferenceTarget = {
  type: ReferenceType;
  id: string;
};

export type CreateReferenceInput = {
  actorId: string;
  from: ReferenceTarget;
  to: ReferenceTarget;
  relation?: string;
};

export type SearchReferencesInput = {
  term: string;
  limit?: number;
};

export type ReferenceListItem = {
  id: string;
  type: ReferenceType;
  title: string;
  subtitle: string;
  path: string;
  relation: string;
  referenceId: string;
};

export type ReferenceTargetItem = {
  id: string;
  type: ReferenceType;
  title: string;
  subtitle: string;
  path: string;
};

export type SearchReferenceItem = ReferenceTargetItem;

type ReferenceListInput = {
  from: ReferenceTarget;
  limit?: number;
};

type ReferenceIncomingInput = {
  to: ReferenceTarget;
  limit?: number;
};

export class ReferencesService {
  constructor(private readonly db: ReferenceDb & AuditLogTransaction) {}

  async listOutgoing(input: ReferenceListInput): Promise<{ items: Array<ReferenceListItem> }> {
    const limit = normalizeLimit(input.limit, MAX_LIST_LIMIT, DEFAULT_LIST_LIMIT);
    const direction = await this.db.reference.findMany({
      where: {
        fromType: input.from.type,
        fromId: input.from.id,
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: limit,
    });

    return {
      items: await resolveReferenceTargetRows(direction, {
        idField: "toId",
        typeField: "toType",
      }, this.db),
    };
  }

  async listIncoming(input: ReferenceIncomingInput): Promise<{ items: Array<ReferenceListItem> }> {
    const limit = normalizeLimit(input.limit, MAX_LIST_LIMIT, DEFAULT_LIST_LIMIT);
    const direction = await this.db.reference.findMany({
      where: {
        toType: input.to.type,
        toId: input.to.id,
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: limit,
    });

    return {
      items: await resolveReferenceTargetRows(direction, {
        idField: "fromId",
        typeField: "fromType",
      }, this.db),
    };
  }

  async searchTargets(input: SearchReferencesInput): Promise<{ items: Array<SearchReferenceItem> }> {
    const term = input.term.trim().slice(0, SEARCH_TERM_MAX_LENGTH);
    if (term.length < SEARCH_TERM_MIN_LENGTH) {
      return { items: [] };
    }

    const limit = normalizeLimit(input.limit, MAX_SEARCH_LIMIT, DEFAULT_SEARCH_LIMIT);

    const [tasks, pages, approvals, transactions] = await Promise.all([
      this.searchTasks({ term, limit }),
      this.searchPages({ term, limit }),
      this.searchApprovals({ term, limit }),
      this.searchTransactions({ term, limit }),
    ]);

    return {
      items: [...tasks, ...pages, ...approvals, ...transactions]
        .sort((left, right) => {
          if (left.title === right.title) {
            return left.path.localeCompare(right.path);
          }
          return left.title.localeCompare(right.title);
        })
        .slice(0, limit),
    };
  }

  async create(input: CreateReferenceInput): Promise<Prisma.ReferenceGetPayload<object>> {
    validateReferenceEndpoint(input.from);
    validateReferenceEndpoint(input.to);

    if (input.from.type === input.to.type && input.from.id === input.to.id) {
      throw badRequest("References cannot target the same entity.");
    }

    await Promise.all([
      this.assertEntityExists(input.from),
      this.assertEntityExists(input.to),
    ]);

    const normalizedRelation = input.relation?.trim().slice(0, 80) || UNLABELED_REFERENCE_RELATION;

    const reference = await this.db.$transaction(async (tx) => {
      const existing = await listReferences(tx, {
        from: input.from,
        to: input.to,
      });

      const alreadyExists = existing.some((reference) => reference.relation === normalizedRelation);
      if (alreadyExists) {
        throw badRequest("This reference already exists.");
      }

      const nextReference = await createReference(tx, {
        from: input.from,
        to: input.to,
        relation: normalizedRelation,
      });

      await writeAuditLog(tx, {
        actorId: input.actorId,
        action: "reference.created",
        entityType: input.from.type,
        entityId: input.from.id,
        data: {
          from: input.from,
          to: input.to,
          relation: normalizedRelation,
        },
      });

      return nextReference;
    });

    return reference;
  }

  private async searchTasks(input: { term: string; limit: number }): Promise<SearchReferenceItem[]> {
    const rows = await this.db.task.findMany({
      where: {
        deletedAt: null,
        OR: [
          { title: { contains: input.term, mode: "insensitive" } },
          { description: { contains: input.term, mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: input.limit,
      select: {
        id: true,
        title: true,
        status: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      type: "TASK",
      title: row.title,
      subtitle: `Task · ${formatStatusLabel(row.status)}`,
      path: `/backlog?search=${encodeURIComponent(row.title)}`,
    }));
  }

  private async searchPages(input: { term: string; limit: number }): Promise<SearchReferenceItem[]> {
    const wildcard = `%${input.term}%`;

    const rows = await this.db.$queryRaw<Array<{
      id: string;
      title: string;
      text_projection: string | null;
      updated_at: Date;
    }>>(Prisma.sql`
      SELECT id, title, "textProjection" AS text_projection, "updatedAt" AS updated_at
      FROM "Page"
      WHERE "deletedAt" IS NULL
        AND (
          "title" ILIKE ${wildcard}
          OR "textProjection" ILIKE ${wildcard}
        )
        ORDER BY "updatedAt" DESC
        LIMIT ${input.limit}
    `);

    return rows.map((row) => ({
      id: row.id,
      type: "PAGE",
      title: row.title,
      subtitle: "Spec page",
      path: `/docs?pageId=${encodeURIComponent(row.id)}`,
    }));
  }

  private async searchApprovals(input: { term: string; limit: number }): Promise<SearchReferenceItem[]> {
    const rows = await this.db.approvalRequest.findMany({
      where: {
        OR: [
          { title: { contains: input.term, mode: "insensitive" } },
          { description: { contains: input.term, mode: "insensitive" } },
        ],
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: input.limit,
      select: {
        id: true,
        title: true,
        type: true,
        state: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      type: "APPROVAL",
      title: row.title,
      subtitle: `${row.type} approval · ${formatStateLabel(row.state)}`,
      path: `/approvals/${row.id}`,
    }));
  }

  private async searchTransactions(input: { term: string; limit: number }): Promise<SearchReferenceItem[]> {
    const rows = await this.db.transaction.findMany({
      where: {
        description: {
          contains: input.term,
          mode: "insensitive",
        },
      },
      orderBy: [
        { occurredAt: "desc" },
        { id: "desc" },
      ],
      take: input.limit,
      select: {
        id: true,
        description: true,
        status: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      type: "TRANSACTION",
      title: row.description?.trim() || "Transaction",
      subtitle: `Transaction · ${row.status}`,
      path: `/finance?search=${encodeURIComponent(row.id)}`,
    }));
  }

  private async assertEntityExists(target: ReferenceTarget) {
    const exists = await doesReferenceTargetExist(this.db, target);
    if (!exists) {
      throw notFound("Referenced entity not found.");
    }
  }
}

function normalizeLimit(input: number | undefined, max: number, fallback: number) {
  if (input === undefined) {
    return fallback;
  }

  if (Number.isNaN(input)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, input));
}

function validateReferenceEndpoint(target: ReferenceTarget) {
  if (!target.id.trim()) {
    throw badRequest("Reference id cannot be empty.");
  }

  if (!isReferenceType(target.type)) {
    throw badRequest("Unsupported reference type.");
  }
}

function isReferenceType(value: string): value is ReferenceType {
  return REFERENCE_TYPES.includes(value as ReferenceType);
}

function formatStatusLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function formatStateLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

async function doesReferenceTargetExist(db: ReferenceDb, target: ReferenceTarget) {
  if (target.type === "TASK") {
    const record = await db.task.findFirst({
      where: { id: target.id, deletedAt: null },
    });
    return Boolean(record);
  }

  if (target.type === "PAGE") {
    const record = await db.page.findFirst({
      where: { id: target.id, deletedAt: null },
    });
    return Boolean(record);
  }

  if (target.type === "APPROVAL") {
    const record = await db.approvalRequest.findFirst({
      where: { id: target.id },
    });
    return Boolean(record);
  }

  if (target.type === "TRANSACTION") {
    const record = await db.transaction.findFirst({
      where: { id: target.id },
    });
    return Boolean(record);
  }

  return false;
}

type DirectionMap = {
  idField: "toId" | "fromId";
  typeField: "toType" | "fromType";
};

type RawReferenceDirectionRow = Prisma.ReferenceGetPayload<object> & {
  toId: string;
  fromId: string;
};

async function resolveReferenceTargetRows(
  rows: Array<Prisma.ReferenceGetPayload<object>>,
  direction: DirectionMap,
  db: ReferenceDb,
): Promise<Array<ReferenceListItem>> {
  const targetIdsByType = bucketTargetIds(rows, direction);

  const summaries = await loadSummariesForTargetRows(db, targetIdsByType);

  const parsedRows = rows
    .map((reference) => {
      const row = reference as RawReferenceDirectionRow;
      const targetId = row[direction.idField];
      const targetType = row[direction.typeField];

      if (!isReferenceType(targetType)) {
        return null;
      }

      const summary = summaries[targetType]?.get(targetId);
      if (!summary) {
        return null;
      }

      return {
        relation: reference.relation,
        referenceId: reference.id,
        id: targetId,
        type: targetType,
        title: summary.title,
        subtitle: summary.subtitle,
        path: summary.path,
      } satisfies ReferenceListItem;
    })
    .filter((row): row is ReferenceListItem => row !== null);

  return parsedRows;
}

type TargetIdsByType = Partial<Record<ReferenceType, Set<string>>>;

type ReferenceSummary = {
  title: string;
  subtitle: string;
  path: string;
};

type ReferenceSummaryByType = Partial<Record<ReferenceType, Map<string, ReferenceSummary>>>;

async function loadSummariesForTargetRows(db: ReferenceDb, input: TargetIdsByType) {
  const summaries: ReferenceSummaryByType = {};

  const taskRows = await db.task.findMany({
    where: { id: { in: [...(input.TASK ?? [])] }, deletedAt: null },
    select: {
      id: true,
      title: true,
      status: true,
    },
  });

  if (taskRows.length > 0) {
    summaries.TASK = new Map(
      taskRows.map((row) => [
        row.id,
        {
          title: row.title,
          subtitle: `Task · ${formatStatusLabel(row.status)}`,
          path: `/backlog?search=${encodeURIComponent(row.title)}`,
        },
      ]),
    );
  }

  const pageRows = await db.page.findMany({
    where: { id: { in: [...(input.PAGE ?? [])] }, deletedAt: null },
    select: {
      id: true,
      title: true,
    },
  });

  if (pageRows.length > 0) {
    summaries.PAGE = new Map(
      pageRows.map((row) => [
        row.id,
        {
          title: row.title,
          subtitle: "Spec page",
          path: `/docs?pageId=${encodeURIComponent(row.id)}`,
        },
      ]),
    );
  }

  const approvalRows = await db.approvalRequest.findMany({
    where: { id: { in: [...(input.APPROVAL ?? [])] } },
    select: {
      id: true,
      title: true,
      type: true,
      state: true,
    },
  });

  if (approvalRows.length > 0) {
    summaries.APPROVAL = new Map(
      approvalRows.map((row) => [
        row.id,
        {
          title: row.title,
          subtitle: `${row.type} approval · ${formatStateLabel(row.state)}`,
          path: `/approvals/${row.id}`,
        },
      ]),
    );
  }

  const transactionRows = await db.transaction.findMany({
    where: { id: { in: [...(input.TRANSACTION ?? [])] } },
    select: {
      id: true,
      description: true,
      status: true,
    },
  });

  if (transactionRows.length > 0) {
    summaries.TRANSACTION = new Map(
      transactionRows.map((row) => [
        row.id,
        {
          title: row.description?.trim() || "Transaction",
          subtitle: `Transaction · ${row.status}`,
          path: `/finance?search=${encodeURIComponent(row.id)}`,
        },
      ]),
    );
  }

  return summaries;
}

function bucketTargetIds(rows: Array<Prisma.ReferenceGetPayload<object>>, direction: DirectionMap): TargetIdsByType {
  return rows.reduce((output, reference) => {
    const record = reference as RawReferenceDirectionRow;
    const targetType = record[direction.typeField];
    const targetId = record[direction.idField];

    if (!isReferenceType(targetType) || !targetId) {
      return output;
    }

    const bucket = output[targetType] ?? new Set<string>();
    bucket.add(targetId);
    output[targetType] = bucket;

    return output;
  }, {} as TargetIdsByType);
}

export function createReferencesService(db: (ReferenceDb & AuditLogTransaction) | PrismaClient) {
  return new ReferencesService(db as ReferenceDb & AuditLogTransaction);
}
