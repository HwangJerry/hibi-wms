import "../tokens/tokens.css";
import { CommandPalette } from "../src";

const items = [
  {
    id: "1",
    group: "Navigate",
    label: "Backlog",
    meta: "31 tasks",
    leading: "▤",
  },
  {
    id: "2",
    group: "Navigate",
    label: "Approvals",
    meta: "4 pending",
    leading: "🗂",
  },
  {
    id: "3",
    group: "Create",
    label: "New task",
    leading: "＋",
    shortcut: "C",
  },
  {
    id: "4",
    group: "Create",
    label: "New transaction",
    shortcut: "N",
  },
  {
    id: "5",
    group: "Recent",
    label: "WMS-142 — Reconcile Q2 vendor invoices",
  },
  {
    id: "6",
    group: "Recent",
    label: "Q3 Finance — Operating Plan",
  },
];

function CommandPaletteDemo({ dark = false }: { dark?: boolean }) {
  return (
    <div
      className={
        dark
          ? "dark relative min-h-[360px] bg-surface-1 p-8"
          : "relative min-h-[360px] bg-surface-1 p-8"
      }
    >
      <CommandPalette
        open
        onClose={() => undefined}
        query="new t"
        items={items}
      />
    </div>
  );
}

export const CommandPaletteLight = () => <CommandPaletteDemo />;
export const CommandPaletteDark = () => <CommandPaletteDemo dark />;
