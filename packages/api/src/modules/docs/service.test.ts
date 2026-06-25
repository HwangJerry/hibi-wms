import { describe, expect, it } from "vitest";
import { EntityType, type Prisma, type Page, type Space } from "@hibi/db";
import { DocsService } from "./service.js";

type SpaceWhere = {
  id?: string;
  deletedAt?: null;
};

type SpaceFindArgs = {
  where?: SpaceWhere;
  orderBy?: { createdAt?: "asc" | "desc"; id?: "asc" | "desc" } | Array<{
    createdAt?: "asc" | "desc";
    id?: "asc" | "desc";
  }>;
  cursor?: { id?: string };
  skip?: number;
  take?: number;
};

type SpaceCreateArgs = {
  data: { name: string };
};

type SpaceUpdateArgs = {
  where: { id: string };
  data: Partial<Pick<Space, "name" | "deletedAt">>;
};

type PageWhere = {
  id?: string | { not: string };
  spaceId?: string;
  parentId?: string | null;
  deletedAt?: null;
};

type PageFindArgs = {
  where?: PageWhere;
  orderBy?:
    | { order?: "asc" | "desc"; id?: "asc" | "desc" }
    | Array<{ order?: "asc" | "desc"; id?: "asc" | "desc" }>;
  cursor?: { id: string };
  skip?: number;
  take?: number;
};

type PageCreateArgs = {
  data: {
    spaceId: string;
    parentId?: string | null;
    title: string;
    yDoc: Uint8Array;
    order: number;
  };
};

