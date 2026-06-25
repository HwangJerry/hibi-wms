import "../../tokens/tokens.css";
import { AccountTile } from "../../src";

export const AccountTileLight = () => (
  <div className="min-h-screen bg-surface-1 p-8 text-text-primary">
    <div className="grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <AccountTile
        accountName="Operating"
        balance={1284902}
        currency="USD"
        trend="+$24,500 today"
        trendDirection="up"
      />
      <AccountTile
        accountName="Tax Reserve"
        balance={312500}
        currency="USD"
        trend="−$62,000 pending"
        trendDirection="down"
      />
      <AccountTile
        accountName="Receivable"
        balance={55700}
        currency="USD"
        trend="2 open invoices"
        trendDirection="flat"
      />
      <AccountTile
        accountName="Savings"
        balance={480000}
        currency="USD"
        trend="No activity"
        trendDirection="flat"
      />
    </div>
  </div>
);

export const AccountTileDark = () => (
  <div className="dark min-h-screen bg-surface-1 p-8 text-text-primary">
    <div className="grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <AccountTile
        accountName="Operating"
        balance={1284902}
        currency="USD"
        trend="+$24,500 today"
        trendDirection="up"
      />
      <AccountTile
        accountName="Tax Reserve"
        balance={312500}
        currency="USD"
        trend="−$62,000 pending"
        trendDirection="down"
      />
      <AccountTile
        accountName="Receivable"
        balance={55700}
        currency="USD"
        trend="2 open invoices"
        trendDirection="flat"
      />
      <AccountTile
        accountName="Savings"
        balance={480000}
        currency="USD"
        trend="No activity"
        trendDirection="flat"
      />
    </div>
  </div>
);
