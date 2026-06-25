import { badRequest, notFound, writeAuditLog } from "@hibi/core";
import type { AuditLogTransaction } from "@hibi/core";
import { EntityType } from "@hibi/db";
import type { Page, PageVersion, Prisma, PrismaClient, Space, User } from "@hibi/db";

const INITIAL_ORDER = 1024;
const MIN_ORDER_GAP = 0.000001;
const PERIODIC_VERSION_LABEL = "Auto snapshot";
const MAX_VERSION_LABEL_LENGTH = 120;

type SpaceDelegate = {
  findMany(args: Prisma.SpaceFindManyArgs): Promise<Space[]>;
  findFirst(args: Prisma.SpaceFindFirstArgs): Promise<Space | null>;
  create(args: { data: Prisma.SpaceCreateInput }): Promise<Space>;
  update(args: {
    where: Prisma.SpaceWhereUniqueInput;
    data: Prisma.SpaceUpdateInput;
  }): Promise<Space>;
};

type PageDelegate = {
  findMany(args: Prisma.PageFindManyArgs): Promise<Page[]>;
  findFirst(args: Prisma.PageFindFirstArgs): Promise<Page | null>;
  create(args: { data: Prisma.PageUncheckedCreateInput }): Promise<Page>;
  update(args: {
    where: Prisma.PageWhereUniqueInput;
    data: Prisma.PageUncheckedUpdateInput;
  }): Promise<Page>;
};

type PageVersionDelegate = {
  create(args: {
    data: Prisma.PageVersionUncheckedCreateInput;
  }): Promise<PageVersion>;
  findMany(
    args: Prisma.PageVersionFindManyArgs,
  ): Promise<Array<PageVersion & { author: Pick<User, "id" | "name"> }>>;
  findFirst(
    args: Prisma.PageVersionFindFirstArgs,
  ): Promise<(PageVersion & { author: Pick<User, "id" | "name"> }) | null>;
};

type DocsTransaction = {
  page: PageDelegate;
  space: SpaceDelegate;
  pageVersion?: PageVersionDelegate;
} & AuditLogTransaction;

export type DocsServiceDb = {
  $transaction<T>(fn: (tx: DocsTransaction) => Promise<T>): Promise<T>;
  page: PageDelegate;
  space: SpaceDelegate;
  pageVersion?: PageVersionDelegate;
};

export type ListVersionsInput = {
  pageId: string;
  cursor?: string;
  limit: number;
};

export type CreatePageVersionInput = {
  actorId: string;
  pageId: string;
  yDoc: string;
  label?: string | null;
  textProjection?: string | null;
};

export type RestorePageVersionInput = {
  actorId: string;
  pageId: string;
  versionId: string;
};

export type ListSpacesInput = {
  cursor?: string;
  limit: number;
};

export type CreateSpaceInput = {
  actorId: string;
  name: string;
};

export type RenameSpaceInput = {
  actorId: string;
  id: string;
  name: string;
};

export type SoftDeleteSpaceInput = {
  actorId: string;
  id: string;
};

export type PagesTreeInput = {
  spaceId: string;
};

export type GetPageInput = {
  id: string;
};

export type CreatePageInput = {
  actorId: string;
  spaceId: string;
  parentId?: string | null;
  title: string;
};

export type RenamePageInput = {
  actorId: string;
  id: string;
  title: string;
};

export type MovePageInput = {
  actorId: string;
  id: string;
  parentId?: string | null;
};

export type ReorderPageInput = {
  actorId: string;
  id: string;
  beforeId?: string;
  afterId?: string;
};

export type SoftDeletePageInput = {
  actorId: string;
  id: string;
};

export type PageVersionMetadata = {
  id: string;
  pageId: string;
  label: string | null;
  createdAt: Date;
  author: Pick<User, "id" | "name">;
};

export type VersionRestoreResult = {
  yDoc: string;
  versionId: string;
};

export type SpaceMetadata = Pick<
  Space,
  "id" | "name" | "deletedAt" | "createdAt" | "updatedAt"
>;

export type PageMetadata = Omit<Page, "yDoc">;

export type PageTreeNode = PageMetadata & {
  children: PageTreeNode[];
};

export class DocsService {
  constructor(private readonly db: DocsServiceDb) {}

