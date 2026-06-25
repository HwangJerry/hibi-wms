import type { ReactNode } from "react";
import { cx } from "../primitives/classnames";

export interface SegmentedControlOption<Value extends string> {
  icon?: ReactNode;
  label: ReactNode;
  value: Value;
}

export interface SegmentedControlProps<Value extends string> {
  ariaLabel: string;
  className?: string;
  onValueChange: (value: Value) => void;
  options: SegmentedControlOption<Value>[];
  value: Value;
}

export function SegmentedControl<Value extends string>({
  ariaLabel,
  className,
  onValueChange,
  options,
  value,
}: SegmentedControlProps<Value>) {
  return (
    <div
      aria-label={ariaLabel}
      className={cx(
        "inline-flex h-9 items-center rounded-md border border-border bg-surface-1 p-0.5",
        className,
      )}
      role="group"
    >
      {options.map((option) => {
        const isSelected = option.value === value;

        return (
          <button
            aria-pressed={isSelected}
            className={cx(
              "inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-sm font-medium transition-colors outline-none",
              "focus-visible:ring-2 focus-visible:ring-focus-ring/40",
              isSelected
                ? "bg-accent-subtle text-accent"
                : "text-text-secondary hover:bg-surface-3 hover:text-text-primary",
            )}
            key={option.value}
            onClick={() => onValueChange(option.value)}
            type="button"
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
