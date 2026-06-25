import { cx } from "../primitives/classnames";
import { DenseTable, type DenseTableColumn, type DenseTableRowClassName } from "./dense-table";
import { StatusPill } from "./status-pill";

export type FinanceTransactionStatus = "PENDING" | "POSTED" | "REVERSED";

export interface FinanceTransactionsTableRow {
  id: string;
  dateLabel: string;
  description: string;
  category: string;
  account: string;
  amount: number;
  currency: string;
  status: FinanceTransactionStatus;
  canReverse: boolean;
}

export interface FinanceTransactionsTableProps {
  rows: FinanceTransactionsTableRow[];
  onReverse: (row: FinanceTransactionsTableRow) => void;
  reversingTransactionId?: string | null;
  className?: string;
  rowClassName?: DenseTableRowClassName<FinanceTransactionsTableRow>;
}

function formatAmount(amount: number, currency: string) {
  const absoluteAmount = Math.abs(amount);
  const prefix = amount < 0 ? "−" : "+";

  try {
    const formatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return `${prefix}${formatter.format(absoluteAmount)}`;
  } catch {
    return `${prefix}${absoluteAmount.toFixed(2)} ${currency}`;
  }
}

function getStatusPillProps(status: FinanceTransactionStatus) {
  if (status === "PENDING") {
    return {
      label: "PENDING",
      color: "var(--status-pending)",
      backgroundColor: "color-mix(in srgb, var(--status-pending) 14%, transparent)",
      borderColor: "color-mix(in srgb, var(--status-pending) 28%, transparent)",
    } as const;
  }

  if (status === "REVERSED") {
    return {
      label: "REVERSED",
      color: "var(--text-secondary)",
      backgroundColor: "color-mix(in srgb, var(--text-secondary) 14%, transparent)",
      borderColor: "color-mix(in srgb, var(--text-secondary) 28%, transparent)",
    } as const;
  }

  return {
    label: "POSTED",
    color: "var(--status-approved)",
    backgroundColor: "color-mix(in srgb, var(--status-approved) 14%, transparent)",
    borderColor: "color-mix(in srgb, var(--status-approved) 30%, transparent)",
  } as const;
}

function getRowClassName(status: FinanceTransactionStatus) {
  if (status === "PENDING") {
    return "bg-status-pending/10 hover:bg-status-pending/16";
  }

  if (status === "REVERSED") {
    return "opacity-55 text-text-secondary";
  }

  return "";
}

function getAmountClassName(amount: number, status: FinanceTransactionStatus) {
  if (status === "REVERSED") {
    return "text-text-secondary line-through";
  }

  return amount < 0 ? "text-status-rejected" : "text-status-approved";
}

function buildColumns(
  onReverse: (row: FinanceTransactionsTableRow) => void,
  reversingTransactionId?: string | null,
): DenseTableColumn<FinanceTransactionsTableRow>[] {
  return [
    {
      id: "date",
      title: "Date",
      width: "86px",
      render: (row) => <span className="text-text-secondary">{row.dateLabel}</span>,
    },
    {
      id: "description",
      title: "Description",
      render: (row) => (
        <span
          className={
            row.status === "REVERSED"
              ? "truncate text-text-secondary line-through"
              : "truncate text-text-primary"
          }
          title={row.description}
        >
          {row.description}
        </span>
      ),
    },
    {
      id: "category",
      title: "Category",
      width: "118px",
      render: (row) => <span className="truncate text-text-secondary">{row.category}</span>,
    },
    {
      id: "account",
      title: "Account",
      width: "118px",
      render: (row) => <span className="truncate text-text-secondary">{row.account}</span>,
    },
    {
      id: "amount",
      title: "Amount",
      width: "130px",
      align: "right",
      render: (row) => (
        <span className={cx("tabular-nums", getAmountClassName(row.amount, row.status))}>
          {formatAmount(row.amount, row.currency)}
        </span>
      ),
    },
    {
      id: "status",
      title: "Status",
      width: "110px",
      render: (row) => {
        const statusPill = getStatusPillProps(row.status);

        return (
          <StatusPill
            status="custom"
            label={statusPill.label}
            statusColor={statusPill.color}
            textColor={statusPill.color}
            backgroundColor={statusPill.backgroundColor}
            borderColor={statusPill.borderColor}
          />
        );
      },
    },
    {
      id: "actions",
      title: "",
      width: "40px",
      align: "right",
      render: (row) => {
        if (!row.canReverse) {
          return <span aria-hidden="true" />;
        }

        const isReversing = reversingTransactionId === row.id;
        return (
          <button
            aria-label={`Reverse transaction ${row.id}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-border bg-surface-2 px-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary"
            disabled={isReversing}
            onClick={() => {
              onReverse(row);
            }}
            type="button"
          >
            {isReversing ? "⋯" : "↩"}
          </button>
        );
      },
    },
  ];
}

function getCombinedRowClassName(
  row: FinanceTransactionsTableRow,
  index: number,
  externalRowClassName?: DenseTableRowClassName<FinanceTransactionsTableRow>,
) {
  const baseClassName = getRowClassName(row.status);

  if (!externalRowClassName) {
    return baseClassName;
  }

  const resolved =
    typeof externalRowClassName === "function"
      ? externalRowClassName(row, index)
      : externalRowClassName;

  return cx(baseClassName, resolved);
}

export function FinanceTransactionsTable({
  rows,
  onReverse,
  reversingTransactionId,
  className,
  rowClassName,
}: FinanceTransactionsTableProps) {
  const columns = buildColumns(onReverse, reversingTransactionId);

  return (
    <DenseTable
      className={className}
      columns={columns}
      emptyMessage="No transactions"
      getRowKey={(row) => row.id}
      rowClassName={(row, index) => getCombinedRowClassName(row, index, rowClassName)}
      rows={rows}
    />
  );
}
