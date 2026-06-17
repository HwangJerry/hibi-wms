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

function normalizeHue(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash + value.charCodeAt(i) * (i + 17)) % 360;
  }
  return hash;
}

export function Avatar({
  name,
  size = "md",
  fallback,
  className,
  ...props
}: AvatarProps) {
  const label = fallback ?? name.slice(0, 2).toUpperCase();
  const hue = normalizeHue(name);
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight",
        "border border-border",
        AVATAR_SIZE_CLASS[size],
        className,
      )}
      style={{
        backgroundColor: `hsl(${hue}, 50%, 34%)`,
        color: "hsl(0, 0%, 98%)",
      }}
      aria-label={name}
      {...props}
    >
      {label}
    </span>
  );
}
