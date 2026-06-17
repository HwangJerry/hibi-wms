import { cx } from "./classnames";

export interface TabItem<TValue extends string> {
  value: TValue;
  label: string;
}

export interface TabsProps<TValue extends string> {
  items: readonly TabItem<TValue>[];
  value: TValue;
  onChange: (next: TValue) => void;
  className?: string;
  listClassName?: string;
  tabClassName?: string;
  activeTabClassName?: string;
}

export function Tabs<TValue extends string>({
  items,
  value,
  onChange,
  className,
  listClassName,
  tabClassName,
  activeTabClassName,
}: TabsProps<TValue>) {
  return (
    <div className={cx("border-b border-border", className)}>
      <div className={cx("flex items-center gap-4 px-3", listClassName)}>
        {items.map((item) => {
          const isActive = item.value === value;
          return (
            <button
              type="button"
              key={item.value}
              onClick={() => onChange(item.value)}
              className={cx(
                "border-b-2 pb-1.5 pt-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-accent text-text-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary",
                tabClassName,
                isActive ? activeTabClassName : undefined,
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
