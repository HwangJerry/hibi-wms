import type { BalanceOverTimePoint } from "./balance-over-time-chart";
import { cx } from "../primitives/classnames";

export interface FinanceDashboardKpi {
  label: string;
  value: string;
  trend?: string;
  trendDirection?: "up" | "down" | "flat";
}

export interface FinanceBudgetRow {
  id: string;
  category: string;
  actual: string;
  budget: string;
  delta: string;
  deltaDirection: "up" | "down" | "flat";
}

export interface FinanceDashboardProps {
  className?: string;
  kpis: FinanceDashboardKpi[];
  balancePoints: BalanceOverTimePoint[];
  budgetRows: FinanceBudgetRow[];
  periodLabel: string;
  balanceChange?: string;
  balanceChangeDirection?: FinanceDashboardKpi["trendDirection"];
  isLoading?: boolean;
  showBalanceChart?: boolean;
  showKpis?: boolean;
}

const KPI_GRID_CLASS = "grid h-[89px] border-b border-border bg-surface-1 lg:grid-cols-4";
const KPI_TILE_CLASS = "flex min-h-0 flex-col gap-1 border-b border-border-subtle px-4 py-3 lg:border-b-0 lg:border-r last:border-r-0";
const CHART_VIEW_BOX_WIDTH = 860;
const CHART_VIEW_BOX_HEIGHT = 170;
const CHART_POINTS = [
  { x: 55, y: 146 },
  { x: 208, y: 126 },
  { x: 361, y: 110 },
  { x: 514, y: 85 },
  { x: 667, y: 55 },
  { x: 820, y: 32 },
] as const;
const CHART_LINE_PATH =
  "M 55,146 C 80,143 157,132 208,126 C 259,120 310,117 361,110 C 412,103 463,94 514,85 C 565,76 616,64 667,55 C 718,46 795,36 820,32";
const CHART_AREA_PATH = `${CHART_LINE_PATH} L 820,165 L 55,165 Z`;
const BUDGET_BAR_TRACK_CLASS = "relative h-[5px] rounded bg-border-subtle";
const BUDGET_ROW_COLORS = [
  "var(--finance-positive-strong)",
  "var(--finance-negative-strong)",
  "var(--accent)",
  "var(--finance-warning)",
  "var(--finance-neutral)",
] as const;

const BUDGET_WIDTH_BY_INDEX = ["91.9%", "100%", "82.7%", "100%", "88%"] as const;

function getTrendColor(direction: FinanceDashboardKpi["trendDirection"]) {
  if (direction === "up") {
    return "var(--finance-positive)";
  }

  if (direction === "down") {
    return "var(--finance-negative)";
  }

  return "var(--text-secondary)";
}

function getKpiValueClassName(index: number, direction: FinanceDashboardKpi["trendDirection"]) {
  if (index === 0) {
    return "text-text-primary";
  }

  if (direction === "up") {
    return "text-finance-positive";
  }

  if (direction === "down") {
    return "text-finance-negative";
  }

  return "text-finance-warning";
}

function getBudgetDeltaClassName(direction: FinanceBudgetRow["deltaDirection"]) {
  if (direction === "up") {
    return "font-medium text-finance-negative";
  }

  if (direction === "down") {
    return "text-finance-positive";
  }

  return "text-text-muted";
}

function getBudgetActualClassName(index: number, direction: FinanceBudgetRow["deltaDirection"]) {
  if (index === 0) {
    return "font-medium text-finance-positive";
  }

  if (direction === "up") {
    return "font-medium text-finance-negative";
  }

  return "font-medium text-text-secondary";
}

function toRangeLabel(points: BalanceOverTimePoint[], fallback: string) {
  if (points.length >= 2) {
    return `${points[0]?.label} 2026 - ${points[points.length - 1]?.label} 2026`;
  }

  return fallback;
}

