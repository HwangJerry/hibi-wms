import "../../tokens/tokens.css";
import {
  ApprovalDetailPanel,
  ApprovalList,
  Tabs,
  type ApprovalDetailRow,
  type ApprovalRow,
  type ReferenceTargetItem,
  type TabItem,
} from "../../src";

const currentUserId = "dev-maddox";

const rows: ApprovalRow[] = [
  {
    id: "apr-1042",
    type: "FINANCIAL",
    title: "Contractor engagement - Lena Voss",
    description: JSON.stringify({
      amount: 8750,
      currency: "USD",
      period: "monthly",
      account: "Operating",
      category: "Contractors",
      vendor: "Lena Voss Studio",
      memo: "Design-system implementation support for the next six weeks.",
    }),
    requesterId: "alex-kim",
    requesterName: "Alex Kim",
    approverId: currentUserId,
    state: "PENDING",
    decidedAt: null,
    createdAt: new Date("2026-06-16T09:30:00Z"),
    updatedAt: new Date("2026-06-17T10:15:00Z"),
  },
  {
    id: "apr-1040",
    type: "WORK",
    title: "Move docs editor to production cluster",
    description: "Sign off on enabling the Docs module for both partners.",
    requesterId: currentUserId,
    requesterName: "Dev Maddox",
    approverId: "alex-kim",
    state: "APPROVED",
    decidedAt: new Date("2026-06-14T17:00:00Z"),
    createdAt: new Date("2026-06-13T08:00:00Z"),
    updatedAt: new Date("2026-06-14T17:00:00Z"),
  },
  {
    id: "apr-1038",
    type: "FINANCIAL",
    title: "Annual vendor compliance filing",
    description: JSON.stringify({
      amount: 4200,
      currency: "USD",
      period: "one-time",
      account: "Operating",
      category: "Legal",
      vendor: "Northstar Legal",
    }),
    requesterId: "alex-kim",
    requesterName: "Alex Kim",
    approverId: currentUserId,
    state: "REJECTED",
    decidedAt: new Date("2026-06-11T12:00:00Z"),
    createdAt: new Date("2026-06-10T12:00:00Z"),
    updatedAt: new Date("2026-06-11T12:00:00Z"),
  },
];

const detail: ApprovalDetailRow = {
  ...rows[0],
  actions: [
    {
      id: "act-1",
      requestId: rows[0].id,
      actorId: "alex-kim",
      actorName: "Alex Kim",
      action: "SUBMIT",
      note: "Vendor is ready to start once approved.",
      createdAt: new Date("2026-06-16T09:30:00Z"),
    },
    {
      id: "act-2",
      requestId: rows[0].id,
      actorId: currentUserId,
      actorName: "Dev Maddox",
      action: "COMMENT",
      note: "Linked the Q3 Finance Ops parent task for context.",
      createdAt: new Date("2026-06-17T10:15:00Z"),
    },
  ],
};

const references: ReferenceTargetItem[] = [
  {
    id: "WMS-130",
    type: "TASK",
    title: "Reconcile Q2 vendor invoices",
    subtitle: "Backlog / In progress",
    path: "/backlog/WMS-130",
  },
  {
    id: "page-finance-q3",
    type: "PAGE",
    title: "Q3 Finance Ops",
    subtitle: "Docs / Finance",
    path: "/docs/page-finance-q3",
  },
];

const tabs: TabItem<"pending" | "mine" | "all">[] = [
  { value: "pending", label: "Pending on me (1)" },
  { value: "mine", label: "Mine (1)" },
  { value: "all", label: "All (3)" },
];

function ApprovalInboxStory({ dark = false }: { dark?: boolean }) {
  return (
    <div className={dark ? "dark min-h-screen bg-surface-1 p-8 text-text-primary" : "min-h-screen bg-surface-1 p-8 text-text-primary"}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal">Approvals inbox</h2>
          <p className="mt-1 text-sm text-text-secondary">3 total requests</p>
        </div>
        <div className="rounded-md border border-border bg-surface-1">
          <div className="border-b border-border px-4 py-3">
            <Tabs
              items={tabs}
              onChange={() => {
                void 0;
              }}
              value="pending"
            />
          </div>
          <ApprovalList
            activeTab="pending"
            currentUserId={currentUserId}
            onRowClick={() => {
              void 0;
            }}
            rows={rows}
          />
        </div>
      </div>
    </div>
  );
}

function ApprovalDetailStory({ dark = false }: { dark?: boolean }) {
  return (
    <div className={dark ? "dark min-h-screen bg-surface-1 p-8 text-text-primary" : "min-h-screen bg-surface-1 p-8 text-text-primary"}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Approval detail</h2>
        </div>
        <ApprovalDetailPanel
          currentUserId={currentUserId}
          decisionNote="Approved pending a final invoice check."
          detail={detail}
          incomingReferences={references}
          isApproving={false}
          isLinkingReference={false}
          isReferenceAlreadyLinked={(target) =>
            references.some((item) => item.type === target.type && item.id === target.id)
          }
          isRejecting={false}
          isSearchingReferences={false}
          onApprove={() => {
            void 0;
          }}
          onAttachReference={() => {
            void 0;
          }}
          onNoteChange={() => {
            void 0;
          }}
          onReferenceSearchTermChange={() => {
            void 0;
          }}
          onReject={() => {
            void 0;
          }}
          referenceSearchResults={references}
          referenceSearchTerm="q3"
          rightAction={
            <a className="rounded border border-border bg-surface-1 px-2.5 py-1.5 text-sm hover:bg-surface-3" href="/approvals">
              View all
            </a>
          }
        />
      </div>
    </div>
  );
}

export const ApprovalInboxLight = () => <ApprovalInboxStory />;
export const ApprovalInboxDark = () => <ApprovalInboxStory dark />;
export const ApprovalDetailLight = () => <ApprovalDetailStory />;
export const ApprovalDetailDark = () => <ApprovalDetailStory dark />;