  async listSpaces(input: ListSpacesInput) {
    const take = input.limit + 1;
    const spaces = await this.db.space.findMany({
      where: { deletedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      cursor: input.cursor ? { id: input.cursor } : undefined,
      skip: input.cursor ? 1 : undefined,
      take,
    });

    const items: SpaceMetadata[] = spaces.slice(0, input.limit);
    const nextCursor = spaces.length > input.limit ? items.at(-1)?.id : undefined;

    return { items, nextCursor };
  }

  async createSpace(input: CreateSpaceInput) {
    return await this.db.$transaction(async (tx) => {
      const space = await tx.space.create({
        data: {
          name: input.name,
        },
      });

      await writeAuditLog(tx, {
        actorId: input.actorId,
        action: "space.created",
        entityType: EntityType.PAGE,
        entityId: space.id,
        data: {
          spaceName: space.name,
        },
      });

      return space;
    });
  }

  async renameSpace(input: RenameSpaceInput) {
    return await this.db.$transaction(async (tx) => {
      const space = await getActiveSpaceOrThrow(tx.space, input.id);
      const renamedSpace = await tx.space.update({
        where: { id: input.id },
        data: { name: input.name },
      });

      await writeAuditLog(tx, {
        actorId: input.actorId,
        action: "space.renamed",
        entityType: EntityType.PAGE,
        entityId: renamedSpace.id,
        data: {
          previousName: space.name,
          nextName: renamedSpace.name,
        },
      });

      return renamedSpace;
    });
  }

  async softDeleteSpace(input: SoftDeleteSpaceInput) {
    return await this.db.$transaction(async (tx) => {
      const space = await getActiveSpaceOrThrow(tx.space, input.id);
      const deletedAt = new Date();
      const softDeleted = await tx.space.update({
        where: { id: input.id },
        data: { deletedAt },
      });

      await writeAuditLog(tx, {
        actorId: input.actorId,
        action: "space.deleted",
        entityType: EntityType.PAGE,
        entityId: softDeleted.id,
        data: {
          spaceName: space.name,
          deletedAt: deletedAt.toISOString(),
        },
      });

      return softDeleted;
    });
  }

  async pagesTree(input: PagesTreeInput) {
    await getActiveSpaceOrThrow(this.db.space, input.spaceId);
    const pages = await this.db.page.findMany({
      where: {
        spaceId: input.spaceId,
        deletedAt: null,
      },
      orderBy: [{ order: "asc" }, { id: "asc" }],
    });

    return buildPageTree(pages.map(toPageMetadata));
  }

  async getPage(input: GetPageInput) {
    const page = await getActivePageOrThrow(this.db.page, input.id);
    return toPageMetadata(page);
  }

  async createPage(input: CreatePageInput) {
    return await this.db.$transaction(async (tx) => {
      const space = await getActiveSpaceOrThrow(tx.space, input.spaceId);
      const parentId = input.parentId ?? null;
      await ensureParentPageIsInSpace(tx, parentId, space.id);
      const order = await getNextOrder(tx.page, parentId);

      const page = await tx.page.create({
        data: {
          spaceId: input.spaceId,
          parentId,
          title: input.title,
          yDoc: new Uint8Array(),
          order,
        },
      });

      await writeAuditLog(tx, {
        actorId: input.actorId,
        action: "page.created",
        entityType: EntityType.PAGE,
        entityId: page.id,
        data: {
          spaceId: page.spaceId,
          parentId: page.parentId,
          title: page.title,
        },
      });

      return toPageMetadata(page);
    });
  }

  async renamePage(input: RenamePageInput) {
    return await this.db.$transaction(async (tx) => {
      const existingPage = await getActivePageOrThrow(tx.page, input.id);
      const page = await tx.page.update({
        where: { id: input.id },
        data: { title: input.title },
      });

      await writeAuditLog(tx, {
        actorId: input.actorId,
        action: "page.renamed",
        entityType: EntityType.PAGE,
        entityId: page.id,
        data: {
          titleBefore: existingPage.title,
          titleAfter: page.title,
        },
      });

      return toPageMetadata(page);
    });
  }

  async movePage(input: MovePageInput) {
    return await this.db.$transaction(async (tx) => {
      const page = await getActivePageOrThrow(tx.page, input.id);
      const parentId = input.parentId ?? null;

      await ensureMoveParentOrRoot(tx, {
        movingPageId: page.id,
        movingPageSpaceId: page.spaceId,
        targetParentId: parentId,
      });

      const data: Prisma.PageUncheckedUpdateInput = {
        parentId,
      };

      if (parentId !== page.parentId) {
        data.order = await getNextOrder(tx.page, parentId, page.id);
      }

      const movedPage = await tx.page.update({
        where: { id: input.id },
        data,
      });

      await writeAuditLog(tx, {
        actorId: input.actorId,
        action: "page.moved",
        entityType: EntityType.PAGE,
        entityId: movedPage.id,
        data: {
          spaceId: movedPage.spaceId,
          fromParentId: page.parentId,
          toParentId: movedPage.parentId,
        },
      });

      return toPageMetadata(movedPage);
    });
  }

  async reorderPage(input: ReorderPageInput) {
    if (input.beforeId === input.id || input.afterId === input.id) {
      throw badRequest("A page cannot be reordered relative to itself.");
    }

    return await this.db.$transaction(async (tx) => {
      const page = await getActivePageOrThrow(tx.page, input.id);
      const before = await getNeighbour(tx, input.beforeId);
      const after = await getNeighbour(tx, input.afterId);
      const parentId = getReorderParentId(page, before, after);

      await ensureMoveParentOrRoot(tx, {
        movingPageId: page.id,
        movingPageSpaceId: page.spaceId,
        targetParentId: parentId,
      });

      const order = await getReorderOrder(tx, {
        pageId: page.id,
        parentId,
        before,
        after,
      });

      const reorderedPage = await tx.page.update({
        where: { id: input.id },
        data: { parentId, order },
      });

      await writeAuditLog(tx, {
        actorId: input.actorId,
        action: "page.reordered",
        entityType: EntityType.PAGE,
        entityId: reorderedPage.id,
        data: {
          spaceId: reorderedPage.spaceId,
          parentId: reorderedPage.parentId,
          beforeId: before?.id ?? null,
          afterId: after?.id ?? null,
          order: reorderedPage.order,
        },
      });

      return toPageMetadata(reorderedPage);
    });
  }

  async softDeletePage(input: SoftDeletePageInput) {
    return await this.db.$transaction(async (tx) => {
      const page = await getActivePageOrThrow(tx.page, input.id);
      const deletedAt = new Date();
      const softDeleted = await tx.page.update({
        where: { id: input.id },
        data: { deletedAt },
      });

      await writeAuditLog(tx, {
        actorId: input.actorId,
        action: "page.deleted",
        entityType: EntityType.PAGE,
        entityId: softDeleted.id,
        data: {
          title: page.title,
          deletedAt: deletedAt.toISOString(),
        },
      });

      return toPageMetadata(softDeleted);
    });
  }

  async listVersions(input: ListVersionsInput) {
    await getActivePageOrThrow(this.db.page, input.pageId);
    const take = input.limit + 1;

    const versions = await getPageVersionDelegate(this.db).findMany({
      where: {
        pageId: input.pageId,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      cursor: input.cursor ? { id: input.cursor } : undefined,
      skip: input.cursor ? 1 : undefined,
      take,
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const items: Array<PageVersionMetadata> = versions
      .slice(0, input.limit)
      .map((version) => ({
        id: version.id,
        pageId: version.pageId,
        label: version.label,
        createdAt: version.createdAt,
        author: version.author,
      }));

    const nextCursor = versions.length > input.limit ? items.at(-1)?.id : undefined;
    return { items, nextCursor };
  }

  async createVersion(input: CreatePageVersionInput) {
    return await this.db.$transaction(async (tx) => {
      const page = await getActivePageOrThrow(tx.page, input.pageId);
      const yDoc = decodeBase64Bytes(input.yDoc);
      const textProjection = normalizeTextProjection(input.textProjection);

      const createdVersion = await getPageVersionDelegate(tx).create({
        data: {
          pageId: page.id,
          authorId: input.actorId,
          label: normalizeVersionLabel(input.label),
          yDoc,
        },
      });

      await writeAuditLog(tx, {
        actorId: input.actorId,
        action: "page.version.created",
        entityType: EntityType.PAGE,
        entityId: page.id,
        data: {
          versionId: createdVersion.id,
          label: createdVersion.label,
          pageTitle: page.title,
        },
      });

      await tx.page.update({
        where: { id: page.id },
        data: { textProjection: textProjection },
      });

      return createdVersion;
    });
  }

  async createPeriodicVersion(input: CreatePageVersionInput) {
    return await this.createVersion({
      ...input,
      label: PERIODIC_VERSION_LABEL,
    });
  }

  async restoreVersion(input: RestorePageVersionInput): Promise<VersionRestoreResult> {
    return await this.db.$transaction(async (tx) => {
      const page = await getActivePageOrThrow(tx.page, input.pageId);
      const version = await getPageVersionDelegate(tx).findFirst({
        where: {
          id: input.versionId,
          pageId: page.id,
        },
      });

      if (!version) {
        throw notFound("Version not found.");
      }

      const restoredPage = await tx.page.update({
        where: { id: page.id },
        data: {
          yDoc: version.yDoc,
        },
      });

      await writeAuditLog(tx, {
        actorId: input.actorId,
        action: "page.version.restored",
        entityType: EntityType.PAGE,
        entityId: restoredPage.id,
        data: {
          restoredVersionId: version.id,
          pageTitle: restoredPage.title,
        },
      });

      return {
        yDoc: encodeBytesToBase64(version.yDoc),
        versionId: version.id,
      };
    });
  }
}

export function createDocsService(db: DocsServiceDb | PrismaClient) {
  return new DocsService(db as DocsServiceDb);
}

type DocsReader = {
  page: Pick<PageDelegate, "findFirst" | "findMany" | "update">;
  space: Pick<SpaceDelegate, "findFirst">;
};

type ReorderInput = {
  pageId: string;
  parentId: string | null;
  before: { id: string; parentId: string | null; order: number } | undefined;
  after: { id: string; parentId: string | null; order: number } | undefined;
};

type OrderNeighbour = Pick<Page, "id" | "parentId" | "order">;

async function getActiveSpaceOrThrow(tx: Pick<SpaceDelegate, "findFirst">, id: string) {
  const space = await tx.findFirst({
    where: { id, deletedAt: null },
  });

  if (!space) {
    throw notFound("Space not found.");
  }

  return space;
}

async function getActivePageOrThrow(tx: Pick<PageDelegate, "findFirst">, id: string) {
  const page = await tx.findFirst({
    where: { id, deletedAt: null },
  });

  if (!page) {
    throw notFound("Page not found.");
  }

  return page;
}

function toPageMetadata(page: Page): PageMetadata {
  const { yDoc: _yDoc, ...metadata } = page;
  return metadata;
}

function getPageVersionDelegate(tx: Pick<DocsTransaction, "pageVersion">) {
  if (!tx.pageVersion) {
    throw badRequest("Version history is unavailable.");
  }

  return tx.pageVersion;
}

function normalizeVersionLabel(input?: string | null) {
  const trimmed = input?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, MAX_VERSION_LABEL_LENGTH);
}

function normalizeTextProjection(input?: string | null) {
  return input?.trim().slice(0, 2000) ?? "";
}

function decodeBase64Bytes(data: string) {
  const decoded = Buffer.from(data, "base64");
  if (decoded.byteLength === 0) {
    throw badRequest("Invalid snapshot payload.");
  }

  return decoded;
}

function encodeBytesToBase64(data: Uint8Array) {
  return Buffer.from(data).toString("base64");
}

async function getNeighbour(tx: DocsReader, id: string | undefined) {
  if (!id) {
    return undefined;
  }

  const page = await getActivePageOrThrow(tx.page, id);
  return {
    id: page.id,
    parentId: page.parentId,
    order: page.order,
  };
}

function getReorderParentId(
  page: Page,
  before: OrderNeighbour | undefined,
  after: OrderNeighbour | undefined,
) {
  const parentId = before?.parentId ?? after?.parentId ?? page.parentId;

  if (before !== undefined && before.parentId !== parentId) {
    throw badRequest("beforeId and afterId must be in the same parent list.");
  }

  if (after !== undefined && after.parentId !== parentId) {
    throw badRequest("beforeId and afterId must be in the same parent list.");
  }

  if (before && after && before.order >= after.order) {
    throw badRequest("beforeId must come before afterId.");
  }

  return parentId;
}

async function ensureMoveParentOrRoot(
  tx: DocsReader,
  input: {
    movingPageId: string;
    movingPageSpaceId: string;
    targetParentId: string | null;
  },
) {
  if (input.targetParentId === null) {
    return;
  }

  if (input.targetParentId === input.movingPageId) {
    throw badRequest("A page cannot be moved into itself.");
  }

  const targetParent = await getActivePageOrThrow(tx.page, input.targetParentId);
  if (targetParent.spaceId !== input.movingPageSpaceId) {
    throw badRequest("A page cannot be moved into another space.");
  }

  const targetIsDescendant = await isParentOfPage({
    tx,
    maybeDescendantId: input.targetParentId,
    pageId: input.movingPageId,
  });
  if (targetIsDescendant) {
    throw badRequest("A page cannot be moved into one of its own descendants.");
  }
}

async function isParentOfPage(input: {
  tx: DocsReader;
  maybeDescendantId: string;
  pageId: string;
}) {
  let currentId: string | null = input.maybeDescendantId;

  while (currentId) {
    if (currentId === input.pageId) {
      return true;
    }

    const page = await input.tx.page.findFirst({
      where: { id: currentId, deletedAt: null },
    });

    if (!page) {
      return false;
    }

    currentId = page.parentId;
  }

  return false;
}

async function ensureParentPageIsInSpace(tx: DocsReader, parentId: string | null, spaceId: string) {
  if (parentId === null) {
    return;
  }

  const parent = await getActivePageOrThrow(tx.page, parentId);
  if (parent.spaceId !== spaceId) {
    throw badRequest("Parent page is in a different space.");
  }
}

async function getReorderOrder(
  tx: DocsReader,
  input: ReorderInput,
) {
  if (input.before === undefined && input.after === undefined) {
    return await getNextOrder(tx.page, input.parentId, input.pageId);
  }

  const order = getFractionalOrder(input.before?.order, input.after?.order);
  if (order !== undefined && hasUsableOrderGap(input.before?.order, input.after?.order)) {
    return order;
  }

  const pages = await tx.page.findMany({
    where: {
      parentId: input.parentId,
      deletedAt: null,
      id: { not: input.pageId },
    },
    orderBy: { order: "asc" },
  });

  const balancedPages = pages.map((page, index) => ({
    ...page,
    order: getBalancedOrder(index),
  }));

  for (const page of balancedPages) {
    await tx.page.update({
      where: { id: page.id },
      data: { order: page.order },
    });
  }

  const before = input.before
    ? balancedPages.find((candidate) => candidate.id === input.before?.id)
    : undefined;
  const after = input.after
    ? balancedPages.find((candidate) => candidate.id === input.after?.id)
    : undefined;

  return getFractionalOrder(before?.order, after?.order) ?? getNextBalancedOrder(pages.length);
}

function getFractionalOrder(beforeOrder: number | undefined, afterOrder: number | undefined) {
  if (beforeOrder === undefined) {
    return afterOrder === undefined ? INITIAL_ORDER : afterOrder / 2;
  }

  if (afterOrder === undefined) {
    return beforeOrder + INITIAL_ORDER;
  }

  return (beforeOrder + afterOrder) / 2;
}

function hasUsableOrderGap(beforeOrder: number | undefined, afterOrder: number | undefined) {
  if (beforeOrder === undefined || afterOrder === undefined) {
    return beforeOrder === undefined && afterOrder !== undefined
      ? afterOrder > MIN_ORDER_GAP
      : true;
  }

  return afterOrder - beforeOrder > MIN_ORDER_GAP;
}

async function getNextOrder(
  tx: Pick<PageDelegate, "findFirst">,
  parentId: string | null,
  excludingPageId?: string,
) {
  const filterId = excludingPageId ? { not: excludingPageId } : undefined;

  const lastPage = await tx.findFirst({
    where: {
      parentId,
      deletedAt: null,
      id: filterId,
    },
    orderBy: { order: "desc" },
  });

  return lastPage ? lastPage.order + INITIAL_ORDER : INITIAL_ORDER;
}

function getBalancedOrder(index: number) {
  return (index + 1) * INITIAL_ORDER;
}

function getNextBalancedOrder(taskCount: number) {
  return (taskCount + 1) * INITIAL_ORDER;
}

function buildPageTree(pages: Array<PageMetadata>): PageTreeNode[] {
  const nodes = new Map<string, PageTreeNode>();
  for (const page of pages) {
    nodes.set(page.id, { ...page, children: [] });
  }

  const roots: PageTreeNode[] = [];
  for (const node of nodes.values()) {
    if (!node.parentId || !nodes.has(node.parentId)) {
      roots.push(node);
      continue;
    }

    const parent = nodes.get(node.parentId);
    if (parent) {
      parent.children.push(node);
    }
  }

  const sortByOrder = (siblings: PageTreeNode[]) => {
    siblings.sort((left, right) => {
      const orderDifference = left.order - right.order;
      if (orderDifference !== 0) {
        return orderDifference;
      }

      return left.id.localeCompare(right.id);
    });

    for (const sibling of siblings) {
      sortByOrder(sibling.children);
    }
  };

  sortByOrder(roots);
  return roots;
}
