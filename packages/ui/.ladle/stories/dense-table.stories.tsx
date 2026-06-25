import "../../tokens/tokens.css";
import { DenseTable, StatusPill } from "../../src";

interface TaskRow {
  id: string;
  title: string;
  status: string;
  owner: string;
  updated: string;
}

const rows: TaskRow[] = [
  {
    id: "WMS-142",
    title: "Reconcile Q2 vendor invoices",
    status: "In Progress",
    owner: "DM",
    updated: "2h",
  },
  {
    id: "WMS-141",
    title: "Draft partnership budget memo",
    status: "In Review",
    owner: "AK",
    updated: "5h",
  },
  {
    id: "WMS-140",
    title: "Migrate docs to new wiki space",
    status: "Todo",
    owner: "DM",
    updated: "1d",
  },
];

const columns = [
  {
    id: "id",
    title: "ID",
    width: "68px",
    render: (row: TaskRow) => row.id,
  },
  {
    id: "task",
    title: "Task",
    render: (row: TaskRow) => row.title,
  },
  {
    id: "status",
    title: "Status",
    width: "112px",
    render: (row: TaskRow) => (
      <StatusPill
        status={row.status === "Done" ? "done" : row.status === "In Review" ? "review" : "in-progress"}
        label={row.status}
      />
    ),
  },
  {
    id: "owner",
    title: "Assignee",
    width: "86px",
    render: (row: TaskRow) => row.owner,
  },
  {
    id: "updated",
    title: "Updated",
    width: "64px",
    render: (row: TaskRow) => row.updated,
  },
] as const;

function DenseTableStory({ dark = false }: { dark?: boolean }) {
  return (
    <div className={dark ? "dark min-h-screen bg-surface-1 p-8" : "min-h-screen bg-surface-1 p-8"}>
      <DenseTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        className="bg-surface-1"
      />
    </div>
  );
}

export const DenseTableLight = () => <DenseTableStory />;
export const DenseTableDark = () => <DenseTableStory dark />;
