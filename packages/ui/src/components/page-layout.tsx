import type { CSSProperties, ReactNode, SelectHTMLAttributes } from "react";
import { cx } from "../primitives/classnames";

export interface PageFrameProps {
  children: ReactNode;
  className?: string;
  maxWidth?: "md" | "lg" | "xl" | "full";
  style?: CSSProperties;
}

const PAGE_FRAME_MAX_WIDTH: Record<NonNullable<PageFrameProps["maxWidth"]>, string> = {
  md: "max-w-5xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
  full: "max-w-none",
};

export function PageFrame({
  children,
  className,
  maxWidth = "xl",
  style,
}: PageFrameProps) {
  return (
    <section
      className={cx(
        "mx-auto flex w-full flex-col gap-4",
        PAGE_FRAME_MAX_WIDTH[maxWidth],
        className,
      )}
      style={style}
    >
      {children}
    </section>
  );
}

export interface PageHeaderProps {
  actions?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  title: ReactNode;
}

export function PageHeader({
  actions,
  eyebrow,
  meta,
  title,
}: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-xs font-medium text-text-secondary">{eyebrow}</p>
        ) : null}
        <h2 className="truncate text-xl font-semibold tracking-normal text-text-primary">
          {title}
        </h2>
        {meta ? <p className="mt-1 text-sm text-text-secondary">{meta}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export interface ToolbarProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  trailing?: ReactNode;
}

export function Toolbar({
  children,
  className,
  style,
  trailing,
}: ToolbarProps) {
  return (
    <div
      className={cx(
        "flex flex-nowrap items-end gap-3 rounded-md border border-border bg-surface-muted px-3 py-2",
        className,
      )}
      data-visual-region="toolbar"
      style={style}
    >
      {children}
      {trailing ? <div className="ml-auto flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </div>
  );
}

export interface FilterChipSelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label: ReactNode;
  options: Array<{
    label: ReactNode;
    value: string;
  }>;
  value: string;
}

export function FilterChipSelect({
  className,
  label,
  options,
  value,
  ...props
}: FilterChipSelectProps) {
  const selectedOption = options.find((option) => option.value === value);
  const selectedLabel = selectedOption?.label ?? value;

  return (
    <label
      className={cx(
        "relative inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-surface-1 px-2.5 text-xs text-text-secondary transition-colors",
        "hover:bg-surface-3 focus-within:ring-2 focus-within:ring-focus-ring/40",
        className,
      )}
    >
      <span>{label}</span>
      <span className="text-text-secondary">·</span>
      <span className="font-medium text-text-primary">{selectedLabel}</span>
      <select
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        value={value}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export interface FilterChipButtonProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function FilterChipButton({
  children,
  className,
  onClick,
}: FilterChipButtonProps) {
  return (
    <button
      className={cx(
        "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-surface-1 px-2.5 text-xs text-text-secondary transition-colors",
        "hover:bg-surface-3 focus-visible:ring-2 focus-visible:ring-focus-ring/40",
        className,
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export interface FieldProps {
  children: ReactNode;
  className?: string;
  label: ReactNode;
}

export function Field({
  children,
  className,
  label,
}: FieldProps) {
  return (
    <label className={cx("grid gap-1 text-sm font-medium text-text-primary", className)}>
      <span className="text-xs font-semibold text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

export interface InlineAlertProps {
  children: ReactNode;
  className?: string;
  tone?: "error" | "neutral";
}

export function InlineAlert({
  children,
  className,
  tone = "neutral",
}: InlineAlertProps) {
  return (
    <p
      className={cx(
        "rounded-md border px-3 py-2 text-sm",
        tone === "error"
          ? "border-status-rejected/30 bg-status-rejected/15 text-status-rejected"
          : "border-border bg-surface-muted text-text-secondary",
        className,
      )}
    >
      {children}
    </p>
  );
}
