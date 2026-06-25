import "../../tokens/tokens.css";
import { FinanceTransactionsTable, type FinanceTransactionsTableRow } from "../../src";

const rows: FinanceTransactionsTableRow[] = [
  {
    id: "tx-1",
    dateLabel: "Jun 15",
    description: "Quarterly tax reserve transfer",
    category: "Internal",
    account: "Tax Reserve",
    amount: -62000,
    currency: "USD",
    status: "PENDING",
    canReverse: false,
  },
  {
    id: "tx-2",
    dateLabel: "Jun 14",
    description: "Contractor — Lena Voss",
    category: "Contractors",
    account: "Operating",
    amount: -8750,
    currency: "USD",
    status: "PENDING",
    canReverse: false,
  },
  {
    id: "tx-3",
    dateLabel: "Jun 16",
    description: "Stripe payout — Acme Corp",
    category: "Revenue",
    account: "Operating",
    amount: 24500,
    currency: "USD",
    status: "POSTED",
    canReverse: true,
  },
  {
    id: "tx-4",
    dateLabel: "Jun 15",
    description: "AWS — infrastructure",
    category: "Infrastructure",
    account: "Operating",
    amount: -4182.66,
    currency: "USD",
    status: "POSTED",
    canReverse: true,
  },
  {
    id: "tx-5",
    dateLabel: "Jun 08",
    description: "AWS — infrastructure",
    category: "Infrastructure",
    account: "Operating",
    amount: 4182.66,
    currency: "USD",
    status: "REVERSED",
    canReverse: false,
  },
];

function Story({ dark = false }: { dark?: boolean }) {
  return (
    <div className={dark ? "dark min-h-screen bg-surface-1 p-8" : "min-h-screen bg-surface-1 p-8"}>
      <FinanceTransactionsTable
        rows={rows}
        onReverse={() => {
          void 0;
        }}
        rowClassName={(row) => (row.status === "PENDING" ? "border-l-2 border-status-pending" : undefined)}
      />
    </div>
  );
}

export const FinanceTransactionsTableLight = () => <Story />;
export const FinanceTransactionsTableDark = () => <Story dark />;
