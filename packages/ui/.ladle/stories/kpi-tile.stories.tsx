import "../../tokens/tokens.css";
import { KpiTile } from "../../src";

export const KpiTileLight = () => (
  <div className="min-h-screen bg-surface-1 p-8 text-text-primary">
    <div className="grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <KpiTile label="Total Revenue" value="$1,284,902" trend="+$24,500 (4.0%)" trendDirection="up" />
      <KpiTile label="Outflow" value="$87,412" trend="-$8,750 (-9.1%)" trendDirection="down" />
      <KpiTile label="Open Approvals" value="12" trend="steady with no movement this week" trendDirection="flat" />
    </div>
  </div>
);

export const KpiTileDark = () => (
  <div className="dark min-h-screen bg-surface-1 p-8 text-text-primary">
    <div className="grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <KpiTile label="Total Revenue" value="$1,284,902" trend="+$24,500 (4.0%)" trendDirection="up" />
      <KpiTile label="Outflow" value="$87,412" trend="-$8,750 (-9.1%)" trendDirection="down" />
      <KpiTile label="Open Approvals" value="12" trend="steady with no movement this week" trendDirection="flat" />
    </div>
  </div>
);
