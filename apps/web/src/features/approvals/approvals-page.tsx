import { PencilLine, Plus, X } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ApprovalDetailPanel,
  ApprovalList,
  Button,
  DenseTextarea,
  Field,
  InlineAlert,
  Input,
  PageFrame,
  PageHeader,
  Select,
  Tabs,
  type ReferenceTargetItem,
  type TabItem,
} from "@hibi/ui";
import { trpc } from "@/providers/trpc-provider";

const APPROVAL_TABS = [
  { value: "pending", label: "Pending on me" } as const,
  { value: "mine", label: "Mine" } as const,
  { value: "all", label: "All" } as const,
] satisfies readonly TabItem<ApprovalsTab>[];

const APPROVAL_TYPE_OPTIONS = ["WORK", "FINANCIAL"] as const;
const FINANCIAL_PERIOD_OPTIONS = ["one-time", "monthly", "yearly"] as const;
const REFERENCE_LIST_LIMIT = 50;
const REFERENCE_SEARCH_LIMIT = 12;
const REFERENCE_SEARCH_MIN_LENGTH = 2;

type ApprovalRequestState =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

type ApprovalType = "WORK" | "FINANCIAL";
type ApprovalActionKind = "SUBMIT" | "APPROVE" | "REJECT" | "CANCEL" | "COMMENT";

type ApprovalsTab = "pending" | "mine" | "all";

type ApprovalAmountUnit = (typeof FINANCIAL_PERIOD_OPTIONS)[number];

type ApprovalMeta = {
  amount?: number;
  currency?: string;
  period?: ApprovalAmountUnit;
  account?: string;
  category?: string;
  vendor?: string;
  memo?: string;
};

type ApprovalRow = {
  id: string;
  type: ApprovalType;
  title: string;
  description: string | null;
  requesterId: string;
  approverId: string;
  state: ApprovalRequestState;
  decidedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type ApprovalActionRow = {
  id: string;
  requestId: string;
  actorId: string;
  actorName: string;
  action: ApprovalActionKind;
  note: string | null;
  createdAt: string | Date;
};

type ApprovalDetailRow = ApprovalRow & {
  actions?: ApprovalActionRow[];
  requesterName?: string;
  approverName?: string;
};

type CreateApprovalPayload = {
  type: ApprovalType;
  title: string;
  description?: string;
  approverId?: string;
};

type NewRequestFormState = {
  title: string;
  type: ApprovalType;
  description: string;
  approverId: string;
  amount: string;
  currency: string;
  period: ApprovalAmountUnit;
  account: string;
  category: string;
  vendor: string;
};

const EMPTY_FORM_STATE: NewRequestFormState = {
  title: "",
  type: "WORK",
  description: "",
  approverId: "",
  amount: "",
  currency: "USD",
  period: "one-time",
  account: "",
  category: "",
  vendor: "",
};

function approvalRowsFromQueryRows(rows: Array<unknown> | undefined): ApprovalRow[] {
  if (!rows) {
    return [];
  }

  return rows as ApprovalRow[];
}

function approvalDetailFromQuery(row: unknown): ApprovalDetailRow | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  return row as ApprovalDetailRow;
}

function toCreateDescription(state: NewRequestFormState): CreateApprovalPayload {
  const baseTitle = state.title.trim();
  const baseDescription = state.description.trim();
  const approverId = state.approverId.trim();

  if (state.type === "FINANCIAL") {
    const amount = Number(state.amount);
    const meta: ApprovalMeta = {};

    if (!Number.isNaN(amount) && amount > 0) {
      meta.amount = amount;
      meta.currency = state.currency.trim() || "USD";
      meta.period = state.period;
    }

    if (state.account.trim()) {
      meta.account = state.account.trim();
    }

    if (state.category.trim()) {
      meta.category = state.category.trim();
    }

    if (state.vendor.trim()) {
      meta.vendor = state.vendor.trim();
    }

    if (baseDescription) {
      meta.memo = baseDescription;
    }

    const requestDescription = Object.keys(meta).length > 0 ? JSON.stringify(meta) : undefined;

    return {
      type: "FINANCIAL",
      title: baseTitle,
      approverId: approverId.length > 0 ? approverId : undefined,
      description: requestDescription,
    };
  }

  return {
    type: "WORK",
    title: baseTitle,
    approverId: approverId.length > 0 ? approverId : undefined,
    description: baseDescription || undefined,
  };
}