type PageUpdateArgs = {
  where: { id: string };
  data: Partial<Pick<Page, "title" | "parentId" | "order" | "deletedAt">>;
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

class InMemoryDocsDb {
  readonly spaces: Array<Space & { pages: never[] }> = [];
  readonly pages: Array<
    Omit<Page, "space" | "parent" | "children" | "versions"> & {
      space: Space;
      parent: Page | null;
      children: Page[];
      versions: never[];
    }
  > = [];
  readonly auditLogs: AuditLogEntry[] = [];
  private nextSpaceNumber = 1;
  private nextPageNumber = 1;
  private nextAuditNumber = 1;

  readonly space = {
    findMany: (args: SpaceFindArgs) => Promise.resolve(this.findSpaces(args)),
    findFirst: (args: { where?: SpaceWhere }) => {
      const space = this.findSpaces({ ...args, orderBy: { createdAt: "desc" } }).at(0);
      return Promise.resolve(space ?? null);
    },
    create: (args: SpaceCreateArgs) => {
      const now = new Date("2026-06-17T00:00:00.000Z");
      const space: Space & { pages: never[] } = {
        id: `space-${this.nextSpaceNumber}`,
        name: args.data.name,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        pages: [],
      };

      this.nextSpaceNumber += 1;
      this.spaces.push(space);
      return Promise.resolve(space);
    },
    update: (args: SpaceUpdateArgs) => {
      const space = this.spaces.find((candidate) => candidate.id === args.where.id);
      if (!space) {
        throw new Error(`Missing space ${args.where.id}`);
      }

      Object.assign(space, args.data, { updatedAt: new Date("2026-06-17T00:00:00.000Z") });
      return Promise.resolve(space);
    },
  };

  readonly page = {
    findMany: (args: PageFindArgs) => Promise.resolve(this.findPages(args)),
    findFirst: (args: { where?: PageWhere }) => {
      const page = this.findPages({ ...args, orderBy: { order: "asc" } }).at(0);
      return Promise.resolve(page ?? null);
    },
    create: (args: PageCreateArgs) => {
      const now = new Date("2026-06-17T00:00:00.000Z");
      const page = {
        id: `page-${this.nextPageNumber}`,
        title: args.data.title,
        spaceId: args.data.spaceId,
        parentId: args.data.parentId ?? null,
        yDoc: args.data.yDoc,
        order: args.data.order,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        versions: [],
        parent: null,
        children: [],
        space: this.getSpaceById(args.data.spaceId),
      };

      this.nextPageNumber += 1;
      this.pages.push(page);
      return Promise.resolve(page);
    },
    update: (args: PageUpdateArgs) => {
      const page = this.pages.find((candidate) => candidate.id === args.where.id);
      if (!page) {
        throw new Error(`Missing page ${args.where.id}`);
      }

      Object.assign(page, args.data, { updatedAt: new Date("2026-06-17T00:00:00.000Z") });
      return Promise.resolve(page);
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

  async $transaction<T>(fn: (tx: this) => Promise<T>) {
    return await fn(this);
  }

  addSpace(input: { id?: string; name: string; deletedAt?: Date | null }) {
    const now = new Date("2026-06-17T00:00:00.000Z");
    const space: Space & { pages: never[] } = {
      id: input.id ?? `space-${this.nextSpaceNumber}`,
      name: input.name,
      deletedAt: input.deletedAt ?? null,
      createdAt: now,
      updatedAt: now,
      pages: [],
    };
    this.nextSpaceNumber += 1;
    this.spaces.push(space);
  }

  addPage(input: {
    id?: string;
    spaceId: string;
    parentId?: string | null;
    title: string;
    order: number;
    deletedAt?: Date | null;
  }) {
    const now = new Date("2026-06-17T00:00:00.000Z");
    const page = {
      id: input.id ?? `page-${this.nextPageNumber}`,
      title: input.title,
      spaceId: input.spaceId,
      parentId: input.parentId ?? null,
      yDoc: new Uint8Array(),
      order: input.order,
      deletedAt: input.deletedAt ?? null,
      createdAt: now,
      updatedAt: now,
      versions: [],
      parent: null,
      children: [],
      space: this.getSpaceById(input.spaceId),
    };
    this.nextPageNumber += 1;
    this.pages.push(page);
  }

  private getSpaceById(spaceId: string) {
    const space = this.spaces.find((candidate) => candidate.id === spaceId);
    if (!space) {
      throw new Error(`Space ${spaceId} not found`);
    }

    return space;
  }

  private findSpaces(args: SpaceFindArgs) {
    const where = args.where;
    const matches = this.spaces.filter((space) => {
      const matchesId = where?.id === undefined || space.id === where.id;
      const matchesDeletedAt =
        where?.deletedAt === undefined || space.deletedAt === where.deletedAt;
      return matchesId && matchesDeletedAt;
    });
    const orderBy = normalizeOrderBy(args.orderBy);

    let orderedSpaces = [...matches];
    if (orderBy.length > 0) {
      orderedSpaces = orderedSpaces.sort((left, right) => {
        for (const order of orderBy) {
          if (order.createdAt) {
            const direction = order.createdAt === "asc" ? 1 : -1;
            const createdAtDiff = (left.createdAt.getTime() - right.createdAt.getTime()) * direction;
            if (createdAtDiff !== 0) {
              return createdAtDiff;
            }
          }

          if (order.id) {
            const direction = order.id === "asc" ? 1 : -1;
            const idDiff = left.id.localeCompare(right.id) * direction;
            if (idDiff !== 0) {
              return idDiff;
            }
          }
        }

        return 0;
      });
    }

    if (!args.cursor?.id) {
      return args.take !== undefined ? orderedSpaces.slice(0, args.take) : orderedSpaces;
    }

    const cursorIndex = orderedSpaces.findIndex((space) => space.id === args.cursor?.id);
    const start = cursorIndex >= 0 ? cursorIndex + (args.skip ?? 0) : 0;
    const end = args.take !== undefined ? start + args.take : undefined;
    return orderedSpaces.slice(start, end);
  }

  private findPages(args: PageFindArgs) {
    const where = args.where;
    const matches = this.pages.filter((page) => {
      const matchesId =
        where?.id === undefined
          ? true
          : typeof where.id === "string"
          ? page.id === where.id
          : page.id !== where.id.not;
      const matchesSpace = where?.spaceId === undefined || page.spaceId === where.spaceId;
      const matchesParent = where?.parentId === undefined || page.parentId === where.parentId;
      const matchesDeletedAt =
        where?.deletedAt === undefined || page.deletedAt === where.deletedAt;
      return matchesId && matchesSpace && matchesParent && matchesDeletedAt;
    });

    const orderBy = normalizeOrderBy(args.orderBy);
    let orderedPages = [...matches];
    if (orderBy.length > 0) {
      orderedPages = orderedPages.sort((left, right) => {
        for (const order of orderBy) {
          if (order.order) {
            const direction = order.order === "asc" ? 1 : -1;
            const orderDiff = (left.order - right.order) * direction;
            if (orderDiff !== 0) {
              return orderDiff;
            }
          }

          if (order.id) {
            const direction = order.id === "asc" ? 1 : -1;
            const idDiff = left.id.localeCompare(right.id) * direction;
            if (idDiff !== 0) {
              return idDiff;
            }
          }
        }

        return 0;
      });
    }

    if (!args.cursor?.id) {
      return args.take !== undefined ? orderedPages.slice(0, args.take) : orderedPages;
    }

    const cursorIndex = orderedPages.findIndex((page) => page.id === args.cursor?.id);
    const start = cursorIndex >= 0 ? cursorIndex + (args.skip ?? 0) : 0;
    const end = args.take !== undefined ? start + args.take : undefined;
    return orderedPages.slice(start, end);
  }
}

function normalizeOrderBy<T>(orderBy: T | readonly T[] | undefined): T[] {
  if (!orderBy) {
    return [];
  }

  return Array.isArray(orderBy) ? [...orderBy] : [orderBy];
}

function createService() {
  const db = new InMemoryDocsDb();
  return {
    db,
    service: new DocsService(db),
  };
}

describe("DocsService", () => {
  it("builds nested page trees with deterministic sibling order", async () => {
    const { db, service } = createService();
    db.addSpace({ id: "space-1", name: "Product" });
    db.addPage({ id: "root-a", spaceId: "space-1", title: "Root A", order: 2048 });
    db.addPage({ id: "root-b", spaceId: "space-1", title: "Root B", order: 1024 });
    db.addPage({
      id: "a-2",
      spaceId: "space-1",
      parentId: "root-a",
      title: "A 2",
      order: 2048,
    });
    db.addPage({
      id: "a-1",
      spaceId: "space-1",
      parentId: "root-a",
      title: "A 1",
      order: 1024,
    });
    db.addPage({
      id: "b-1",
      spaceId: "space-1",
      parentId: "root-b",
      title: "B 1",
      order: 1024,
    });

    const tree = await service.pagesTree({ spaceId: "space-1" });

    expect(tree).toMatchObject([
      {
        id: "root-b",
        children: [{ id: "b-1", children: [] }],
      },
      {
        id: "root-a",
        children: [
          { id: "a-1", children: [] },
          { id: "a-2", children: [] },
        ],
      },
    ]);
  });

  it("moves a page under a parent and reorders between siblings", async () => {
    const { db, service } = createService();
    db.addSpace({ id: "space-1", name: "Product" });
    db.addPage({ id: "parent-a", spaceId: "space-1", title: "Parent A", order: 1024 });
    db.addPage({ id: "parent-b", spaceId: "space-1", title: "Parent B", order: 2048 });
    db.addPage({
      id: "moving",
      spaceId: "space-1",
      parentId: "parent-a",
      title: "Moving",
      order: 1024,
    });
    db.addPage({
      id: "b-child-1",
      spaceId: "space-1",
      parentId: "parent-b",
      title: "B Child 1",
      order: 1024,
    });
    db.addPage({
      id: "b-child-2",
      spaceId: "space-1",
      parentId: "parent-b",
      title: "B Child 2",
      order: 2048,
    });

    const moved = await service.movePage({
      actorId: "user-1",
      id: "moving",
      parentId: "parent-b",
    });
    const reordered = await service.reorderPage({
      actorId: "user-1",
      id: "moving",
      beforeId: "b-child-1",
      afterId: "b-child-2",
    });

    expect(moved.parentId).toBe("parent-b");
    expect(moved.order).toBe(2048);
    expect(reordered.order).toBe(1536);
    expect(db.auditLogs).toMatchObject([
      { actorId: "user-1", entityType: EntityType.PAGE, action: "page.moved" },
      { actorId: "user-1", entityType: EntityType.PAGE, action: "page.reordered" },
    ]);
  });
});
