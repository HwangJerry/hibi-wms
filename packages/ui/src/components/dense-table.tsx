import { type ReactNode } from "react";
import { cx } from "../primitives/classnames";

export type DenseTableRowClassName<T> = string | ((row: T, index: number) => string);

export interface DenseTableColumn<T> {
  id: string;
  title: ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
  render: (row: T) => ReactNode;
}

export interface DenseTableProps<T> {
  columns: DenseTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  className?: string;
  headerClassName?: string;
  rowClassName?: DenseTableRowClassName<T>;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

const ROW_HEIGHT_CLASS = "h-9";

export function DenseTable<T>({
  columns,
  rows,
  getRowKey,
  className,
  headerClassName,
  rowClassName,
  emptyMessage = "No rows",
  onRowClick,
}: DenseTableProps<T>) {
  return (
    <div className={cx("border border-border rounded-md overflow-hidden text-text-primary", className)}>
      <div
        className={cx(
          "flex items-center bg-surface-2/70 border-b border-border",
          "h-8 px-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary",
          headerClassName,
        )}
      >
        {columns.map((column) => (
          <div
            key={column.id}
            className={cx(
              "shrink-0",
              column.align === "center" && "text-center",
              column.align === "right" && "text-right",
            )}
            style={{ width: column.width }}
          >
            {column.title}
          </div>
        ))}
      </div>
      <div>
        {rows.length === 0 ? (
          <div className="px-3 py-5 text-sm text-text-secondary">{emptyMessage}</div>
        ) : (
          rows.map((row, index) => {
            const rowKey = getRowKey(row, index);

            return (
              <div
                key={rowKey}
                role={onRowClick ? "button" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={cx(
                  "flex items-center gap-2 border-b border-border/70 px-3",
                  ROW_HEIGHT_CLASS,
                  "text-sm",
                  onRowClick ? "cursor-pointer hover:bg-surface-2/70" : "",
                  typeof rowClassName === "function"
                    ? rowClassName(row, index)
                    : rowClassName,
                )}
                onClick={() => {
                  onRowClick?.(row);
                }}
                onKeyDown={(event) => {
                  if (!onRowClick || event.key !== "Enter") {
                    return;
                  }

                  event.preventDefault();
                  onRowClick(row);
                }}
              >
                {columns.map((column) => {
                  const cell = column.render(row);
                  const isString = typeof cell === "string" || typeof cell === "number";

                  return (
                    <div
                      key={column.id}
                      className={cx(
                        "shrink-0 truncate",
                        column.align === "center" && "text-center",
                        column.align === "right" && "text-right",
                      )}
                      style={{ width: column.width }}
                      title={isString ? String(cell) : undefined}
                    >
                      {cell}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
