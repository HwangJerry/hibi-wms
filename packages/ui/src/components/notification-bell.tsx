import { type ReactNode, useState } from "react";
import { cx } from "../primitives/classnames";
import { Button } from "../primitives/button";

export type NotificationBellItem = {
  id: string;
  title: string;
  message?: string | null;
  createdAt: Date | string;
  isRead: boolean;
  targetPath?: string | null;
};

export interface NotificationBellProps {
  items: Array<NotificationBellItem>;
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onOpenItem?: (targetPath: string | null | undefined) => void;
  Icon?: BellGlyph;
  isLoading?: boolean;
}

function formatRelativeTime(value: Date | string) {
  const now = Date.now();
  const valueDate = typeof value === "string" ? new Date(value) : value;
  const diffMs = Math.max(0, now - valueDate.getTime());
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  return valueDate.toLocaleDateString();
}

function createDefaultIconClassName(className: string | undefined) {
  return className ?? "h-4 w-4";
}

type BellGlyph = ReactNode | ((props: { className?: string }) => ReactNode);

export function NotificationBell({
  items,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onOpenItem,
  Icon,
  isLoading,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        aria-label="Notifications"
        onClick={() => {
          setOpen((current) => !current);
        }}
        variant="outline"
        size="sm"
        type="button"
      >
        <span className="mr-2 text-text-secondary" aria-hidden="true">
          {typeof Icon === "function" ? (
            <Icon className={createDefaultIconClassName("h-4 w-4")} />
          ) : Icon ?? "🔔"}
        </span>
        {isLoading ? "Loading" : "Notifications"}
        {unreadCount > 0 ? (
          <span className="ml-1 rounded-full bg-status-pending px-1.5 py-0.5 text-[10px] text-text-primary">
            {unreadCount}
          </span>
        ) : null}
      </Button>

      <div
        onMouseLeave={() => {
          setOpen(false);
        }}
        className={cx(
          "absolute right-0 top-full z-20 mt-2 w-80 border border-border bg-surface-1 p-2 shadow-lg",
          "transition-opacity duration-150",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
          "origin-top-right text-sm",
        )}
      >
        <div className="mb-2 flex items-center justify-between border-b border-border pb-2 text-xs text-text-secondary">
          <span>Notifications</span>
          <button
            className="rounded border border-border px-2 py-1 text-[11px]"
            onClick={onMarkAllAsRead}
            type="button"
          >
            Mark all read
          </button>
        </div>

        {items.length === 0 ? (
          <p className="rounded border border-border px-3 py-3 text-xs text-text-secondary">
            No notifications yet.
          </p>
        ) : null}

        <div className="max-h-80 overflow-auto space-y-1">
          {items.map((item) => {
            return (
              <article
                key={item.id}
                className={cx(
                  "rounded border border-border p-3",
                  item.isRead
                    ? "text-text-secondary"
                    : "border-accent/30 bg-accent/5",
                )}
              >
                <header className="mb-1 flex items-start justify-between gap-2">
                  <h4 className="text-sm font-medium">{item.title}</h4>
                  {!item.isRead ? <span className="text-[10px]">new</span> : null}
                </header>

                {item.message ? <p className="text-xs">{item.message}</p> : null}

                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-text-secondary">
                  <span>{formatRelativeTime(item.createdAt)}</span>
                  <span className="flex items-center gap-1">
                    {item.targetPath ? (
                      <button
                        className="rounded border border-border px-2 py-1"
                        onClick={() => {
                          onOpenItem?.(item.targetPath);
                        }}
                        type="button"
                      >
                        Open
                      </button>
                    ) : null}
                    {!item.isRead ? (
                      <button
                        className="rounded border border-border px-2 py-1"
                        onClick={() => {
                          onMarkAsRead(item.id);
                        }}
                        type="button"
                      >
                        Mark read
                      </button>
                    ) : null}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
