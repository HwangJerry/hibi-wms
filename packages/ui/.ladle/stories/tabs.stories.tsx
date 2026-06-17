import { useState } from "react";
import "../tokens/tokens.css";
import { Tabs, type TabItem } from "../src";

const TAB_ITEMS: readonly TabItem<string>[] = [
  { value: "active", label: "Active" },
  { value: "backlog", label: "Backlog" },
  { value: "done", label: "Done" },
] as const;

function TabDemo({ dark = false }: { dark?: boolean }) {
  const [tab, setTab] = useState("active");

  return (
    <div className={dark ? "dark min-h-screen bg-surface-1 p-8 text-text-primary" : "min-h-screen bg-surface-1 p-8 text-text-primary"}>
      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} />
      <div className="mt-4 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
        {tab === "active" && "8 tasks in progress across both partners."}
        {tab === "backlog" && "23 unstarted tasks waiting in the backlog."}
        {tab === "done" && "147 tasks completed all-time."}
      </div>
    </div>
  );
}

export const TabsLight = () => <TabDemo />;
export const TabsDark = () => <TabDemo dark />;
