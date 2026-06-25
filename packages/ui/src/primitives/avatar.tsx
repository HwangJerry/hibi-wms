import type { HTMLAttributes } from "react";
import { cx } from "./classnames";

export type AvatarSize = "xs" | "sm" | "md" | "lg";

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  name: string;
  size?: AvatarSize;
  fallback?: string;
}

const AVATAR_SIZE_CLASS: Record<AvatarSize, string> = {
  xs: "h-5 w-5 text-[10px]",
  sm: "h-6 w-6 text-[11px]",
  md: "h-7 w-7 text-xs",
  lg: "h-9 w-9 text-sm",
};

export function Avatar({
  name,
  size = "md",
  fallback,
  className,
  ...props
}: AvatarProps) {
  const label = fallback ?? name.slice(0, 2).toUpperCase();
  const isAccentAvatar = label.startsWith("A");
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight",
        isAccentAvatar
          ? "bg-accent-subtle text-accent"
          : "bg-status-done/15 text-status-done",
        AVATAR_SIZE_CLASS[size],
        className,
      )}
      aria-label={name}
      {...props}
    >
      {label}
    </span>
  );
}
