import { type ReactNode } from "react";
import { Input } from "../primitives/input";
import { cx } from "../primitives/classnames";

export interface CommandItem {
  id: string;
  label: string;
  group?: string;
  meta?: string;
  shortcut?: string;
  leading?: ReactNode;
  path?: string;
}

export interface CommandPaletteProps {
  open: boolean;
  query: string;
  items: CommandItem[];
  onClose?: () => void;
  onSelect?: (item: CommandItem) => void;
  onQueryChange?: (query: string) => void;
  className?: string;
  presentation?: "standard" | "mockup";
}

const GROUP_ORDER = ["Search", "Navigate", "Create", "Recent"];

const groupClassName = "text-[10px] font-semibold uppercase tracking-wide text-text-secondary";
const MOCKUP_COMMAND_PALETTE_HEIGHT_CLASS = "max-[499px]:h-[483px] min-[500px]:h-[427px]";

export function CommandPalette({
  open,
  query,
  items,
  onClose,
  onSelect,
  onQueryChange,
  className,
  presentation = "standard",
}: CommandPaletteProps) {
  if (!open) {
    return null;
  }

  const grouped = GROUP_ORDER.map((groupLabel) => ({
    label: groupLabel,
    rows: items.filter((item) => item.group === groupLabel),
  }));
  const hasItems = items.length > 0;
  const handleBackdrop = () => {
    onClose?.();
  };

  if (presentation === "mockup") {
    return (
      <div
        className="absolute inset-0 z-20 flex items-start justify-center bg-[rgba(14,14,20,0.28)] pt-20"
        data-visual-region="command-palette-backdrop"
        onClick={handleBackdrop}
      >
        <section
          aria-label="Command palette"
          className={cx(
            "relative z-10 flex w-[524px] max-w-full flex-col overflow-hidden rounded-[11px] border border-border bg-surface-1 shadow-[0_20px_60px_rgba(20,20,40,0.24)] [line-height:normal]",
            MOCKUP_COMMAND_PALETTE_HEIGHT_CLASS,
            className,
          )}
          data-visual-region="command-palette"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
        >
          <div className="flex items-center gap-2.5 border-b border-border-subtle px-3.5 py-[13px]">
            <MockupSearchIcon />
            <span className="flex-1 text-sm text-text-primary [line-height:normal]">
              {query}
              <span className="ml-px inline-block h-3.5 w-px align-middle bg-accent" />
            </span>
            <span className="inline-flex h-[19px] items-center justify-center rounded border border-border-control bg-surface-control px-1.5 font-mono text-[11px] font-medium text-text-muted">
              esc
            </span>
          </div>

          <div className="flex-1 px-1.5 py-1.5">
            {grouped.map((group) => {
              if (group.rows.length === 0) return null;
              return (
                <div key={group.label}>
                  <div
                    className={cx(
                      "px-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-text-tertiary",
                      group.label === "Navigate" ? "pt-[5px]" : "pt-[9px]",
                    )}
                  >
                    {group.label}
                  </div>
                  {group.rows.map((item) => (
                    <MockupCommandRow
                      isActive={item.id === "visual-new-transaction"}
                      item={item}
                      key={item.id}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center gap-3.5 border-t border-border-muted bg-surface-muted px-3.5 py-2">
            <MockupFooterHint keys={["↑", "↓"]} label="navigate" />
            <MockupFooterHint keys={["↵"]} label="open" />
            <MockupFooterHint keys={["esc"]} label="close" />
            <span className="ml-auto flex items-center gap-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded bg-accent text-[10px] font-semibold text-accent-fg">
                <svg aria-hidden="true" className="h-2 w-2" fill="none" viewBox="0 0 10 10">
                  <path d="M3 5h4M5 3v4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
                </svg>
              </span>
              <span className="text-[11px] text-text-muted">WMS</span>
            </span>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 z-20 flex items-start justify-center bg-black/30 pt-[72px]"
      data-visual-region="command-palette-backdrop"
      onClick={handleBackdrop}
    >
      <section
        aria-label="Command palette"
        className={cx(
          "w-[540px] border border-border bg-surface-1 shadow-lg",
          "rounded-md overflow-hidden",
          className,
        )}
        data-visual-region="command-palette"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-center gap-2 border-b border-border px-3.5 py-3">
          <span className="text-text-secondary">⌘K</span>
          <Input
            autoFocus
            className="h-7 bg-surface-2"
            onChange={(event) => {
              onQueryChange?.(event.target.value);
            }}
            placeholder="Type a command or search"
            value={query}
          />
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded border border-border px-2 py-1 text-xs text-text-secondary"
          >
            esc
          </button>
        </div>
        <div className="p-1.5">
          {!hasItems ? (
            <p className="px-2.5 py-2 text-sm text-text-secondary">No matches found.</p>
          ) : null}
          {grouped.map((group) => {
            if (group.rows.length === 0) return null;
            return (
              <div key={group.label} className="pb-1.5">
                <div className={cx("px-2.5 py-1.5", groupClassName)}>
                  {group.label}
                </div>
                {group.rows.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm text-text-primary hover:bg-surface-2"
                    onClick={() => onSelect?.(item)}
                  >
                    {item.leading ? <span className="text-text-secondary">{item.leading}</span> : null}
                    <span className="flex-1">{item.label}</span>
                    {item.meta ? <span className="text-xs text-text-secondary">{item.meta}</span> : null}
                    {item.shortcut ? (
                      <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-text-secondary">
                        {item.shortcut}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function MockupSearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-[15px] w-[15px] shrink-0 text-text-muted"
      fill="none"
      viewBox="0 0 16 16"
    >
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function MockupCommandRow({
  isActive,
  item,
  onSelect,
}: {
  isActive: boolean;
  item: CommandItem;
  onSelect?: (item: CommandItem) => void;
}) {
  const isRecentTask = item.id === "visual-recent-task";
  const isRecentDoc = item.id === "visual-recent-doc";
  const shouldTruncateLabel = isRecentTask || isRecentDoc;

  return (
    <button
      className={cx(
        "flex min-h-[31px] w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-left text-[13px] text-text-primary",
        isActive ? "bg-accent-subtle font-medium" : null,
      )}
      onClick={() => onSelect?.(item)}
      type="button"
    >
      {isRecentTask ? (
        <span className="w-14 shrink-0 text-[11.5px] leading-tight text-text-tertiary tabular-nums">
          WMS-
          <br />
          142
        </span>
      ) : (
        <span
          className={cx(
            "flex h-[13px] w-[13px] shrink-0 items-center justify-center text-text-muted",
            isActive ? "text-accent" : null,
          )}
        >
          {renderMockupLeading(item.id)}
        </span>
      )}
      <span
        className={cx(
          "flex-1 leading-tight",
          shouldTruncateLabel ? "min-w-0 truncate whitespace-nowrap" : "whitespace-normal",
        )}
      >
        {item.label}
      </span>
      {item.meta && !isRecentTask ? (
        <span
          className={cx(
            "ml-auto text-[11.5px] leading-tight text-text-tertiary",
            item.id === "visual-backlog" ? "max-w-[32px] whitespace-normal min-[300px]:max-w-none" : null,
            item.id === "visual-approvals"
              ? "rounded border border-status-pending-border bg-status-pending-bg px-1.5 py-px text-status-pending"
              : null,
          )}
        >
          {item.meta}
        </span>
      ) : null}
      {item.shortcut ? (
        <span
          className={cx(
            "inline-flex h-[18px] w-[18px] items-center justify-center rounded border border-border-control bg-surface-control font-mono text-[11px] font-semibold text-text-secondary",
            isActive ? "border-accent-subtle-border bg-accent-subtle text-accent-strong" : null,
          )}
        >
          {item.shortcut}
        </span>
      ) : null}
    </button>
  );
}

function renderMockupLeading(itemId: string) {
  if (itemId === "visual-backlog") {
    return (
      <svg aria-hidden="true" className="h-[13px] w-[13px]" fill="none" viewBox="0 0 16 16">
        <rect height="2.6" rx="1" stroke="currentColor" strokeWidth="1.5" width="12" x="2" y="2.5" />
        <rect height="2.6" rx="1" stroke="currentColor" strokeWidth="1.5" width="12" x="2" y="6.7" />
        <rect height="2.6" rx="1" stroke="currentColor" strokeWidth="1.5" width="8" x="2" y="10.9" />
      </svg>
    );
  }

  if (itemId === "visual-approvals") {
    return (
      <svg aria-hidden="true" className="h-[13px] w-[13px]" fill="none" viewBox="0 0 16 16">
        <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }

  if (itemId === "visual-finance" || itemId === "visual-new-transaction") {
    return (
      <svg aria-hidden="true" className="h-[13px] w-[13px]" fill="none" viewBox="0 0 16 16">
        <rect height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" width="12" x="2" y="3.5" />
        <path d="M2 6.5h12" stroke="currentColor" strokeWidth="1.5" />
        {itemId === "visual-new-transaction" ? (
          <path d="M9.5 9h3" stroke="currentColor" strokeWidth="1.5" />
        ) : null}
      </svg>
    );
  }

  if (itemId === "visual-recent-doc") {
    return (
      <svg aria-hidden="true" className="h-[13px] w-[13px]" fill="none" viewBox="0 0 12 12">
        <path d="M3 2h4.5L9.5 4.5v6H3z" stroke="currentColor" strokeWidth="1.3" />
        <path d="M7 2v3h2.5" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-[13px] w-[13px]" fill="none" viewBox="0 0 14 14">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function MockupFooterHint({
  keys,
  label,
}: {
  keys: string[];
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-text-muted">
      <span className="inline-flex items-center gap-0.5">
        {keys.map((key) => (
          <span
            className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-border-control bg-surface-control px-1 font-mono text-[11px] font-medium text-text-secondary"
            key={key}
          >
            {key}
          </span>
        ))}
      </span>
      {label}
    </span>
  );
}
