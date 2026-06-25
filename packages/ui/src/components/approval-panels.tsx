import { Briefcase, XCircle, Wallet } from "lucide-react";
import { type ReactNode } from "react";
import { Avatar } from "../primitives/avatar";
import { Button } from "../primitives/button";
import { DenseTextarea } from "../primitives/input";
import { DenseTable, type DenseTableColumn } from "./dense-table";
import {
  ReferenceListPanel,
  ReferencePickerPanel,
  type ReferenceTargetItem,
} from "./reference-links";
import { StatusPill, type StatusTone } from "./status-pill";

export type ApprovalRequestState =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type ApprovalType = "WORK" | "FINANCIAL";
export type ApprovalActionKind = "SUBMIT" | "APPROVE" | "REJECT" | "CANCEL" | "COMMENT";
export type ApprovalAmountUnit = "one-time" | "monthly" | "yearly";

export interface ApprovalMeta {
  amount?: number;
  currency?: string;
  period?: ApprovalAmountUnit;
  account?: string;
  category?: string;
  vendor?: string;
  memo?: string;
}

export interface ApprovalRow {
  id: string;
  type: ApprovalType;
  title: string;
  description: string | null;
  requesterId: string;
  requesterName?: string;
  approverId: string;
  state: ApprovalRequestState;
  decidedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ApprovalActionRow {
  id: string;
  requestId: string;
  actorId: string;
  actorName: string;
  action: ApprovalActionKind;
  note: string | null;
  createdAt: string | Date;
}

export interface ApprovalDetailRow extends ApprovalRow {
  actions?: ApprovalActionRow[];
  approverName?: string;
}

export interface ApprovalListProps {
  rows: ApprovalRow[];
  currentUserId: string;
  activeTab: "pending" | "mine" | "all";
  onRowClick: (row: ApprovalRow) => void;
}

export interface ApprovalDetailPanelProps {
  currentUserId: string;
  detail: ApprovalDetailRow;
  decisionNote: string;
  incomingReferences: ReferenceTargetItem[];
  referenceSearchTerm: string;
  referenceSearchResults: ReferenceTargetItem[];
  isApproving: boolean;
  isCancelling?: boolean;
  isRejecting: boolean;
  isSearchingReferences: boolean;
  isLinkingReference: boolean;
  referenceErrorMessage?: string | null;
  onApprove: () => void;
  onCancel?: () => void;
  onReject: () => void;
  onNoteChange: (note: string) => void;
  onReferenceSearchTermChange: (next: string) => void;
  onAttachReference: (target: Pick<ReferenceTargetItem, "id" | "type">) => void | Promise<void>;
  isReferenceAlreadyLinked: (target: Pick<ReferenceTargetItem, "id" | "type">) => boolean;
  rightAction?: ReactNode;
}

function parseApprovalMeta(rawDescription: string | null): ApprovalMeta {
  if (!rawDescription) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawDescription) as ApprovalMeta;
    if (typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
  } catch {
    // Fall through to legacy plain-text extraction.
  }

  const amountMatch =
    /amount\s*[:=]\s*([A-Za-z]{2,4})?\s*([0-9][\d,]*(?:\.\d{1,2})?)/i.exec(rawDescription) ??
    /\$(\d[\d,]*(?:\.\d{1,2})?)/.exec(rawDescription);

  if (!amountMatch) {
    return {};
  }

  const currency = amountMatch[1] ?? "USD";
  const numeric = amountMatch[2];
  const amount = Number(numeric?.replace(/,/g, ""));
  const periodMatch = /(monthly|yearly|mo|yr|one-time|per year)/i.exec(rawDescription);
  const period = (() => {
    if (periodMatch?.[0] === "monthly" || periodMatch?.[0] === "mo") return "monthly";
    if (periodMatch?.[0] === "yearly" || periodMatch?.[0] === "yr") return "yearly";
    if (periodMatch?.[0] === "per year") return "yearly";
    return "one-time";
  })();

  if (Number.isNaN(amount)) {
    return {};
  }

  return {
    amount,
    currency: currency.toUpperCase(),
    period,
  };
}

function formatAmount(meta: ApprovalMeta): string {
  if (!meta.amount) {
    return "--";
  }

  const currency = meta.currency ?? "USD";
  const amount = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(meta.amount);

  if (!meta.period || meta.period === "one-time") {
    return amount;
  }

  return `${amount}${meta.period === "monthly" ? "/mo" : "/yr"}`;
}

