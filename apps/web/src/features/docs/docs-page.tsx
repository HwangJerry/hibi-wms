import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/providers/trpc-provider";
import {
  Avatar,
  Button,
  DocsShell,
  type DocsPageMoveCommand,
  type DocsPageTreeNode,
} from "@hibi/ui";
import { DocsPageEditor } from "./docs-page-editor";
import { Clock3, Share2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";

interface DocsPageProps {
  userId: string;
  userName: string;
}

interface ApiPageTreeNode {
  id: string;
  title: string;
  children: ApiPageTreeNode[];
}

const DEFAULT_PAGE_TITLE = "Untitled page";
const DEFAULT_SPACE_NAME = "Default space";

const SPACE_LIST_LIMIT = 100;

export function DocsPage({ userId, userName }: DocsPageProps) {
  const [pages, setPages] = useState<DocsPageTreeNode[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  const utils = trpc.useUtils();
  const hasCreatedDefaultSpaceRef = useRef(false);

  const spacesQuery = trpc.docs.spaces.list.useQuery({
    limit: SPACE_LIST_LIMIT,
  });

  const createSpaceMutation = trpc.docs.spaces.create.useMutation({
    onSuccess: (createdSpace) => {
      setSpaceId(createdSpace.id);
      void spacesQuery.refetch();
    },
  });

  const treeQuery = trpc.docs.pages.tree.useQuery(
    {
      spaceId: spaceId ?? "",
    },
    {
      enabled: Boolean(spaceId),
    }
  );

  const createPageMutation = trpc.docs.pages.create.useMutation({
    onSuccess: async () => {
      if (spaceId) {
        await utils.docs.pages.tree.invalidate({ spaceId });
      }
    },
  });

  const renamePageMutation = trpc.docs.pages.rename.useMutation();

  const movePageMutation = trpc.docs.pages.move.useMutation({
    onSuccess: async () => {
      if (spaceId) {
        await utils.docs.pages.tree.invalidate({ spaceId });
      }
    },
    onError: async () => {
      if (spaceId) {
        await utils.docs.pages.tree.invalidate({ spaceId });
      }
    },
  });

  const reorderPageMutation = trpc.docs.pages.reorder.useMutation({
    onSuccess: async () => {
      if (spaceId) {
        await utils.docs.pages.tree.invalidate({ spaceId });
      }
    },
    onError: async () => {
      if (spaceId) {
        await utils.docs.pages.tree.invalidate({ spaceId });
      }
    },
  });

  useEffect(() => {
    if (spacesQuery.isLoading) {
      return;
    }

    const [firstSpace] = spacesQuery.data?.items ?? [];
    if (firstSpace && spaceId === null) {
      setSpaceId(firstSpace.id);
      return;
    }

    if (!spacesQuery.data || spacesQuery.data.items.length > 0) {
      return;
    }

    if (hasCreatedDefaultSpaceRef.current || createSpaceMutation.isPending) {
      return;
    }

    hasCreatedDefaultSpaceRef.current = true;
    void createSpaceMutation.mutateAsync({
      name: DEFAULT_SPACE_NAME,
    });
  }, [
    createSpaceMutation,
    createSpaceMutation.isPending,
    createSpaceMutation.status,
    spaceId,
    spacesQuery.data,
    spacesQuery.isLoading,
  ]);

  useEffect(() => {
    const source = treeQuery.data;
    if (!source) {
      return;
    }

    setPages(source.map(apiNodeToUiNode));
  }, [treeQuery.data]);

  useEffect(() => {
    const urlPageId = searchParams.get("pageId")?.trim() ?? "";
    if (urlPageId.length > 0 && containsPageId(pages, urlPageId)) {
      if (selectedPageId !== urlPageId) {
        setSelectedPageId(urlPageId);
      }

      return;
    }

    if (pages.length === 0) {
      if (selectedPageId !== null) {
        setSelectedPageId(null);
      }
      return;
    }

    const [firstPage] = pages;
    if (firstPage && (!selectedPageId || !containsPageId(pages, selectedPageId))) {
      setSelectedPageId(firstPage.id);
    }
  }, [pages, searchParams, selectedPageId]);

  const selectedPath = useMemo(
    () => getPagePath(pages, selectedPageId),
    [pages, selectedPageId]
  );

  const selectedTitle =
    selectedPath.length === 0
      ? DEFAULT_PAGE_TITLE
      : (selectedPath[selectedPath.length - 1] ?? DEFAULT_PAGE_TITLE);

  const handleCreatePage = async (parentId: string | null) => {
    if (!spaceId) {
      throw new Error("Missing docs space.");
    }

    const created = await createPageMutation.mutateAsync({
      spaceId,
      parentId,
      title: DEFAULT_PAGE_TITLE,
    });

    const nextPage: DocsPageTreeNode = {
      id: created.id,
      title: created.title,
      children: [],
    };

    setPages((current) => addPage(current, parentId, nextPage));
    setSelectedPageId(nextPage.id);
    return nextPage.id;
  };

  const handleRenamePage = async (targetPageId: string, title: string) => {
    await renamePageMutation.mutateAsync({
      id: targetPageId,
      title,
    });

    setPages((current) => renamePage(current, targetPageId, title));
  };

  const handleMovePage = async (command: DocsPageMoveCommand) => {
    const nextPages = movePage(pages, command);
    setPages(nextPages);

    const currentParentId = getParentId(pages, command.id);
    if (currentParentId !== command.parentId) {
      await movePageMutation.mutateAsync({
        id: command.id,
        parentId: command.parentId,
      });
    }

    const siblings = getChildrenByParentId(nextPages, command.parentId);
    const targetIndex = siblings.findIndex((candidate) => candidate.id === command.id);
    const beforeId = targetIndex > 0 ? siblings[targetIndex - 1]?.id : undefined;
    const afterId =
      targetIndex >= 0 && targetIndex + 1 < siblings.length
        ? siblings[targetIndex + 1]?.id
        : undefined;

    await reorderPageMutation.mutateAsync({
      id: command.id,
      beforeId,
      afterId,
    });

    if (spaceId) {
      void utils.docs.pages.tree.invalidate({ spaceId });
    }
  };

  return (
    <section className="min-h-full">
      <DocsShell
        editedMeta="Edited 2h ago by Dev Maddox · v14"
        headerActions={<DocsHeaderActions userName={userName} />}
        pagePath={selectedPath.length === 0 ? ["Docs"] : ["Docs", ...selectedPath]}
        pageTitle={selectedTitle}
        editor={
          selectedPageId === null ? undefined : (
            <DocsPageEditor
              pageId={selectedPageId}
              userId={userId}
              userName={userName}
            />
          )
        }
        pages={pages}
        selectedPageId={selectedPageId ?? undefined}
        onCreatePage={handleCreatePage}
        onRenamePage={handleRenamePage}
        onMovePage={handleMovePage}
        onSelectPage={setSelectedPageId}
        onTitleChange={(nextTitle) => {
          if (selectedPageId === null) {
            return;
          }

          void handleRenamePage(selectedPageId, nextTitle);
        }}
      />
    </section>
  );
}

function DocsHeaderActions({ userName }: { userName: string }) {
  return (
    <>
      <div className="flex items-center">
        <Avatar className="ring-2 ring-surface-1" name={userName} size="sm" />
        <Avatar
          className="-ml-1.5 ring-2 ring-surface-1"
          fallback="DM"
          name="Dev Maddox"
          size="sm"
        />
        <span className="ml-2 inline-flex items-center gap-1 text-xs text-finance-positive">
          <span
            className="h-1.5 w-1.5 rounded-full bg-finance-positive"
            aria-hidden="true"
          />
          Live
        </span>
      </div>

      <div className="h-4 w-px bg-border-subtle" aria-hidden="true" />

      <Button
        leftSlot={<Clock3 className="h-3 w-3" aria-hidden="true" />}
        size="sm"
        type="button"
        variant="outline"
      >
        History
      </Button>
      <Button
        leftSlot={<Share2 className="h-3 w-3" aria-hidden="true" />}
        size="sm"
        type="button"
      >
        Share
      </Button>
    </>
  );
}

function getChildrenByParentId(
  nodes: DocsPageTreeNode[],
  parentId: string | null
): DocsPageTreeNode[] {
  if (parentId === null) {
    return nodes;
  }

  for (const node of nodes) {
    if (node.id === parentId) {
      return node.children;
    }

    if (node.children.length === 0) {
      continue;
    }

    const fromNested = getChildrenByParentId(node.children, parentId);
    if (fromNested.length > 0) {
      return fromNested;
    }
  }

  return [];
}

function getParentId(nodes: DocsPageTreeNode[], targetPageId: string): string | null {
  for (const node of nodes) {
    for (const child of node.children) {
      if (child.id === targetPageId) {
        return node.id;
      }
    }

    for (const child of node.children) {
      const nestedParent = getParentId(child.children, targetPageId);
      if (nestedParent) {
        return nestedParent;
      }
    }
  }

  return null;
}

function apiNodeToUiNode(node: ApiPageTreeNode): DocsPageTreeNode {
  return {
    id: node.id,
    title: node.title,
    children: node.children.map(apiNodeToUiNode),
  };
}

function getPagePath(
  pages: DocsPageTreeNode[],
  targetPageId: string | null,
  ancestorTitles: string[] = []
): string[] {
  if (targetPageId === null) {
    return [];
  }

  for (const page of pages) {
    const nextPath = [...ancestorTitles, page.title];
    if (page.id === targetPageId) {
      return nextPath;
    }

    const childPath = getPagePath(page.children, targetPageId, nextPath);
    if (childPath.length > 0) {
      return childPath;
    }
  }

  return [];
}

function containsPageId(pages: DocsPageTreeNode[], targetPageId: string): boolean {
  for (const page of pages) {
    if (page.id === targetPageId) {
      return true;
    }

    if (page.children.length > 0 && containsPageId(page.children, targetPageId)) {
      return true;
    }
  }

  return false;
}

function addPage(
  pages: DocsPageTreeNode[],
  parentId: string | null,
  nextPage: DocsPageTreeNode
): DocsPageTreeNode[] {
  if (parentId === null) {
    return [...pages, nextPage];
  }

  return pages.map((page) => {
    if (page.id === parentId) {
      return {
        ...page,
        children: [...page.children, nextPage],
      };
    }

    if (page.children.length === 0) {
      return page;
    }

    return {
      ...page,
      children: addPage(page.children, parentId, nextPage),
    };
  });
}

function renamePage(
  pages: DocsPageTreeNode[],
  pageId: string,
  title: string
): DocsPageTreeNode[] {
  return pages.map((page) => {
    if (page.id === pageId) {
      return {
        ...page,
        title,
      };
    }

    if (page.children.length === 0) {
      return page;
    }

    return {
      ...page,
      children: renamePage(page.children, pageId, title),
    };
  });
}

function movePage(
  pages: DocsPageTreeNode[],
  command: DocsPageMoveCommand
): DocsPageTreeNode[] {
  const removed = extractPage(pages, command.id);
  if (!removed) {
    return pages;
  }

  return insertPage(removed.nodes, command.parentId, command.toIndex, removed.node);
}

function extractPage(
  pages: DocsPageTreeNode[],
  pageId: string
): { nodes: DocsPageTreeNode[]; node: DocsPageTreeNode } | null {
  for (let index = 0; index < pages.length; index += 1) {
    const current = pages[index];
    if (!current) {
      continue;
    }

    if (current.id === pageId) {
      const remaining = [...pages];
      remaining.splice(index, 1);
      return { nodes: remaining, node: current };
    }

    if (current.children.length === 0) {
      continue;
    }

    const result = extractPage(current.children, pageId);
    if (result) {
      return {
        nodes: pages.map((entry) =>
          entry.id === current.id ? { ...entry, children: result.nodes } : entry
        ),
        node: result.node,
      };
    }
  }

  return null;
}

function insertPage(
  pages: DocsPageTreeNode[],
  parentId: string | null,
  index: number,
  page: DocsPageTreeNode
): DocsPageTreeNode[] {
  if (parentId === null) {
    const clampedIndex = clamp(index, 0, pages.length);
    return [...pages.slice(0, clampedIndex), page, ...pages.slice(clampedIndex)];
  }

  return pages.map((entry) => {
    if (entry.id === parentId) {
      const clampedIndex = clamp(index, 0, entry.children.length);
      return {
        ...entry,
        children: [
          ...entry.children.slice(0, clampedIndex),
          page,
          ...entry.children.slice(clampedIndex),
        ],
      };
    }

    if (entry.children.length === 0) {
      return entry;
    }

    return {
      ...entry,
      children: insertPage(entry.children, parentId, index, page),
    };
  });
}

function clamp(value: number, min: number, max: number) {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}
