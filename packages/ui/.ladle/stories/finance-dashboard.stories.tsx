import "../../tokens/tokens.css";
import { FinanceDashboard, type FinanceDashboardProps } from "../../src";

const dashboardProps: FinanceDashboardProps = {
  periodLabel: "Jun 2026",
  balanceChange: "+$455,602  +27.2%",
  balanceChangeDirection: "up",
  kpis: [
    {
      label: "Total balance",
      value: "$2,133,102",
      trend: "+$62,540 this month",
      trendDirection: "up",
    },
    {
      label: "Income · Jun",
      value: "$74,300",
      trend: "vs $68,200 last mo.",
      trendDirection: "up",
    },
    {
      label: "Expenses · Jun",
      value: "$83,172",
      trend: "$11,244 over budget",
      trendDirection: "down",
    },
    {
      label: "Pending approval",
      value: "$70,750",
      trend: "2 items awaiting sign-off",
      trendDirection: "flat",
    },
  ],
  balancePoints: [
    { label: "Jan", value: 1800000 },
    { label: "Feb", value: 1904000 },
    { label: "Mar", value: 1972000 },
    { label: "Apr", value: 2038000 },
    { label: "May", value: 2070540 },
    { label: "Jun", value: 2133102 },
  ],
  budgetRows: [
    {
      id: "revenue",
      category: "Revenue",
      actual: "$110,300",
      budget: "$120,000",
      delta: "−8.1%",
      deltaDirection: "down",
    },
    {
      id: "contractors",
      category: "Contractors",
      actual: "$26,200",
      budget: "$25,000",
      delta: "+4.8%",
      deltaDirection: "up",
    },
    {
      id: "infrastructure",
      category: "Infrastructure",
      actual: "$12,400",
      budget: "$15,000",
      delta: "−17.3%",
      deltaDirection: "down",
    },
    {
      id: "facilities",
      category: "Facilities",
      actual: "$8,000",
      budget: "$8,000",
      delta: "0%",
      deltaDirection: "flat",
    },
  ],
};

function Story({ dark = false }: { dark?: boolean }) {
  return (
    <div className={dark ? "dark min-h-screen bg-surface-1 p-8" : "min-h-screen bg-surface-1 p-8"}>
      <FinanceDashboard {...dashboardProps} />
    </div>
  );
}

export const FinanceDashboardLight = () => <Story />;
export const FinanceDashboardDark = () => <Story dark />;
