import { type HTMLAttributes, type ReactNode } from "react";
import { X } from "lucide-react";
import { cx } from "../primitives/classnames";

export interface SlideOverProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onClose?: () => void;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  title?: string;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
  children: ReactNode;
}

export function SlideOver({
  open,
  onClose,
  onPrimaryAction,
  onSecondaryAction,
  title = "Panel",
  primaryActionLabel,
  secondaryActionLabel,
  children,
  className,
  ...props
}: SlideOverProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="absolute inset-0">
      <button
        type="button"
        aria-label="Close slide-over"
        onClick={onClose}
        className="absolute inset-0 bg-surface-1/70"
      />
      <aside
        className={cx(
          "absolute right-0 top-0 bottom-0 w-[360px] border-l border-border bg-surface-1 shadow-2xl",
          "flex flex-col animate-[slide-in-right_160ms_ease]",
          "bg-[linear-gradient(180deg,var(--surface-2)_0%,var(--surface-1)_100%)]",
          className,
        )}
        style={{
          animation: "slide-in-right 0.18s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
        onClick={(event) => event.stopPropagation()}
        {...props}
      >
        <div className="h-11 shrink-0 border-b border-border px-3.5 flex items-center gap-3">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded border border-border text-text-secondary hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-auto px-4 py-4">{children}</div>
        {(primaryActionLabel || secondaryActionLabel) && (
          <div className="border-t border-border p-3 flex gap-2">
            {secondaryActionLabel ? (
              <button
                type="button"
                onClick={onSecondaryAction}
                className="rounded-md border border-border px-3 py-2 text-sm text-text-primary hover:bg-surface-2"
              >
                {secondaryActionLabel}
              </button>
            ) : null}
            {primaryActionLabel ? (
              <button
                type="button"
                onClick={onPrimaryAction}
                className="rounded-md border border-accent bg-accent px-3 py-2 text-sm font-semibold text-accent-fg hover:bg-accent/90"
              >
                {primaryActionLabel}
              </button>
            ) : null}
          </div>
        )}
      </aside>
    </div>
  );
}
