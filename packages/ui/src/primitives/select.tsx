import type { SelectHTMLAttributes } from "react";
import { cx } from "./classnames";

export type SelectSize = "sm" | "md";

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  size?: SelectSize;
}

const SELECT_SIZE: Record<SelectSize, string> = {
  sm: "h-8 px-2 text-sm",
  md: "h-9 px-3 text-sm",
};

export function Select({
  className,
  size = "md",
  ...props
}: SelectProps) {
  return (
    <select
      className={cx(
        "rounded-md border border-border bg-surface-2 text-text-primary transition-colors outline-none",
        "focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-focus-ring/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        SELECT_SIZE[size],
        className,
      )}
      {...props}
    />
  );
}
