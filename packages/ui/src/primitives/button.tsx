import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { cx } from "./classnames";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
  children?: ReactNode;
}

const BUTTON_PADDING_BY_SIZE: Record<ButtonSize, string> = {
  sm: "px-2 py-1.5",
  md: "px-3 py-2",
  lg: "px-3 py-2.5",
  icon: "h-8 w-8 p-0",
};

const BUTTON_TEXT_BY_SIZE: Record<ButtonSize, string> = {
  sm: "text-xs leading-tight",
  md: "text-sm leading-none",
  lg: "text-sm leading-none",
  icon: "text-sm leading-none",
};

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "border border-accent/95 bg-accent text-accent-fg hover:bg-accent/90 focus-visible:border-accent",
  secondary:
    "border border-border bg-surface-2 text-text-primary hover:bg-surface-3 focus-visible:border-accent",
  ghost:
    "border border-transparent bg-transparent text-text-secondary hover:bg-surface-3 hover:text-text-primary focus-visible:border-accent",
  outline:
    "border border-border bg-surface-1 text-text-primary hover:bg-surface-2 focus-visible:border-accent",
};

const BUTTON_VARIANT_STYLES: Record<ButtonVariant, CSSProperties> = {
  primary: {
    backgroundColor: "var(--accent)",
    borderColor: "var(--accent)",
    color: "var(--accent-fg)",
  },
  secondary: {
    backgroundColor: "var(--surface-2)",
    borderColor: "var(--border)",
    color: "var(--text-primary)",
  },
  ghost: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    color: "var(--text-secondary)",
  },
  outline: {
    backgroundColor: "var(--surface-1)",
    borderColor: "var(--border)",
    color: "var(--text-primary)",
  },
};

export function Button({
  variant = "primary",
  size = "md",
  leftSlot,
  rightSlot,
  className,
  children,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      style={{ ...BUTTON_VARIANT_STYLES[variant], ...style }}
      className={cx(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent/30",
        BUTTON_TEXT_BY_SIZE[size],
        BUTTON_PADDING_BY_SIZE[size],
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {leftSlot ? <span className="mr-2">{leftSlot}</span> : null}
      <span>{children}</span>
      {rightSlot ? <span className="ml-2">{rightSlot}</span> : null}
    </button>
  );
}
