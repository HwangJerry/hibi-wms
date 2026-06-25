import { useState } from "react";
import {
  Avatar,
  Button,
  DocsShell,
  type DocsPageMoveCommand,
  type DocsPageTreeNode,
} from "../../src";
import { Clock3, Share2 } from "lucide-react";

import "../../tokens/tokens.css";

const PAGE_DATA: DocsPageTreeNode[] = [
  {
    id: "home",
    title: "Home",
    children: [],
  },
  {
    id: "partner-agreement",
    title: "Partner Agreement",
    children: [],
  },
  {
    id: "q3-planning",
    title: "Q3 Planning",
    children: [
      {
        id: "finance-operating-plan",
        title: "Finance — Operating Plan",
        children: [],
      },
      {
        id: "headcount-plan",
        title: "Headcount Plan",
        children: [],
      },
      {
        id: "goals-okrs",
        title: "Goals & OKRs",
        children: [
          {
            id: "engineering-krs",
            title: "Engineering KRs",
            children: [],
          },
          {
            id: "revenue-krs",
            title: "Revenue KRs",
            children: [],
          },
        ],
      },
    ],
  },
  {
    id: "finance-runbooks",
    title: "Finance Runbooks",
    children: [],
  },
  {
    id: "contracts",
    title: "Contracts",
    children: [],
  },
  {
    id: "meeting-notes",
    title: "Meeting Notes",
    children: [],
  },
];

const INITIAL_SELECTED_PAGE_ID = "finance-operating-plan";

function DocsShellStory({ isDark = false }: { isDark?: boolean }) {
  const [pages, setPages] = useState(PAGE_DATA);
  const [selectedPageId, setSelectedPageId] = useState(INITIAL_SELECTED_PAGE_ID);

  const selectedPath = getPagePath(pages, selectedPageId);
  const selectedTitle =
    selectedPath.length === 0 ? "Untitled page" : selectedPath[selectedPath.length - 1];

  return (
    <div
      className={
        isDark
          ? "dark flex min-h-screen bg-surface-1 p-4 text-text-primary"
          : "flex min-h-screen bg-surface-1 p-4 text-text-primary"
      }
    >
      <DocsShell
        editedMeta="Edited 2h ago by Dev Maddox · v14"
        headerActions={<DocsStoryHeaderActions />}
        pagePath={selectedPath.length === 0 ? ["Docs"] : ["Docs", ...selectedPath]}
        pageTitle={selectedTitle}
        onCreatePage={(parentId) => {
          const newId = `page-${Date.now()}`;
          const nextNode = {
            id: newId,
            title: "Untitled page",
            children: [],
          };
          setPages((current) => addPage(current, parentId, nextNode));
          setSelectedPageId(newId);
          return newId;
        }}
        onMovePage={(command) => {
          setPages((current) => movePage(current, command));
        }}
        onRenamePage={(pageId, nextTitle) => {
          setPages((current) => renamePage(current, pageId, nextTitle));
        }}
        onSelectPage={setSelectedPageId}
        onTitleChange={(nextTitle) => {
          setPages((current) => renamePage(current, selectedPageId, nextTitle));
        }}
        pages={pages}
        selectedPageId={selectedPageId}
      />
    </div>
  );
}

export const DocsShellLight = () => <DocsShellStory />;
export const DocsShellDark = () => <DocsShellStory isDark />;

function DocsStoryHeaderActions() {
  return (
    <>
      <div className="flex items-center">
        <Avatar
          className="ring-2 ring-surface-1"
          fallback="AK"
          name="Aria Kessler"
          size="sm"
        />
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
  nextTitle: string
): DocsPageTreeNode[] {
  return pages.map((page) => {
    if (page.id === pageId) {
      return {
        ...page,
        title: nextTitle,
      };
    }

    if (page.children.length === 0) {
      return page;
    }

    return {
      ...page,
      children: renamePage(page.children, pageId, nextTitle),
    };
  });
}

function getPagePath(
  pages: DocsPageTreeNode[],
  targetPageId: string,
  ancestorTitles: string[] = []
): string[] {
  for (const page of pages) {
    const candidatePath = [...ancestorTitles, page.title];
    if (page.id === targetPageId) {
      return candidatePath;
    }

    const childPath = getPagePath(page.children, targetPageId, candidatePath);
    if (childPath.length > 0) {
      return childPath;
    }
  }

  return [];
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
        nodes: pages.map((page) =>
          page.id === current.id ? { ...page, children: result.nodes } : page
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
