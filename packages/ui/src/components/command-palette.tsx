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
}

export interface CommandPaletteProps {
  open: boolean;
  query: string;
  items: CommandItem[];
  onClose?: () => void;
  onSelect?: (item: CommandItem) => void;
  onQueryChange?: (query: string) => void;
  className?: string;
}

const GROUP_ORDER = ["Navigate", "Create", "Recent"];

const groupClassName = "text-[10px] font-semibold uppercase tracking-wide text-text-secondary";

export function CommandPalette({
  open,
  query,
  items,
  onClose,
  onSelect,
  onQueryChange,
  className,
}: CommandPaletteProps) {
  if (!open) {
    return null;
  }

  const grouped = GROUP_ORDER.map((groupLabel) => ({
    label: groupLabel,
    rows: items.filter((item) => item.group === groupLabel),
  }));
  const handleBackdrop = () => {
    onClose?.();
  };

  return (
    <div
      className="absolute inset-0 z-20 flex items-start justify-center bg-black/30 pt-[72px]"
      onClick={handleBackdrop}
    >
      <section
        className={cx(
          "w-[540px] border border-border bg-surface-1 shadow-lg",
          "rounded-md overflow-hidden",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
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
