import { cx } from "../primitives/classnames";
import { KpiTile } from "./kpi-tile";

export interface AccountTileProps {
  accountName: string;
  currency: string;
  balance: number;
  trend?: string;
  trendDirection?: "up" | "down" | "flat";
  className?: string;
}

function formatMoneyValue(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function AccountTile({
  accountName,
  currency,
  balance,
  trend,
  trendDirection = "flat",
  className,
}: AccountTileProps) {
  const normalizedCurrency = currency.trim().toUpperCase() || "USD";
  const balanceValue = formatMoneyValue(balance, normalizedCurrency);

  return (
    <KpiTile
      className={cx("relative overflow-hidden", className)}
      label={accountName}
      trend={trend}
      trendDirection={trendDirection}
      value={balanceValue}
      valueClassName="text-[20px]"
      trendClassName="text-[11px]"
    />
  );
}