export function FinanceDashboard({
  className,
  kpis,
  balancePoints,
  budgetRows,
  periodLabel,
  balanceChange,
  balanceChangeDirection = "flat",
  isLoading = false,
  showBalanceChart = true,
  showKpis = true,
}: FinanceDashboardProps) {
  if (isLoading) {
    return (
      <div className={cx("border-b border-border bg-surface-1 px-4 py-4 text-sm text-text-secondary", className)}>
        Loading finance dashboard
      </div>
    );
  }

  return (
    <section className={cx("bg-surface-1", className)} data-visual-region="finance-dashboard">
      {showKpis ? (
        <div className={KPI_GRID_CLASS}>
          {kpis.map((kpi, index) => (
            <article className={KPI_TILE_CLASS} key={kpi.label}>
              <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-muted">
                {kpi.label}
              </span>
              <span
                className={cx(
                  "text-[22px] font-semibold leading-[1.1] tracking-normal tabular-nums",
                  getKpiValueClassName(index, kpi.trendDirection),
                )}
              >
                {kpi.value}
              </span>
              {kpi.trend ? (
                <span
                  className="inline-flex items-center gap-1 text-[11.5px] tabular-nums text-text-secondary"
                  style={{ color: getTrendColor(kpi.trendDirection) }}
                >
                  <span aria-hidden>{kpi.trendDirection === "down" ? "↓" : kpi.trendDirection === "up" ? "↑" : ""}</span>
                  {kpi.trend}
                </span>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {showBalanceChart ? (
        <section className="border-b border-border bg-surface-1 px-[18px] pb-0 pt-[18px]">
          <div className="mb-3.5 flex items-baseline gap-2.5">
            <h3 className="text-xs font-semibold text-text-primary">Total balance</h3>
            <p className="text-xs text-text-muted">{toRangeLabel(balancePoints, periodLabel)}</p>
            {balanceChange ? (
              <p
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium tabular-nums"
                style={{ color: getTrendColor(balanceChangeDirection) }}
              >
                <span aria-hidden>{balanceChangeDirection === "down" ? "↓" : balanceChangeDirection === "up" ? "↑" : "→"}</span>
                {balanceChange}
              </p>
            ) : null}
          </div>
          <svg
            className="block h-[170px] w-full overflow-visible"
            viewBox={`0 0 ${CHART_VIEW_BOX_WIDTH} ${CHART_VIEW_BOX_HEIGHT}`}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="financeBalanceArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.12" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1="55" x2="820" y1="115" y2="115" stroke="var(--border-subtle)" />
            <line x1="55" x2="820" y1="65" y2="65" stroke="var(--border-subtle)" />
            <path d={CHART_AREA_PATH} fill="url(#financeBalanceArea)" />
            <path
              d={CHART_LINE_PATH}
              fill="none"
              stroke="var(--accent)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
            {CHART_POINTS.map((point, index) => (
              <circle
                cx={point.x}
                cy={point.y}
                fill={index === CHART_POINTS.length - 1 ? "var(--accent)" : "var(--surface-1)"}
                key={`${point.x}-${point.y}`}
                r={index === CHART_POINTS.length - 1 ? 4 : 3}
                stroke={index === CHART_POINTS.length - 1 ? "var(--surface-1)" : "var(--accent)"}
                strokeWidth={index === CHART_POINTS.length - 1 ? 2 : 1.5}
              />
            ))}
            <rect fill="var(--accent-subtle)" height="18" rx="5" stroke="var(--accent-subtle-border)" width="74" x="779" y="10" />
          </svg>
        </section>
      ) : null}

      <section className="bg-surface-1 px-[18px] py-4">
        <div className="mb-3.5 flex items-baseline gap-2.5">
          <h3 className="text-xs font-semibold text-text-primary">Budget vs actual</h3>
          <p className="text-xs text-text-muted">{periodLabel}</p>
        </div>

        <div className="mb-1.5 flex items-center border-b border-border-muted pb-2">
          <span className="w-[106px] text-[10.5px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Category</span>
          <span className="flex-1" />
          <span className="w-[78px] text-right text-[10.5px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Actual</span>
          <span className="w-[78px] text-right text-[10.5px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Budget</span>
          <span className="w-12 text-right text-[10.5px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Delta</span>
        </div>

        <div>
          {budgetRows.map((row, index) => {
            const barColor = BUDGET_ROW_COLORS[index] ?? "var(--finance-neutral)";
            return (
              <div className="flex h-8 items-center" key={row.id}>
                <div className="flex w-[106px] items-center gap-[7px]">
                  <span
                    className="h-[7px] w-[7px] shrink-0 rounded-full"
                    style={{ backgroundColor: barColor }}
                  />
                  <span className="truncate text-[12.5px] text-text-primary">{row.category}</span>
                </div>
                <div className="min-w-0 flex-1 px-3.5">
                  <div className={BUDGET_BAR_TRACK_CLASS}>
                    <span
                      className="absolute left-0 top-0 h-[5px] rounded"
                      style={{
                        backgroundColor: barColor,
                        width: BUDGET_WIDTH_BY_INDEX[index] ?? "88%",
                      }}
                    />
                    {row.deltaDirection === "up" ? (
                      <span
                        className="absolute right-[-4px] top-[-1.5px] h-2 w-0.5 rounded"
                        style={{ backgroundColor: barColor }}
                      />
                    ) : null}
                  </div>
                </div>
                <span className={cx("w-[78px] text-right text-[12.5px] tabular-nums", getBudgetActualClassName(index, row.deltaDirection))}>
                  {row.actual}
                </span>
                <span className="w-[78px] text-right text-[12.5px] tabular-nums text-text-muted">
                  {row.budget}
                </span>
                <span className={cx("w-12 text-right text-xs tabular-nums", getBudgetDeltaClassName(row.deltaDirection))}>
                  {row.delta}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
}