function getCreateErrorMessage(formState: NewRequestFormState): string | null {
  const title = formState.title.trim();
  if (!title) {
    return "Title is required.";
  }

  if (formState.type === "FINANCIAL") {
    const amount = Number(formState.amount);
    const hasAmount = formState.amount.trim().length > 0;

    if (hasAmount && (Number.isNaN(amount) || amount < 0)) {
      return "Amount must be 0 or a valid positive number.";
    }
  }

  return null;
}

export function ApprovalsPage({ currentUserId }: { currentUserId: string }) {
  const utils = trpc.useUtils();
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const requestId = params.id ?? null;
  const [activeTab, setActiveTab] = useState<ApprovalsTab>("pending");
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [formState, setFormState] = useState<NewRequestFormState>(EMPTY_FORM_STATE);
  const [decisionNote, setDecisionNote] = useState("");

  useEffect(() => {
    setDecisionNote("");
  }, [requestId]);

  const listQuery = trpc.approval.list.useQuery(
    {
      mine: true,
      limit: 100,
    },
    {
      staleTime: 30_000,
    },
  );
  const createMutation = trpc.approval.create.useMutation({
    onSuccess: (request) => {
      setIsNewRequestOpen(false);
      setFormState(EMPTY_FORM_STATE);
      void utils.approval.list.invalidate();
      void utils.approval.count.invalidate();
      void navigate(`/approvals/${request.id}`);
    },
  });
  const getQuery = trpc.approval.get.useQuery(
    { id: requestId ?? "" },
    {
      enabled: requestId !== null,
    },
  );
  const approveMutation = trpc.approval.approve.useMutation({
    onSuccess: async () => {
      await Promise.all([
        getQuery.refetch(),
        utils.approval.list.invalidate(),
        utils.approval.count.invalidate(),
      ]);
      setDecisionNote("");
    },
  });
  const rejectMutation = trpc.approval.reject.useMutation({
    onSuccess: async () => {
      await Promise.all([
        getQuery.refetch(),
        utils.approval.list.invalidate(),
        utils.approval.count.invalidate(),
      ]);
      setDecisionNote("");
    },
  });
  const cancelMutation = trpc.approval.cancel.useMutation({
    onSuccess: async () => {
      await Promise.all([
        getQuery.refetch(),
        utils.approval.list.invalidate(),
        utils.approval.count.invalidate(),
      ]);
      setDecisionNote("");
    },
  });

  const listLoadError = listQuery.error
    ? `Failed to load approval requests: ${listQuery.error.message}`
    : null;
  const requestLoadError = getQuery.error
    ? `Failed to load approval detail: ${getQuery.error.message}`
    : null;
  const createRequestError = createMutation.error
    ? `Failed to create request: ${createMutation.error.message}`
    : null;
  const approveError = approveMutation.error
    ? `Failed to approve request: ${approveMutation.error.message}`
    : null;
  const rejectError = rejectMutation.error
    ? `Failed to reject request: ${rejectMutation.error.message}`
    : null;
  const cancelError = cancelMutation.error
    ? `Failed to cancel request: ${cancelMutation.error.message}`
    : null;
  const detailMutationError = [approveError, rejectError, cancelError].find(Boolean);

  const rows = approvalRowsFromQueryRows(listQuery.data?.items);
  const tabCounts = useMemo(() => {
    const pendingOnMe = rows.filter(
      (row) => row.state === "PENDING" && row.approverId === currentUserId,
    ).length;
    const mine = rows.filter((row) => row.requesterId === currentUserId).length;

    return {
      pending: pendingOnMe,
      mine,
      all: rows.length,
    };
  }, [currentUserId, rows]);

  const visibleRows = useMemo(() => {
    if (activeTab === "pending") {
      return rows.filter(
        (row) => row.state === "PENDING" && row.approverId === currentUserId,
      );
    }

    if (activeTab === "mine") {
      return rows.filter((row) => row.requesterId === currentUserId);
    }

    return rows;
  }, [activeTab, currentUserId, rows]);

  if (requestId !== null) {
    if (getQuery.isLoading) {
      return (
        <section className="mx-auto flex w-full max-w-5xl flex-col gap-3">
          <Button
            variant="outline"
            onClick={() => {
              void navigate("/approvals");
            }}
            type="button"
          >
            ← Back to inbox
          </Button>
          <p className="text-sm text-text-secondary">Loading request detail…</p>
        </section>
      );
    }

    if (getQuery.isError) {
      return (
        <section className="mx-auto flex w-full max-w-5xl flex-col gap-3">
          <Button
            variant="outline"
            onClick={() => {
              void navigate("/approvals");
            }}
            type="button"
          >
            ← Back to inbox
          </Button>
          <span className="flex items-center gap-2 text-sm text-status-rejected">
            <span>{requestLoadError}</span>
            <Button
              onClick={() => {
                void getQuery.refetch();
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Retry
            </Button>
          </span>
        </section>
      );
    }

    return (
      <>
        {detailMutationError ? (
          <InlineAlert className="mb-3 mx-auto flex w-full max-w-5xl" tone="error">
            <span className="mr-2">{detailMutationError}</span>
            <Button
              onClick={() => {
                if (approveMutation.error) {
                  approveMutation.reset();
                  return;
                }

                if (rejectMutation.error) {
                  rejectMutation.reset();
                  return;
                }

                cancelMutation.reset();
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Retry
            </Button>
          </InlineAlert>
        ) : null}
        <ApprovalDetail
          currentUserId={currentUserId}
          decisionNote={decisionNote}
          detail={approvalDetailFromQuery(getQuery.data)}
          isApproving={approveMutation.isPending}
          isCancelling={cancelMutation.isPending}
          isRejecting={rejectMutation.isPending}
          onBack={() => {
            void navigate("/approvals");
          }}
          onApprove={() =>
            requestId
              ? approveMutation.mutate({
                  id: requestId,
                  note: decisionNote.trim().length > 0 ? decisionNote.trim() : undefined,
                })
              : null
          }
          onReject={() =>
            requestId
              ? rejectMutation.mutate({
                  id: requestId,
                  note: decisionNote.trim().length > 0 ? decisionNote.trim() : undefined,
                })
              : null
          }
          onCancel={() => {
            if (!requestId) {
              return;
            }

            const shouldCancel = window.confirm("Cancel this approval request?");
            if (!shouldCancel) {
              return;
            }

            cancelMutation.mutate({ id: requestId });
          }}
          onNoteChange={setDecisionNote}
        />
      </>
    );
  }

  const filteredTabs = APPROVAL_TABS.map((tab) => {
    if (tab.value === "pending") {
      return {
        ...tab,
        label: `Pending on me (${tabCounts.pending})`,
      };
    }
    if (tab.value === "mine") {
      return {
        ...tab,
        label: `Mine (${tabCounts.mine})`,
      };
    }
    return {
      ...tab,
      label: `All (${tabCounts.all})`,
    };
  });

  return (
    <PageFrame maxWidth="md">
      <PageHeader
        actions={
          <Button
            leftSlot={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={() => {
              setIsNewRequestOpen((current) => !current);
            }}
            type="button"
          >
            New request
          </Button>
        }
        meta={
          listQuery.isLoading
            ? "Loading requests…"
            : `${tabCounts.all} total request${tabCounts.all === 1 ? "" : "s"}`
        }
        title="Approvals inbox"
      />

      {isNewRequestOpen ? (
        <CreateRequestForm
          disabled={createMutation.isPending}
          formState={formState}
          onCancel={() => {
            setIsNewRequestOpen(false);
          }}
          onChange={setFormState}
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const error = getCreateErrorMessage(formState);
            if (error) {
              return;
            }

            createMutation.mutate(toCreateDescription(formState));
          }}
          validationError={getCreateErrorMessage(formState)}
        />
      ) : null}

      {createRequestError ? (
        <InlineAlert className="mx-4 mt-2" tone="error">
          <span className="mr-2">{createRequestError}</span>
          <Button
            onClick={() => {
              createMutation.reset();
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            Retry
          </Button>
        </InlineAlert>
      ) : null}

      <div className="rounded-md border border-border bg-surface-1">
        <div className="border-b border-border px-4 py-3">
          <Tabs
            items={filteredTabs}
            value={activeTab}
            onChange={(nextTab) => {
              setActiveTab(nextTab);
            }}
          />
        </div>

        <ApprovalList
          activeTab={activeTab}
          currentUserId={currentUserId}
          onRowClick={(row) => {
            void navigate(`/approvals/${row.id}`);
          }}
          rows={visibleRows}
        />
      </div>

      {listLoadError ? (
        <InlineAlert className="mx-4 mt-2" tone="error">
          <span className="mr-2">{listLoadError}</span>
          <Button
            onClick={() => {
              void listQuery.refetch();
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            Retry
          </Button>
        </InlineAlert>
      ) : null}

      {detailMutationError ? (
        <InlineAlert className="mx-4 mt-2" tone="error">
          <span className="mr-2">{detailMutationError}</span>
          <Button
            onClick={() => {
              if (approveMutation.error) {
                approveMutation.reset();
                return;
              }

              if (rejectMutation.error) {
                rejectMutation.reset();
                return;
              }

              cancelMutation.reset();
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            Retry
          </Button>
        </InlineAlert>
      ) : null}
    </PageFrame>
  );
}

type CreateRequestProps = {
  formState: NewRequestFormState;
  disabled: boolean;
  validationError: string | null;
  onCancel: () => void;
  onChange: (nextFormState: NewRequestFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function CreateRequestForm({
  formState,
  disabled,
  validationError,
  onCancel,
  onChange,
  onSubmit,
}: CreateRequestProps) {
  const submitDisabled = disabled || Boolean(validationError);

  return (
    <section className="rounded-md border border-border bg-surface-2 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">New approval request</h3>
        <Button variant="ghost" onClick={onCancel} type="button">
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Dismiss
        </Button>
      </div>

      <form className="grid gap-3" onSubmit={onSubmit}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Type">
            <Select
              onChange={(event) =>
                onChange({ ...formState, type: event.target.value as ApprovalType })
              }
              size="sm"
              value={formState.type}
            >
              {APPROVAL_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Title">
            <Input
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  ...formState,
                  title: event.target.value,
                })
              }
              placeholder="Contractor engagement — Lena Voss"
              value={formState.title}
            />
          </Field>
        </div>

        <Field label="Approver (optional user ID)">
          <Input
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...formState,
                approverId: event.target.value,
              })
            }
            placeholder="Defaults to the other partner"
            value={formState.approverId}
          />
        </Field>

        {formState.type === "FINANCIAL" ? (
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Amount">
              <Input
                disabled={disabled}
                onChange={(event) => {
                  onChange({
                    ...formState,
                    amount: event.target.value,
                  });
                }}
                placeholder="8750"
                value={formState.amount}
              />
            </Field>

            <Field label="Currency">
              <Input
                disabled={disabled}
                maxLength={8}
                onChange={(event) =>
                  onChange({
                    ...formState,
                    currency: event.target.value,
                  })
                }
                value={formState.currency}
              />
            </Field>

            <Field label="Period">
              <Select
                disabled={disabled}
                onChange={(event) =>
                  onChange({
                    ...formState,
                    period: event.target.value as ApprovalAmountUnit,
                  })
                }
                size="sm"
                value={formState.period}
              >
                {FINANCIAL_PERIOD_OPTIONS.map((period) => (
                  <option key={period} value={period}>
                    {period}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Vendor (optional)">
              <Input
                disabled={disabled}
                onChange={(event) =>
                  onChange({
                    ...formState,
                    vendor: event.target.value,
                  })
                }
                value={formState.vendor}
              />
            </Field>
          </div>
        ) : null}

        <Field label="Notes">
          <DenseTextarea
            disabled={disabled}
            onChange={(event) => {
              onChange({
                ...formState,
                description: event.target.value,
              });
            }}
            placeholder="Add details for approver…"
            value={formState.description}
          />
        </Field>

        {validationError ? (
          <InlineAlert tone="error">{validationError}</InlineAlert>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button
            onClick={onCancel}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>

          <Button
            disabled={submitDisabled}
            leftSlot={<PencilLine className="h-3.5 w-3.5" aria-hidden="true" />}
            type="submit"
          >
            Create
          </Button>
        </div>
      </form>
    </section>
  );
}

type ApprovalDetailProps = {
  currentUserId: string;
  detail: ApprovalDetailRow | null;
  decisionNote: string;
  isApproving: boolean;
  isCancelling: boolean;
  isRejecting: boolean;
  onBack: () => void;
  onApprove: () => void;
  onCancel: () => void;
  onReject: () => void;
  onNoteChange: (note: string) => void;
};

function ApprovalDetail({
  currentUserId,
  detail,
  decisionNote,
  isApproving,
  isCancelling,
  isRejecting,
  onBack,
  onApprove,
  onCancel,
  onReject,
  onNoteChange,
}: ApprovalDetailProps) {
  const [referenceSearchTerm, setReferenceSearchTerm] = useState("");

  const outgoingReferencesQuery = trpc.references.listOutgoing.useQuery(
    {
      from: { type: "APPROVAL", id: detail?.id ?? "" },
      limit: REFERENCE_LIST_LIMIT,
    },
    {
      enabled: detail !== null,
    },
  );
  const incomingReferencesQuery = trpc.references.listIncoming.useQuery(
    {
      to: { type: "APPROVAL", id: detail?.id ?? "" },
      limit: REFERENCE_LIST_LIMIT,
    },
    {
      enabled: detail !== null,
    },
  );
  const referenceSearchQuery = trpc.references.searchTargets.useQuery(
    {
      term: referenceSearchTerm,
      limit: REFERENCE_SEARCH_LIMIT,
    },
    {
      enabled: detail !== null && referenceSearchTerm.trim().length >= REFERENCE_SEARCH_MIN_LENGTH,
    },
  );
  const createReferenceMutation = trpc.references.create.useMutation();

  const outgoingReferences = useMemo(
    () => outgoingReferencesQuery.data?.items ?? [],
    [outgoingReferencesQuery.data?.items],
  );
  const incomingReferences = useMemo(
    () => incomingReferencesQuery.data?.items ?? [],
    [incomingReferencesQuery.data?.items],
  );
  const searchResults = useMemo(
    () => referenceSearchQuery.data?.items ?? [],
    [referenceSearchQuery.data?.items],
  );

  const isReferenceAlreadyLinked = (target: Pick<ReferenceTargetItem, "id" | "type">) => {
    return outgoingReferences.some((item) => item.id === target.id && item.type === target.type);
  };

  const handleAttachReference = async (target: Pick<ReferenceTargetItem, "id" | "type">) => {
    if (!detail) {
      return;
    }

    await createReferenceMutation.mutateAsync({
      from: { type: "APPROVAL", id: detail.id },
      to: { id: target.id, type: target.type },
    });

    await Promise.all([
      outgoingReferencesQuery.refetch(),
      incomingReferencesQuery.refetch(),
    ]);
  };

  if (!detail) {
    return (
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onBack} type="button">
            <span className="text-sm">← Back to inbox</span>
          </Button>
          <h2 className="text-xl font-semibold">Approval not found</h2>
        </div>
        <p className="text-sm text-text-secondary">The selected request could not be loaded.</p>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={onBack} type="button">
          ← Back to inbox
        </Button>
        <h2 className="text-2xl font-semibold">Approval detail</h2>
      </div>

      <ApprovalDetailPanel
        currentUserId={currentUserId}
        decisionNote={decisionNote}
        detail={detail}
        incomingReferences={incomingReferences}
        isApproving={isApproving}
        isCancelling={isCancelling}
        isLinkingReference={createReferenceMutation.isPending}
        isReferenceAlreadyLinked={isReferenceAlreadyLinked}
        isRejecting={isRejecting}
        isSearchingReferences={referenceSearchQuery.isLoading}
        onApprove={onApprove}
        onCancel={onCancel}
        onAttachReference={handleAttachReference}
        onNoteChange={onNoteChange}
        onReferenceSearchTermChange={setReferenceSearchTerm}
        onReject={onReject}
        referenceErrorMessage={createReferenceMutation.error?.message}
        referenceSearchResults={searchResults}
        referenceSearchTerm={referenceSearchTerm}
        rightAction={
          <Link
            className="rounded border border-border bg-surface-1 px-2.5 py-1.5 text-sm hover:bg-surface-3"
            to="/approvals"
          >
            View all
          </Link>
        }
      />
    </section>
  );
}