function getInitials(value: string) {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "U";
  }

  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((namePart) => namePart[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatAge(input: string | Date | null | undefined): string {
  if (!input) {
    return "--";
  }

  const timestamp = new Date(input).getTime();
  if (Number.isNaN(timestamp)) {
    return "--";
  }

  const ageMinutes = Math.floor(Math.max(0, Date.now() - timestamp) / 60_000);

  if (ageMinutes < 60) {
    return `${ageMinutes}m`;
  }

  const ageHours = Math.floor(ageMinutes / 60);
  if (ageHours < 24) {
    return `${ageHours}h`;
  }

  const ageDays = Math.floor(ageHours / 24);
  if (ageDays < 14) {
    return `${ageDays}d`;
  }

  return `${Math.floor(ageDays / 7)}w`;
}

function formatDate(value: string | Date) {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

function formatShortDate(value: string | Date) {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(timestamp);
}

function getTypeTone(type: ApprovalType) {
  if (type === "FINANCIAL") {
    return {
      status: "review" as const,
      icon: <Wallet className="h-3.5 w-3.5" aria-hidden="true" />,
      label: "Financial",
    };
  }

  return {
    status: "neutral" as const,
    icon: <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />,
    label: "Work",
  };
}

function getStateTone(state: ApprovalRequestState): StatusTone {
  switch (state) {
    case "PENDING":
      return "active";
    case "APPROVED":
      return "approved";
    case "REJECTED":
      return "rejected";
    case "CANCELLED":
      return "neutral";
    default:
      return "todo";
  }
}

function getActionLabel(action: ApprovalActionKind) {
  if (action === "APPROVE") return "Approved";
  if (action === "REJECT") return "Rejected";
  if (action === "CANCEL") return "Cancelled";
  if (action === "COMMENT") return "Comment";
  return "Submitted";
}

function buildTimelineEvents(detail: ApprovalDetailRow): ApprovalActionRow[] {
  const actions = detail.actions?.slice() ?? [];

  if (actions.length > 0) {
    return actions.sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );
  }

  return [
    {
      id: `${detail.id}-submitted`,
      requestId: detail.id,
      actorId: detail.requesterId,
      actorName: detail.requesterName ?? detail.requesterId,
      action: "SUBMIT",
      createdAt: detail.createdAt,
      note: detail.type === "FINANCIAL" ? "Submitted for financial review." : "Submitted for review.",
    },
  ];
}

function approvalListColumns(currentUserId: string): DenseTableColumn<ApprovalRow>[] {
  return [
    {
      id: "type",
      title: "Type",
      width: "98px",
      render: (request) => {
        const typeLabel = getTypeTone(request.type);
        return <StatusPill status={typeLabel.status} label={typeLabel.label} />;
      },
    },
    {
      id: "title",
      title: "Request",
      render: (request) => (
        <div>
          <p className="truncate font-medium text-text-primary">{request.title}</p>
          <p className="truncate text-xs text-text-secondary">{request.id}</p>
        </div>
      ),
    },
    {
      id: "from",
      title: "From",
      width: "112px",
      render: (request) => {
        const displayName = request.requesterName ?? request.requesterId;
        const isMe = request.requesterId === currentUserId;
        const label = isMe ? "You" : getInitials(displayName);

        return (
          <span className="flex items-center gap-2">
            <Avatar name={displayName} size="xs" fallback={label} />
            <span className="truncate text-sm">{isMe ? "You" : displayName}</span>
          </span>
        );
      },
    },
    {
      id: "amount",
      title: "Amount",
      width: "110px",
      align: "right",
      render: (request) => {
        if (request.type !== "FINANCIAL") {
          return <span className="text-text-secondary">--</span>;
        }

        return <span>{formatAmount(parseApprovalMeta(request.description))}</span>;
      },
    },
    {
      id: "status",
      title: "Status",
      width: "112px",
      render: (request) => <StatusPill label={request.state} status={getStateTone(request.state)} />,
    },
    {
      id: "age",
      title: "Age",
      width: "58px",
      align: "right",
      render: (request) => <span className="text-text-secondary">{formatAge(request.updatedAt)}</span>,
    },
  ];
}

export function ApprovalList({ rows, currentUserId, activeTab, onRowClick }: ApprovalListProps) {
  const emptyMessage = (() => {
    if (activeTab === "pending") return "No pending requests assigned to you";
    if (activeTab === "mine") return "No requests submitted by you yet";
    return "No approval requests available";
  })();

  return (
    <DenseTable
      columns={approvalListColumns(currentUserId)}
      emptyMessage={emptyMessage}
      getRowKey={(row) => row.id}
      onRowClick={onRowClick}
      rows={rows}
      rowClassName="h-11"
    />
  );
}

export function ApprovalDetailPanel({
  currentUserId,
  detail,
  decisionNote,
  incomingReferences,
  referenceSearchTerm,
  referenceSearchResults,
  isApproving,
  isCancelling = false,
  isRejecting,
  isSearchingReferences,
  isLinkingReference,
  referenceErrorMessage,
  onApprove,
  onCancel,
  onReject,
  onNoteChange,
  onReferenceSearchTermChange,
  onAttachReference,
  isReferenceAlreadyLinked,
  rightAction,
}: ApprovalDetailPanelProps) {
  const canApprove = detail.approverId === currentUserId && detail.state === "PENDING";
  const canCancel = detail.requesterId === currentUserId && detail.state === "PENDING";
  const typeLabel = getTypeTone(detail.type);
  const meta = parseApprovalMeta(detail.description);
  const events = buildTimelineEvents(detail);

  return (
    <>
      <article className="space-y-4 rounded-md border border-border bg-surface-2 p-4 text-text-primary">
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill
                status={typeLabel.status}
                label={typeLabel.label}
                leftSlot={typeLabel.icon}
              />
              <StatusPill status={getStateTone(detail.state)} label={detail.state} />
              <span className="text-xs text-text-secondary">{detail.id}</span>
            </div>

            <h3 className="text-xl font-semibold">{detail.title}</h3>

            <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
              <span className="inline-flex items-center gap-2">
                <Avatar
                  fallback={getInitials(detail.requesterName ?? detail.requesterId)}
                  name={detail.requesterName ?? detail.requesterId}
                  size="xs"
                />
                <span>From {detail.requesterName ?? detail.requesterId}</span>
              </span>
              <span aria-hidden="true">/</span>
              <span>Submitted {formatShortDate(detail.createdAt)}</span>
              <span aria-hidden="true">/</span>
              <span>Age {formatAge(detail.createdAt)}</span>
            </div>
          </div>

          {rightAction}
        </div>

        {detail.type === "FINANCIAL" ? (
          <section className="rounded-md border border-border bg-surface-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Transaction summary
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-normal">{formatAmount(meta)}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <SummaryTile label="Account" value={meta.account || "--"} />
              <SummaryTile label="Category" value={meta.category || "--"} />
              <SummaryTile label="Vendor" value={meta.vendor || "--"} />
              <SummaryTile label="Period" value={meta.period || "one-time"} />
            </div>
          </section>
        ) : null}

        <ReferenceListPanel
          emptyLabel="No backlinks yet."
          items={incomingReferences}
          title="Backlinks"
        />

        <ReferencePickerPanel
          errorMessage={referenceErrorMessage}
          isAlreadyLinked={isReferenceAlreadyLinked}
          isLinking={isLinkingReference}
          isSearching={isSearchingReferences}
          onAttach={onAttachReference}
          onSearchTermChange={onReferenceSearchTermChange}
          searchResults={referenceSearchResults}
          searchTerm={referenceSearchTerm}
        />

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Activity
          </h4>
          <div className="space-y-3">
            {events.map((event) => {
              const actorName = event.actorName;
              return (
                <div key={event.id} className="flex gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-[10px]">
                    {actorName.slice(0, 2)}
                  </span>
                  <div>
                    <div className="text-sm">
                      <span className="font-medium">{actorName}</span>
                      <span className="text-text-secondary"> / {getActionLabel(event.action)}</span>
                    </div>
                    {event.note ? <p className="text-sm text-text-primary">{event.note}</p> : null}
                    <p className="text-xs text-text-secondary">{formatDate(event.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </article>

      <div className="rounded-md border border-border bg-surface-2 p-3 text-text-primary">
        <div className="space-y-2">
          <p className="text-sm font-medium">Decision note (optional)</p>
          <DenseTextarea
            aria-label="Decision note"
            disabled={isApproving || isRejecting}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="Add a decision note..."
            value={decisionNote}
          />

          <div className="flex justify-end gap-2">
            {onCancel ? (
              <Button
                className="mr-auto border-status-rejected text-status-rejected hover:bg-status-rejected/10"
                disabled={!canCancel || isCancelling || isRejecting || isApproving}
                onClick={onCancel}
                type="button"
                variant="outline"
              >
                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                {isCancelling ? "Cancelling..." : "Cancel request"}
              </Button>
            ) : null}
            <Button
              disabled={!canApprove || isCancelling || isRejecting || isApproving}
              onClick={onReject}
              type="button"
              variant="outline"
              className="border-status-rejected text-status-rejected hover:bg-status-rejected/10"
            >
              Reject
            </Button>
            <Button disabled={!canApprove || isCancelling || isRejecting || isApproving} onClick={onApprove} type="button">
              Approve
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-surface-2 px-3 py-2">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
