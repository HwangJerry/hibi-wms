import { type ChangeEvent, type KeyboardEvent, useMemo, useState } from "react";
import { Input } from "../primitives/input";
import { cx } from "../primitives/classnames";

export interface DocsPageTreeNode {
  id: string;
  title: string;
  children: DocsPageTreeNode[];
}

export interface DocsPageMoveCommand {
  id: string;
  parentId: string | null;
  toIndex: number;
}

export interface DocsPageTreeProps {
  className?: string;
  pages: DocsPageTreeNode[];
  selectedPageId?: string;
  onCreatePage: (parentId: string | null) => Promise<string> | string;
  onMovePage: (command: DocsPageMoveCommand) => Promise<void> | void;
  onRenamePage: (id: string, title: string) => Promise<void> | void;
  onSelectPage: (id: string) => void;
}

const ROOT_SEARCH_TEXT = "Search docs";
const ROOT_NEW_PAGE_TEXT = "New page";
const DEFAULT_PAGE_TITLE = "Untitled page";
const SEARCH_COLLAPSE_THRESHOLD = 1;

export function DocsPageTree({
  className,
  pages,
  selectedPageId,
  onCreatePage,
  onMovePage,
  onRenamePage,
  onSelectPage,
}: DocsPageTreeProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [renamingPageId, setRenamingPageId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});

  const filteredPages = useMemo(
    () => filterPages(pages, searchTerm),
    [pages, searchTerm]
  );

  const hasSearchTerm = searchTerm.trim().length >= SEARCH_COLLAPSE_THRESHOLD;
  const hasPages = pages.length > 0;
  const displayNodes = hasSearchTerm ? filteredPages : pages;

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const toggleExpanded = (nodeId: string) => {
    setExpandedById((current) => ({
      ...current,
      [nodeId]: !current[nodeId],
    }));
  };

  const startRename = (node: DocsPageTreeNode) => {
    setRenamingPageId(node.id);
    setRenamingValue(node.title);
  };

  const cancelRename = () => {
    setRenamingPageId(null);
    setRenamingValue("");
  };

  const submitRename = async (nodeId: string) => {
    const normalized = renamingValue.trim();
    await onRenamePage(
      nodeId,
      normalized.length === 0 ? DEFAULT_PAGE_TITLE : normalized
    );
    cancelRename();
  };

  const handleRenameKeyDown = async (
    event: KeyboardEvent<HTMLInputElement>,
    nodeId: string
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      await submitRename(nodeId);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelRename();
    }
  };

  const handleRenameBlur = (nodeId: string) => {
    if (renamingPageId === null) {
      return;
    }

    void submitRename(nodeId);
  };

  const handleCreateRoot = () => {
    void (async () => {
      const nextPageId = await onCreatePage(null);
      onSelectPage(nextPageId);
    })();
  };

  const renderTree = (
    nodes: DocsPageTreeNode[],
    parentId: string | null,
    level: number
  ) => {
    return (
      <ul className="space-y-px">
        {nodes.map((node, index) => {
          const siblingCount = nodes.length;
          const isActive = node.id === selectedPageId;
          const isRenaming = renamingPageId === node.id;
          const hasChildren = node.children.length > 0;
          const isExpanded = hasSearchTerm ? true : (expandedById[node.id] ?? true);
          const canMoveUp = index > 0;
          const canMoveDown = index < siblingCount - 1;
          const levelClass =
            TREE_INDENT_CLASSES[Math.min(level, TREE_INDENT_CLASSES.length - 1)];

          return (
            <li key={node.id}>
              <div className="group flex min-h-[28px] items-center gap-1 rounded-md px-2 text-sm text-text-secondary transition-colors hover:bg-surface-1">
                <button
                  aria-expanded={hasChildren ? isExpanded : undefined}
                  aria-label={
                    hasChildren
                      ? isExpanded
                        ? "Collapse page"
                        : "Expand page"
                      : undefined
                  }
                  className="h-5 w-4 shrink-0 rounded text-[10px] text-text-tertiary disabled:invisible"
                  disabled={!hasChildren}
                  onClick={(event) => {
                    event.preventDefault();
                    toggleExpanded(node.id);
                  }}
                  type="button"
                >
                  {hasChildren ? (isExpanded ? "▾" : "▸") : ""}
                </button>

                <button
                  className={cx(
                    "flex min-w-0 grow items-center gap-1.5 rounded px-1 py-1 text-left text-xs outline-none",
                    isActive
                      ? "bg-accent-subtle font-semibold text-accent"
                      : "font-medium text-text-secondary hover:bg-surface-1 hover:text-text-primary"
                  )}
                  onClick={() => onSelectPage(node.id)}
                  type="button"
                >
                  <DocumentPageIcon
                    className={cx(
                      "h-3 w-3 shrink-0",
                      isActive ? "text-accent" : "text-text-muted"
                    )}
                  />
                  <span className={`min-w-0 flex-1 truncate ${levelClass}`}>
                    {isRenaming ? (
                      <input
                        aria-label="Rename page"
                        className="h-6 w-full rounded border border-border bg-surface-1 px-1.5 text-xs text-text-primary outline-none"
                        onBlur={() => handleRenameBlur(node.id)}
                        onChange={(event) => {
                          setRenamingValue(event.target.value);
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                        onKeyDown={(event) => {
                          void handleRenameKeyDown(event, node.id);
                        }}
                        value={renamingValue}
                      />
                    ) : (
                      node.title
                    )}
                  </span>
                </button>

                <button
                  aria-label={`Create page inside ${node.title}`}
                  className="h-6 w-5 rounded text-[11px] text-text-secondary opacity-0 hover:bg-surface-1 group-hover:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    void (async () => {
                      const nextPageId = await onCreatePage(node.id);
                      onSelectPage(nextPageId);
                    })();
                  }}
                  type="button"
                >
                  +
                </button>

                <button
                  aria-label={`Rename ${node.title}`}
                  className="h-6 w-5 rounded text-[11px] text-text-secondary opacity-0 hover:bg-surface-1 group-hover:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    startRename(node);
                  }}
                  type="button"
                >
                  ✎
                </button>

                <button
                  aria-label={`Move ${node.title} up`}
                  disabled={hasSearchTerm || !canMoveUp}
                  className="h-6 w-5 rounded text-[11px] text-text-secondary opacity-0 hover:bg-surface-1 disabled:opacity-0 group-hover:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    const command = {
                      id: node.id,
                      parentId,
                      toIndex: index - 1,
                    };
                    void onMovePage(command);
                  }}
                  type="button"
                >
                  ↑
                </button>
                <button
                  aria-label={`Move ${node.title} down`}
                  disabled={hasSearchTerm || !canMoveDown}
                  className="h-6 w-5 rounded text-[11px] text-text-secondary opacity-0 hover:bg-surface-1 disabled:opacity-0 group-hover:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    const command = {
                      id: node.id,
                      parentId,
                      toIndex: index + 1,
                    };
                    void onMovePage(command);
                  }}
                  type="button"
                >
                  ↓
                </button>
              </div>

              {hasChildren && isExpanded
                ? renderTree(node.children, node.id, level + 1)
                : null}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <aside
      className={cx(
        "flex w-[248px] shrink-0 flex-col border-r border-border-subtle bg-surface-2",
        className
      )}
    >
      <div className="border-b border-border-subtle p-2">
        <Input
          aria-label="Search docs"
          onChange={handleSearchChange}
          placeholder={ROOT_SEARCH_TEXT}
          size="sm"
          value={searchTerm}
        />
      </div>

      <div className="flex-1 overflow-auto p-2">
        <div className="mb-1 px-2 text-[10.5px] font-semibold uppercase tracking-wide text-text-tertiary">
          Pages
        </div>
        {hasPages ? (
          displayNodes.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-2 py-3 text-xs text-text-secondary">
              No pages match your search.
            </p>
          ) : (
            renderTree(displayNodes, null, 0)
          )
        ) : (
          <p className="rounded-md border border-dashed border-border px-2 py-3 text-xs text-text-secondary">
            No pages yet.
          </p>
        )}
        {hasPages ? (
          <>
            <div className="my-2 h-px bg-border-subtle" />
            <div className="flex items-center gap-1.5 px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-text-tertiary">
              <RecentIcon />
              Recent
            </div>
            {pages.slice(0, 1).map((page) => (
              <button
                className="flex min-h-[28px] w-full items-center gap-1.5 rounded-md px-3 text-left text-xs font-medium text-text-muted hover:bg-surface-1 hover:text-text-primary"
                key={`recent-${page.id}`}
                onClick={() => onSelectPage(page.id)}
                type="button"
              >
                <DocumentPageIcon className="h-3 w-3 shrink-0 text-text-tertiary" />
                <span className="truncate">{page.title}</span>
              </button>
            ))}
          </>
        ) : null}
      </div>

      <div className="border-t border-border-subtle p-2">
        <button
          className="flex w-full items-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1.5 text-left text-xs font-medium text-text-muted hover:border-border-strong hover:bg-surface-1 hover:text-text-secondary"
          onClick={handleCreateRoot}
          type="button"
        >
          <span aria-hidden="true" className="text-sm leading-none">
            +
          </span>
          {ROOT_NEW_PAGE_TEXT}
        </button>
      </div>
    </aside>
  );
}

function filterPages(pages: DocsPageTreeNode[], query: string): DocsPageTreeNode[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) {
    return pages;
  }

  return pages.reduce<DocsPageTreeNode[]>((accumulator, page) => {
    const isMatch = page.title.toLowerCase().includes(normalized);
    const matchingChildren = filterPages(page.children, query);

    if (isMatch || matchingChildren.length > 0) {
      accumulator.push({
        ...page,
        children: matchingChildren,
      });
    }

    return accumulator;
  }, []);
}

const TREE_INDENT_CLASSES = ["pl-0", "pl-2", "pl-4", "pl-6", "pl-8"] as const;

function DocumentPageIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 12 12">
      <path d="M3 2h4.5L9.5 4.5v5.5H3z" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 2v3h2.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function RecentIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3 w-3 text-text-tertiary"
      fill="none"
      viewBox="0 0 10 10"
    >
      <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 3v2l1.5 1.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
