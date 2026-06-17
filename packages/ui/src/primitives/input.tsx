import type {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";
import { cx } from "./classnames";

export type DenseInputSize = "sm" | "md";
export type DenseInputKind = "input" | "textarea";

interface DenseInputBaseProps {
  size?: DenseInputSize;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
}

export type DenseInputProps = DenseInputBaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, keyof DenseInputBaseProps>;

export type DenseTextareaProps = DenseInputBaseProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, keyof DenseInputBaseProps>;

const INPUT_SIZE: Record<DenseInputSize, string> = {
  sm: "h-7 px-2 text-xs",
  md: "h-8 px-3 text-sm",
};

const INPUT_BASE =
  "w-full rounded-md border bg-surface-2 text-text-primary transition-colors outline-none";

export function Input({
  size = "md",
  leftSlot,
  rightSlot,
  className,
  ...props
}: DenseInputProps) {
  const hasLeftSlot = Boolean(leftSlot);
  const hasRightSlot = Boolean(rightSlot);

  return (
    <div className="relative w-full">
      {leftSlot ? (
        <span className="pointer-events-none absolute left-2 top-1/2 flex -translate-y-1/2 text-text-secondary">
          {leftSlot}
        </span>
      ) : null}

      {rightSlot ? (
        <span className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 text-text-secondary">
          {rightSlot}
        </span>
      ) : null}

      <input
        className={cx(
          INPUT_BASE,
          "placeholder:text-text-secondary focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20",
          INPUT_SIZE[size],
          hasLeftSlot ? "pl-8" : null,
          hasRightSlot ? "pr-8" : null,
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function DenseTextarea({
  size = "md",
  className,
  ...props
}: DenseTextareaProps) {
  return (
    <textarea
      className={cx(
        "min-h-16 w-full resize-y rounded-md border bg-surface-2 text-text-primary transition-colors outline-none",
        "focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 placeholder:text-text-secondary",
        size === "sm" ? "p-2 text-sm" : "p-2.5 text-sm",
        className,
      )}
      {...props}
    />
  );
}
