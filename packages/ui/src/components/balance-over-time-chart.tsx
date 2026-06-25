import { cx } from "../primitives/classnames";

type ChangeDirection = "up" | "down" | "flat";

export interface BalanceOverTimePoint {
  label: string;
  value: number;
}

export interface BalanceOverTimeChartProps {
  title: string;
  periodLabel?: string;
  points: BalanceOverTimePoint[];
  valueChange?: string;
  valueChangeDirection?: ChangeDirection;
  className?: string;
}

const CHART_HEIGHT = 170;
const CHART_PADDING_X = 44;
const CHART_PADDING_Y = 24;
const CHART_PADDING_BOTTOM = 28;

function getRange(values: number[]) {
  const numeric = values.filter((value) => Number.isFinite(value));
  if (numeric.length === 0) {
    return { min: 0, max: 1 };
  }

  let min = Math.min(...numeric);
  let max = Math.max(...numeric);
  if (min === max) {
    const floor = Math.floor(min * 0.9);
    const ceil = Math.ceil(max * 1.1);
    min = floor;
    max = ceil === floor ? floor + 1 : ceil;
  }

  const spread = Math.max(1, max - min);
  const buffer = spread * 0.1;
  return {
    min: min - buffer,
    max: max + buffer,
  };
}

function formatCompact(value: number) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  const absoluteValue = Math.abs(value);
  if (absoluteValue >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }

  if (absoluteValue >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}k`;
  }

  return `$${value.toFixed(0)}`;
}

export function BalanceOverTimeChart({
  title,
  periodLabel,
  points,
  valueChange,
  valueChangeDirection = "flat",
  className,
}: BalanceOverTimeChartProps) {
  const hasData = points.length >= 2;
  const safePoints = hasData ? points : [];
  const values = safePoints.map((point) => point.value);
  const { min, max } = getRange(values);
  const stepX = safePoints.length > 1 ? 100 / (safePoints.length - 1) : 0;
  const viewHeight = CHART_HEIGHT - CHART_PADDING_Y - CHART_PADDING_BOTTOM;
  const toX = (index: number) => CHART_PADDING_X + (stepX * index) / 100 * (1000 - CHART_PADDING_X);
  const toY = (value: number) =>
    CHART_PADDING_Y + viewHeight - ((value - min) / (max - min)) * viewHeight;

  const line = safePoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${toX(index)} ${toY(point.value)}`)
    .join(" ");
  const area = `${line} L ${toX(safePoints.length - 1)} ${CHART_HEIGHT - CHART_PADDING_BOTTOM} L ${toX(0)} ${CHART_HEIGHT - CHART_PADDING_BOTTOM} Z`;
  const directionColor = {
    up: "var(--status-approved)",
    down: "var(--status-rejected)",
    flat: "var(--text-secondary)",
  };

  return (
    <section className={cx("border-b border-border bg-surface-1 p-4", className)}>
      <header className="mb-4 flex items-baseline gap-2">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {periodLabel ? (
          <p className="text-sm text-text-secondary">{periodLabel}</p>
        ) : null}
        {valueChange ? (
          <p
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary"
            style={{ color: directionColor[valueChangeDirection] }}
          >
            <span aria-hidden="true">
              {valueChangeDirection === "up" ? "↗" : valueChangeDirection === "down" ? "↘" : "→"}
            </span>
            {valueChange}
          </p>
        ) : null}
      </header>

      {hasData ? (
        <svg
          className="block h-[170px] w-full"
          viewBox="0 0 1000 170"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="financeBalanceArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>

          <line
            x1={CHART_PADDING_X}
            y1={CHART_HEIGHT - CHART_PADDING_BOTTOM}
            x2={1000 - CHART_PADDING_X}
            y2={CHART_HEIGHT - CHART_PADDING_BOTTOM}
            stroke="var(--surface-3)"
          />
          <line
            x1={CHART_PADDING_X}
            y1={CHART_PADDING_Y + viewHeight / 2}
            x2={1000 - CHART_PADDING_X}
            y2={CHART_PADDING_Y + viewHeight / 2}
            stroke="var(--surface-3)"
          />

          {[0.2, 0.5, 0.8].map((ratio) => {
            const y = CHART_PADDING_Y + viewHeight * ratio;
            return (
              <line
                key={ratio}
                x1={CHART_PADDING_X}
                y1={y}
                x2={1000 - CHART_PADDING_X}
                y2={y}
                stroke="var(--surface-3)"
              />
            );
          })}

          <text
            x={CHART_PADDING_X - 4}
            y={CHART_PADDING_Y + viewHeight + 4}
            textAnchor="end"
            fontSize="10"
            fill="var(--text-secondary)"
          >
            {formatCompact(min)}
          </text>
          <text
            x={CHART_PADDING_X - 4}
            y={CHART_PADDING_Y + 4}
            textAnchor="end"
            fontSize="10"
            fill="var(--text-secondary)"
          >
            {formatCompact(max)}
          </text>

          <path d={area} fill="url(#financeBalanceArea)" />
          <path
            d={line}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {safePoints.map((point, index) => {
            const x = toX(index);
            const y = toY(point.value);
            return (
              <circle
                key={`${point.label}-${index}`}
                cx={x}
                cy={y}
                r={index === safePoints.length - 1 ? 4 : 3}
                fill={index === safePoints.length - 1 ? "var(--accent)" : "var(--surface-1)"}
                stroke="var(--accent)"
                strokeWidth={index === safePoints.length - 1 ? 2 : 1.5}
              />
            );
          })}

          {safePoints.map((point, index) => {
            const x = toX(index);
            const y = CHART_HEIGHT - CHART_PADDING_BOTTOM + 14;
            return (
              <text
                key={`label-${point.label}-${index}`}
                x={x}
                y={y}
                textAnchor="middle"
                fontSize="10"
                fill="var(--text-secondary)"
              >
                {point.label}
              </text>
            );
          })}
        </svg>
      ) : (
        <div className="flex h-[170px] items-center justify-center rounded border border-dashed border-border text-sm text-text-secondary">
          No balance data for this period.
        </div>
      )}
    </section>
  );
}
