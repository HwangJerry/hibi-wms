import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../primitives/classnames";

export type StatusTone =
  | "todo"
  | "active"
  | "in-progress"
  | "review"
  | "done"
  | "blocked"
  | "approved"
  | "rejected"
  | "neutral"
  | "custom";

export interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  status: StatusTone;
  label: string;
  dot?: boolean;
  leftSlot?: ReactNode;
  statusColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
}

const PRESET_BY_STATUS: Record<
  Exclude<StatusTone, "custom"> | "custom",
  {
    dotColor: string;
    textColor: string;
    backgroundColor: string;
    borderColor: string;
  }
> = {
  custom: {
    dotColor: "var(--text-secondary)",
    textColor: "var(--text-secondary)",
    backgroundColor: "color-mix(in srgb, var(--text-secondary) 12%, transparent)",
    borderColor: "color-mix(in srgb, var(--text-secondary) 22%, transparent)",
  },
  neutral: {
    dotColor: "var(--text-secondary)",
    textColor: "var(--text-secondary)",
    backgroundColor: "color-mix(in srgb, var(--text-secondary) 14%, transparent)",
    borderColor: "color-mix(in srgb, var(--text-secondary) 24%, transparent)",
  },
  todo: {
    dotColor: "var(--text-secondary)",
    textColor: "var(--text-secondary)",
    backgroundColor: "color-mix(in srgb, var(--text-secondary) 12%, transparent)",
    borderColor: "color-mix(in srgb, var(--text-secondary) 22%, transparent)",
  },
  active: {
    dotColor: "var(--status-pending)",
    textColor: "var(--status-pending)",
    backgroundColor: "var(--status-pending-bg)",
    borderColor: "var(--status-pending-border)",
  },
  "in-progress": {
    dotColor: "var(--status-pending)",
    textColor: "var(--status-pending)",
    backgroundColor: "var(--status-pending-bg)",
    borderColor: "var(--status-pending-border)",
  },
  review: {
    dotColor: "var(--accent)",
    textColor: "var(--accent)",
    backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)",
    borderColor: "color-mix(in srgb, var(--accent) 28%, transparent)",
  },
  done: {
    dotColor: "var(--status-done)",
    textColor: "var(--status-done)",
    backgroundColor: "color-mix(in srgb, var(--status-done) 14%, transparent)",
    borderColor: "color-mix(in srgb, var(--status-done) 30%, transparent)",
  },
  approved: {
    dotColor: "var(--status-approved)",
    textColor: "var(--status-approved)",
    backgroundColor: "color-mix(in srgb, var(--status-approved) 14%, transparent)",
    borderColor: "color-mix(in srgb, var(--status-approved) 30%, transparent)",
  },
  blocked: {
    dotColor: "var(--status-rejected)",
    textColor: "var(--status-rejected)",
    backgroundColor: "color-mix(in srgb, var(--status-rejected) 12%, transparent)",
    borderColor: "color-mix(in srgb, var(--status-rejected) 30%, transparent)",
  },
  rejected: {
    dotColor: "var(--status-rejected)",
    textColor: "var(--status-rejected)",
    backgroundColor: "color-mix(in srgb, var(--status-rejected) 12%, transparent)",
    borderColor: "color-mix(in srgb, var(--status-rejected) 30%, transparent)",
  },
};

export function StatusPill({
  status,
  label,
  dot = true,
  leftSlot,
  statusColor,
  backgroundColor,
  borderColor,
  textColor,
  className,
  ...props
}: StatusPillProps) {
  const tone = PRESET_BY_STATUS[status] ?? PRESET_BY_STATUS.neutral;
  const resolved = {
    dotColor: statusColor ?? tone.dotColor,
    text: textColor ?? tone.textColor,
    background: backgroundColor ?? tone.backgroundColor,
    border: borderColor ?? tone.borderColor,
  };

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        "min-h-6 whitespace-nowrap",
        className,
      )}
      style={{
        color: resolved.text,
        borderColor: resolved.border,
        backgroundColor: resolved.background,
      }}
      {...props}
    >
      {leftSlot}
      {dot ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: resolved.dotColor }} />
      : null}
      <span>{label}</span>
    </span>
  );
}
