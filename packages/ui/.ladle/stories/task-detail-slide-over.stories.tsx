import { TaskDetailSlideOver, type TaskDetailFormState } from "../../src";

const initialFormState: TaskDetailFormState = {
  title: "Reconcile Q2 vendor invoices",
  description:
    "Match all 14 vendor invoices against the Q2 general ledger. Flag any discrepancy over $500 for partner sign-off before month close. Acme Corp and Halcyon Labs invoices take priority — both are over $20k.",
  status: "IN_PROGRESS",
  priority: "URGENT",
  assigneeId: "Dev Maddox",
  parentId: "Q3 Finance Ops",
};

function TaskDetailStory({ dark = false }: { dark?: boolean }) {
  return (
    <div
      className={
        dark
          ? "dark relative min-h-[760px] overflow-hidden bg-surface-1 text-text-primary"
          : "relative min-h-[760px] overflow-hidden bg-surface-1 text-text-primary"
      }
    >
      <div className="grid h-[760px] grid-cols-[minmax(0,1fr)_420px]">
        <section className="border-r border-border bg-surface-2/40 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary">
                Backlog / List
              </p>
              <h1 className="mt-1 text-xl font-semibold">Task detail preview</h1>
            </div>
            <span className="rounded-md border border-border bg-surface-1 px-2.5 py-1 text-xs text-text-secondary">
              WMS-142
            </span>
          </div>

          <div className="overflow-hidden rounded-md border border-border bg-surface-1">
            {["Reconcile Q2 vendor invoices", "Draft partnership budget memo", "Migrate docs to new wiki space"].map(
              (title, index) => (
                <div
                  className={
                    index === 0
                      ? "flex items-center justify-between border-b border-border bg-accent/10 px-3 py-3"
                      : "flex items-center justify-between border-b border-border px-3 py-3 last:border-b-0"
                  }
                  key={title}
                >
                  <div>
                    <p className="text-xs text-text-secondary">WMS-{142 - index}</p>
                    <p className="text-sm font-medium">{title}</p>
                  </div>
                  <span className="text-xs text-text-secondary">
                    {index === 0 ? "Selected" : "Backlog"}
                  </span>
                </div>
              ),
            )}
          </div>
        </section>

        <TaskDetailSlideOver
          attachments={[
            {
              id: "att-1",
              createdAt: new Date("2026-06-13T10:00:00Z"),
              downloadUrl: "#",
              fileName: "Vendor_Invoices_Q2.zip",
              mimeType: "application/zip",
              sizeBytes: 2_400_000,
            },
          ]}
          comments={[
            {
              id: "comment-1",
              authorInitials: "AK",
              authorName: "Aria Kessler",
              body: "All 14 invoices are in the shared drive. I'd start with Acme Corp and Halcyon Labs — both are over $20k and need to clear before the Jun 24 close.",
              timestampLabel: "5h ago",
            },
            {
              id: "comment-2",
              authorInitials: "DM",
              authorName: "Dev Maddox",
              body: "On it. Found a $620 discrepancy on the Acme invoice — will ping you before I adjust the ledger.",
              timestampLabel: "2h ago",
            },
          ]}
          currentUserId="Dev Maddox"
          initialFormState={initialFormState}
          isReadOnly={false}
          isSaving={false}
          mode="edit"
          onClose={() => undefined}
          onSubmit={() => undefined}
          open
          references={[
            {
              id: "doc-1",
              path: "/docs?pageId=runbook",
              subtitle: "Docs · Last edited 1d ago",
              title: "Q3 Finance Runbook",
              type: "PAGE",
            },
            {
              id: "approval-1",
              path: "/approvals/apv-0031",
              statusLabel: "Pending",
              statusTone: "review",
              subtitle: "Approvals · Submitted Jun 12",
              title: "Q2 Budget Increase · $30k",
              type: "APPROVAL",
            },
          ]}
          taskId="WMS-142"
          updatedAt={new Date("2026-06-18T03:24:00Z")}
        />
      </div>
    </div>
  );
}

export const TaskDetailSlideOverLight = () => <TaskDetailStory />;
export const TaskDetailSlideOverDark = () => <TaskDetailStory dark />;
