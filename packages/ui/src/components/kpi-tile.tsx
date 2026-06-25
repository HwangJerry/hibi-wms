import { cx } from "../primitives/classnames";

export interface KpiTileProps {
  label: string;
  value: string;
  trend?: string;
  trendDirection?: "up" | "down" | "flat";
  className?: string;
  valueClassName?: string;
  trendClassName?: string;
}

const TREND_STYLES: Record<
  NonNullable<KpiTileProps["trendDirection"]>,
  {
    trendLabel: string;
    textColor: string;
    icon: string;
  }
> = {
  up: {
    trendLabel: "Trend up",
    textColor: "var(--status-approved)",
    icon: "↗",
  },
  down: {
    trendLabel: "Trend down",
    textColor: "var(--status-rejected)",
    icon: "↘",
  },
  flat: {
    trendLabel: "Flat",
    textColor: "var(--text-secondary)",
    icon: "→",
  },
};

export function KpiTile({
  label,
  value,
  trend,
  trendDirection = "flat",
  className,
  valueClassName,
  trendClassName,
}: KpiTileProps) {
  const tone = TREND_STYLES[trendDirection];

  return (
    <article className={cx("rounded-md border border-border bg-surface-2 p-3.5", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{label}</p>
      <p
        className={cx("mt-2 text-[28px] font-semibold leading-tight tracking-tight text-text-primary tabular-nums", valueClassName)}
      >
        {value}
      </p>
      {trend ? (
        <p
          className={cx("mt-1.5 text-xs", trendClassName)}
          style={{ color: tone.textColor }}
        >
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden>{tone.icon}</span>
            <span className="font-medium">{trend}</span>
            <span className="text-[10px] uppercase tracking-wider text-text-secondary">
              {tone.trendLabel}
            </span>
          </span>
        </p>
      ) : null}
    </article>
  );
}
