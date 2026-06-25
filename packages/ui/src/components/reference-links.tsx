import {
  FileText,
  ListTodo,
  Receipt,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../primitives/button";
import { Input } from "../primitives/input";

export const REFERENCE_ENTITY_TYPES = [
  "TASK",
  "PAGE",
  "APPROVAL",
  "TRANSACTION",
] as const;

export type ReferenceEntityType = (typeof REFERENCE_ENTITY_TYPES)[number];

export interface ReferenceTargetItem {
  id: string;
  type: ReferenceEntityType;
  title: string;
  subtitle: string;
  path: string;
}

export interface ReferenceListItem extends ReferenceTargetItem {
  relation?: string;
  referenceId?: string;
}

interface ReferenceListPanelProps {
  title: string;
  items: Array<ReferenceTargetItem>;
  emptyLabel: string;
}

interface ReferencePickerPanelProps {
  searchTerm: string;
  onSearchTermChange: (next: string) => void;
  searchResults: Array<ReferenceTargetItem>;
  isSearching: boolean;
  isLinking: boolean;
  onAttach: (target: Pick<ReferenceTargetItem, "id" | "type">) => void | Promise<void>;
  isAlreadyLinked: (target: Pick<ReferenceTargetItem, "id" | "type">) => boolean;
  errorMessage?: string | null;
}

const LIST_CLASS =
  "space-y-2 rounded-md border border-border bg-surface-2 p-3";

const EMPTY_PANEL_CLASS = "rounded-md border border-dashed border-border bg-surface-1 px-2.5 py-2 text-sm text-text-secondary";

const LABEL_BY_TYPE: Record<ReferenceEntityType, string> = {
  TASK: "Task",
  PAGE: "Page",
  APPROVAL: "Approval",
  TRANSACTION: "Transaction",
};

const ITEM_BY_TYPE: Record<ReferenceEntityType, JSX.Element> = {
  TASK: <ListTodo className="h-3.5 w-3.5" aria-hidden="true" />,
  PAGE: <FileText className="h-3.5 w-3.5" aria-hidden="true" />,
  APPROVAL: <Wallet className="h-3.5 w-3.5" aria-hidden="true" />,
  TRANSACTION: <Receipt className="h-3.5 w-3.5" aria-hidden="true" />,
};

export function ReferenceListPanel({ title, items, emptyLabel }: ReferenceListPanelProps) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary">{title}</h3>
      <div className="space-y-1.5">
        {items.length === 0 ? (
          <p className={EMPTY_PANEL_CLASS}>{emptyLabel}</p>
        ) : null}

        {items.length > 0 ? (
          <div className={LIST_CLASS}>
            {items.map((item) => (
              <ReferenceListRow key={`${item.type}:${item.id}`} item={item} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function ReferencePickerPanel({
  searchTerm,
  onSearchTermChange,
  searchResults,
  isSearching,
  isLinking,
  onAttach,
  isAlreadyLinked,
  errorMessage,
}: ReferencePickerPanelProps) {
  const hasSearchTerm = searchTerm.trim().length > 0;

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary">Attach a reference</h3>

      <Input
        aria-label="Search references"
        onChange={(event) => {
          onSearchTermChange(event.target.value);
        }}
        placeholder="Search tasks, pages, approvals…"
        size="sm"
        value={searchTerm}
      />

      {errorMessage ? <p className="text-xs text-status-rejected">{errorMessage}</p> : null}

      {isSearching ? <p className="text-xs text-text-secondary">Searching…</p> : null}

      {!isSearching && !hasSearchTerm ? (
        <p className={EMPTY_PANEL_CLASS}>Type at least two characters to search.</p>
      ) : null}

      {!isSearching && hasSearchTerm ? (
        <div className="space-y-1.5 rounded-md border border-border bg-surface-2 p-2">
          {searchResults.length === 0 ? (
            <p className="rounded-md border border-status-rejected/30 bg-status-rejected/10 px-2.5 py-2 text-sm text-status-rejected">
              No matches.
            </p>
          ) : null}

          {searchResults.map((item) => {
            const isLinked = isAlreadyLinked(item);
            return (
              <div
                className="flex items-start justify-between gap-2 rounded-md border border-border bg-surface-1 px-2.5 py-2"
                key={`${item.type}:${item.id}`}
              >
                <ReferenceListRow item={item} disableLink />
                <Button
                  disabled={isLinked || isLinking || isSearching}
                  onClick={() => {
                    void onAttach(item);
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {isLinked ? "Linked" : "Attach"}
                </Button>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function ReferenceListRow({
  item,
  disableLink = false,
}: {
  item: ReferenceTargetItem;
  disableLink?: boolean;
}) {
  const link = disableLink ? null : item.path;

  const content: ReactNode = (
    <div className="flex min-w-0 items-center gap-2">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border bg-surface-1">
        {ITEM_BY_TYPE[item.type]}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text-primary">{item.title}</p>
        <p className="truncate text-xs text-text-secondary">{item.subtitle}</p>
      </div>

      <span className="rounded border border-border bg-surface-2 px-2 py-0.5 text-[11px] text-text-secondary">
        {LABEL_BY_TYPE[item.type]}
      </span>
    </div>
  );

  if (!link) {
    return content;
  }

  return (
    <a className="min-w-0 flex-1 text-left hover:underline" href={link}>
      {content}
    </a>
  );
}
