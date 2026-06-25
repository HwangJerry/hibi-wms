import { Prisma } from "@hibi/db";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;
const SEARCH_TERM_MAX_LENGTH = 200;
const MIN_SNIPPET_MATCH_CHARS = 90;

export type GlobalSearchInput = {
  term: string;
  limit?: number;
};

export type SearchResultType = "TASK" | "PAGE" | "TRANSACTION";

export type SearchResultItem = {
  id: string;
  type: SearchResultType;
  title: string;
  snippet: string;
  path: string;
};

type SearchDb = {
  task: {
    findMany(args: Prisma.TaskFindManyArgs): Promise<Array<{
      id: string;
      title: string;
      description: string | null;
      updatedAt: Date;
    }>>;
  };
  transaction: {
    findMany(args: Prisma.TransactionFindManyArgs): Promise<Array<{
      id: string;
      description: string | null;
      updatedAt: Date;
    }>>;
  };
  $queryRaw<T>(query: Prisma.Sql): Promise<T>;
};

type SearchResponse = {
  tasks: SearchResultItem[];
  pages: SearchResultItem[];
  transactions: SearchResultItem[];
};

type RawPageSearchRow = {
  id: string;
  title: string;
  text_projection: string | null;
  updated_at: Date;
};

export class SearchService {
  constructor(private readonly db: SearchDb) {}

  async global(input: GlobalSearchInput) {
    const term = input.term.trim().slice(0, SEARCH_TERM_MAX_LENGTH);
    const limit = clampLimit(input.limit);

    const [tasks, pages, transactions] = await Promise.all([
      this.searchTasks({ term, limit }),
      this.searchPages({ term, limit }),
      this.searchTransactions({ term, limit }),
    ]);

    return {
      tasks,
      pages,
      transactions,
    } satisfies SearchResponse;
  }

  private async searchTasks(input: { term: string; limit: number }) {
    const rows = await this.db.task.findMany({
      where: {
        deletedAt: null,
        OR: [
          {
            title: {
              contains: input.term,
              mode: "insensitive",
            },
          },
          {
            description: {
              contains: input.term,
              mode: "insensitive",
            },
          },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: input.limit,
      select: {
        id: true,
        title: true,
        description: true,
        updatedAt: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      type: "TASK" as const,
      path: `/backlog?search=${encodeURIComponent(input.term)}`,
      title: row.title,
      snippet: buildSnippet(`${row.title} ${row.description ?? ""}`, input.term),
    }));
  }

  private async searchTransactions(input: { term: string; limit: number }) {
    const rows = await this.db.transaction.findMany({
      where: {
        description: {
          contains: input.term,
          mode: "insensitive",
        },
      },
      orderBy: { occurredAt: "desc" },
      take: input.limit,
      select: {
        id: true,
        description: true,
        updatedAt: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      type: "TRANSACTION" as const,
      path: `/finance?search=${encodeURIComponent(input.term)}`,
      title: row.description?.trim() || "Transaction",
      snippet: buildSnippet(row.description ?? "", input.term),
    }));
  }

  private async searchPages(input: { term: string; limit: number }) {
    const wildcard = `%${input.term}%`;

    const rows = await this.db.$queryRaw<Array<RawPageSearchRow>>(Prisma.sql`
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
      type: "PAGE" as const,
      path: `/docs?pageId=${encodeURIComponent(row.id)}`,
      title: row.title,
      snippet: buildSnippet(`${row.title} ${(row.text_projection ?? "").trim()}`, input.term),
    }));
  }
}

export function createSearchService(db: SearchDb) {
  return new SearchService(db);
}

function buildSnippet(value: string, term: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "No matching text.";
  }

  const index = compact.toLowerCase().indexOf(term.toLowerCase());
  if (index === -1) {
    return compact.slice(0, MIN_SNIPPET_MATCH_CHARS);
  }

  const start = Math.max(0, index - 45);
  const end = Math.min(compact.length, index + term.length + 45);
  const prefix = start === 0 ? "" : "…";
  const suffix = end === compact.length ? "" : "…";

  return `${prefix}${compact.slice(start, end)}${suffix}`;
}

function clampLimit(limit: number | undefined) {
  if (limit === undefined) {
    return DEFAULT_LIMIT;
  }

  if (Number.isNaN(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(1, Math.min(MAX_LIMIT, limit));
}
