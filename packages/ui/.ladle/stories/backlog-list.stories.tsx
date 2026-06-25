import { useState } from "react";
import "../../tokens/tokens.css";
import { BacklogList, type BacklogListColumnActionProps } from "../../src";
import type { BacklogTaskRow } from "../../src";

const rows: BacklogTaskRow[] = [
  {
    id: "WMS-129",
    title: "Annual entity compliance filing",
    description: "Review the legal memo and upload missing docs before quarter close.",
    status: "BACKLOG",
    priority: "LOW",
    assigneeId: "AK",
    parentId: null,
    order: 1024,
    createdAt: new Date("2026-05-20T10:00:00Z"),
    updatedAt: new Date("2026-06-12T11:20:00Z"),
  },
  {
    id: "WMS-130",
    title: "Reconcile Q2 vendor invoices",
    description: "Match bank entries against approved purchase orders.",
    status: "TODO",
    priority: "MEDIUM",
    assigneeId: "DM",
    parentId: null,
    order: 2048,
    createdAt: new Date("2026-05-28T13:00:00Z"),
    updatedAt: new Date("2026-06-12T12:40:00Z"),
  },
  {
    id: "WMS-131",
    title: "Set up recurring tax reserve transfer",
    description: null,
    status: "IN_PROGRESS",
    priority: "URGENT",
    assigneeId: null,
    parentId: null,
    order: 3072,
    createdAt: new Date("2026-05-30T09:10:00Z"),
    updatedAt: new Date("2026-06-13T08:15:00Z"),
  },
  {
    id: "WMS-132",
    title: "Approve Q1 expense report",
    description: null,
    status: "DONE",
    priority: "HIGH",
    assigneeId: "ES",
    parentId: null,
    order: 4096,
    createdAt: new Date("2026-05-31T15:00:00Z"),
    updatedAt: new Date("2026-06-13T14:12:00Z"),
  },
];

function action({ task }: BacklogListColumnActionProps) {
  return (
    <button
      className="rounded border border-border px-2 py-1 text-xs text-text-primary hover:bg-surface-3"
      type="button"
    >
      Edit
    </button>
  );
}

function BacklogListStory({ dark = false }: { dark?: boolean }) {
  const [tasks, setTasks] = useState(rows);
  const [pendingId, setPendingId] = useState<string | undefined>();

  return (
    <div className={dark ? "dark min-h-screen bg-surface-1 p-8" : "min-h-screen bg-surface-1 p-8"}>
      <BacklogList
        action={action}
        hasMoreTasks={false}
        isFetchingMore={false}
        isLoading={false}
        onEditTask={() => {
          void 0;
        }}
        onLoadMore={() => {
          void 0;
        }}
        onStatusChange={(id, status) => {
          setPendingId(id);
          setTasks((currentTasks) =>
            currentTasks.map((task) =>
              task.id === id ? { ...task, status } : task,
            ),
          );
          setPendingId(undefined);
        }}
        pendingStatusTaskId={pendingId}
        tasks={tasks}
      />
    </div>
  );
}

export const BacklogListLight = () => <BacklogListStory />;
export const BacklogListDark = () => <BacklogListStory dark />;
