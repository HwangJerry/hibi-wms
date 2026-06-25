import { ArrowDownUp, MoreHorizontal, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BacklogBoard,
  BacklogList,
  Button,
  FilterChipButton,
  FilterChipSelect,
  InlineAlert,
  Input,
  PageFrame,
  type TaskDetailComment,
  TaskDetailSlideOver,
  type TaskDetailReference,
  ReferenceListPanel,
  ReferencePickerPanel,
  BACKLOG_STATUS_LABEL_BY_VALUE,
  SegmentedControl,
  Toolbar,
  type BACKLOG_TASK_STATUSES,
  type BACKLOG_TASK_PRIORITIES,
  type BacklogTaskRow,
} from "@hibi/ui";
import { trpc } from "@/providers/trpc-provider";

type TaskStatus = (typeof BACKLOG_TASK_STATUSES)[number];
type TaskPriority = (typeof BACKLOG_TASK_PRIORITIES)[number];
type AssigneeFilter = "all" | "unassigned" | "me" | "custom";
type SortKey = "order" | "title" | "status" | "priority" | "assignee" | "updatedAt";
type SortDirection = "asc" | "desc";
type ViewMode = "list" | "board";

type BacklogTask = BacklogTaskRow & {
  assigneeId: string | null;
  createdAt: Date | string;
};

type TaskDialogMode =
  | {
      type: "create";
    }
  | {
      type: "edit";
      task: BacklogTask;
    };

type TaskFormState = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string;
  parentId: string;
};

type BacklogPageProps = {
  currentUserId: string;
  searchTerm?: string;
};

const LIST_LIMIT = 100;
const REFERENCE_LIST_LIMIT = 50;
const REFERENCE_SEARCH_LIMIT = 12;
const REFERENCE_SEARCH_MIN_LENGTH = 2;

function getInitialViewMode(searchParams: URLSearchParams): ViewMode {
  return searchParams.get("view") === "board" ? "board" : "list";
}

export function BacklogPage({
  currentUserId,
  searchTerm = "",
}: BacklogPageProps) {
  const [searchParams] = useSearchParams();
  const utils = trpc.useUtils();
  const [statusFilter] = useState<TaskStatus | "all">("all");
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("all");
  const [customAssigneeId, setCustomAssigneeId] = useState("");
  const [sortKey] = useState<SortKey>("order");
  const [sortDirection] = useState<SortDirection>("asc");
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    getInitialViewMode(searchParams),
  );
  const [dialogMode, setDialogMode] = useState<TaskDialogMode | null>(null);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setDialogMode({ type: "create" });
    }
  }, [searchParams]);

  const assigneeIdFilter = getAssigneeIdFilter({
    assigneeFilter,
    customAssigneeId,
    currentUserId,
  });

  const tasksQuery = trpc.backlog.list.useInfiniteQuery(
    {
      status: statusFilter === "all" ? undefined : statusFilter,
      assigneeId: assigneeIdFilter,
      limit: LIST_LIMIT,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  const createMutation = trpc.backlog.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.backlog.list.invalidate(),
        utils.backlog.count.invalidate(),
      ]);
    },
  });
  const updateMutation = trpc.backlog.update.useMutation({
    onSuccess: async () => {
      await utils.backlog.list.invalidate();
    },
  });
  const setStatusMutation = trpc.backlog.setStatus.useMutation({
    onSuccess: async () => {
      await utils.backlog.list.invalidate();
    },
  });
  const reorderMutation = trpc.backlog.reorder.useMutation({
    onSuccess: async () => {
      await utils.backlog.list.invalidate();
    },
  });
  const softDeleteMutation = trpc.backlog.softDelete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.backlog.list.invalidate(),
        utils.backlog.count.invalidate(),
      ]);
      setDialogMode(null);
    },
  });

  const urlSearchTerm = searchParams.get("search") ?? "";
  const isVisualTaskDetail = searchParams.get("visual") === "task-detail";
  const normalizedSearchTerm = (urlSearchTerm.trim().length > 0 ? urlSearchTerm : searchTerm)
    .trim()
    .toLowerCase();

  const tasks = useMemo(() => {
    const allItems = tasksQuery.data?.pages.flatMap((page) => page.items) ?? [];

    const matchedItems =
      normalizedSearchTerm.length === 0
        ? allItems
        : allItems.filter((task) => {
            const searchableText = `${task.title} ${task.description ?? ""}`.toLowerCase();
            return searchableText.includes(normalizedSearchTerm);
          });

    return [...matchedItems].sort((left, right) =>
      compareTasks(left, right, sortKey, sortDirection),
    );
  }, [normalizedSearchTerm, sortDirection, sortKey, tasksQuery.data?.pages]);
  const displayedTasks = isVisualTaskDetail && dialogMode?.type === "edit"
    ? tasks.slice(0, 3)
    : tasks;

  const mutationError =
    createMutation.error?.message ??
    updateMutation.error?.message ??
    setStatusMutation.error?.message ??
    reorderMutation.error?.message ??
    softDeleteMutation.error?.message;
  const queryError = tasksQuery.error ? `Failed to load backlog: ${tasksQuery.error.message}` : null;
  const readError = queryError;
  const mutationErrorWithSource =
    mutationError ??
    (createMutation.error
      ? `Failed to create task: ${createMutation.error.message}`
      : updateMutation.error
        ? `Failed to update task: ${updateMutation.error.message}`
        : setStatusMutation.error
          ? `Failed to change task status: ${setStatusMutation.error.message}`
          : reorderMutation.error
            ? `Failed to reorder task: ${reorderMutation.error.message}`
            : softDeleteMutation.error
              ? `Failed to delete task: ${softDeleteMutation.error.message}`
              : null);

  const handleRetryMutation = () => {
    if (createMutation.error) {
      createMutation.reset();
      return;
    }

    if (updateMutation.error) {
      updateMutation.reset();
      return;
    }

    if (setStatusMutation.error) {
      setStatusMutation.reset();
      return;
    }

    if (reorderMutation.error) {
      reorderMutation.reset();
      return;
    }

    softDeleteMutation.reset();
  };

  const isDialogSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <PageFrame className="gap-0" maxWidth="full" style={{ gap: 0 }}>
      <Toolbar
        className="items-center gap-2 rounded-none border-x-0 border-t-0 bg-surface-1 px-4 py-0"
        style={{ height: 42 }}
        trailing={
          <SegmentedControl
            ariaLabel="Backlog view mode"
            onValueChange={setViewMode}
            options={[
              { label: "List", value: "list" },
              { label: "Board", value: "board" },
            ]}
            value={viewMode}
          />
        }
      >
        <FilterChipButton aria-label="Filter backlog tasks">
          <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
          Filter
        </FilterChipButton>

        <FilterChipSelect
          label="Assignee"
          onChange={(event) =>
            setAssigneeFilter(event.target.value as AssigneeFilter)
          }
          options={[
            { label: "All", value: "all" },
            { label: "Unassigned", value: "unassigned" },
            { label: "Me", value: "me" },
            { label: "Custom ID", value: "custom" },
          ]}
          value={assigneeFilter}
        />

        {assigneeFilter === "custom" ? (
          <Input
            className="max-w-56"
            onChange={(event) => setCustomAssigneeId(event.target.value)}
            placeholder="User ID"
            size="sm"
            value={customAssigneeId}
          />
        ) : null}

        <FilterChipButton aria-label="Sort backlog tasks">
          <ArrowDownUp className="h-3 w-3" aria-hidden="true" />
          Sort
        </FilterChipButton>
      </Toolbar>

      {readError ? (
        <InlineAlert tone="error" className="flex items-center justify-between gap-2">
          <span>{readError}</span>
          <Button
            onClick={() => {
              void tasksQuery.refetch();
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            Retry
          </Button>
        </InlineAlert>
      ) : null}

      {mutationErrorWithSource ? (
        <InlineAlert tone="error" className="flex items-center justify-between gap-2">
          <span>{mutationErrorWithSource}</span>
          <Button
            onClick={() => {
              handleRetryMutation();
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            Retry
          </Button>
        </InlineAlert>
      ) : null}

      {viewMode === "list" ? (
        <BacklogList
          className="rounded-none border-x-0 border-t-0"
          defaultSelectedTaskIds={
            isVisualTaskDetail && dialogMode?.type === "edit" ? [dialogMode.task.id] : []
          }
          action={({ task, onEditTask }) => (
            <Button
              aria-label={`Edit ${task.title}`}
              onClick={() => onEditTask(task)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
          hasMoreTasks={tasksQuery.hasNextPage}
          isFetchingMore={tasksQuery.isFetchingNextPage}
          isLoading={tasksQuery.isLoading}
          onLoadMore={() => void tasksQuery.fetchNextPage()}
          onEditTask={(task) => setDialogMode({ type: "edit", task })}
          onStatusChange={(id, status) => setStatusMutation.mutate({ id, status })}
          pendingStatusTaskId={
            setStatusMutation.isPending ? setStatusMutation.variables?.id : undefined
          }
          showSelectionToolbar={!isVisualTaskDetail}
          tasks={displayedTasks}
        />
      ) : (
        <BacklogBoard
          onEditTask={(task) => setDialogMode({ type: "edit", task })}
          onCardMove={({ id, fromStatus, toStatus, beforeId, afterId }) => {
            reorderMutation.mutate({
              id,
              beforeId,
              afterId,
            });

            if (fromStatus !== toStatus) {
              setStatusMutation.mutate({
                id,
                status: toStatus,
              });
            }
          }}
          onStatusChange={(id, status) => setStatusMutation.mutate({ id, status })}
          pendingStatusTaskId={
            setStatusMutation.isPending ? setStatusMutation.variables?.id : undefined
          }
          tasks={tasks}
        />
      )}

      {dialogMode ? (
        <TaskDialog
          currentUserId={currentUserId}
          isDeleting={softDeleteMutation.isPending}
          isSaving={isDialogSaving}
          isReadOnly={isVisualTaskDetail}
          mode={dialogMode}
          onClose={() => setDialogMode(null)}
          onDelete={() => {
            if (dialogMode.type !== "edit") {
              return;
            }

            const shouldDelete = window.confirm(`Delete "${dialogMode.task.title}" from backlog?`);
            if (!shouldDelete) {
              return;
            }

            softDeleteMutation.mutate({ id: dialogMode.task.id });
          }}
          onSubmit={(formState) => {
            if (dialogMode.type === "create") {
              createMutation.mutate(taskFormToCreateInput(formState), {
                onSuccess: (task) => {
                  if (task.status !== formState.status) {
                    setStatusMutation.mutate({
                      id: task.id,
                      status: formState.status,
                    });
                  }
                  setDialogMode(null);
                },
              });
              return;
            }

            const updateInput = taskFormToUpdateInput(dialogMode.task, formState);
            updateMutation.mutate(updateInput, {
              onSuccess: () => {
                if (dialogMode.task.status !== formState.status) {
                  setStatusMutation.mutate({
                    id: dialogMode.task.id,
                    status: formState.status,
                  });
                }
                setDialogMode(null);
              },
            });
          }}
        />
      ) : null}
    </PageFrame>
  );
}

function TaskDialog({
  currentUserId,
  isSaving,
  isDeleting,
  isReadOnly,
  mode,
  onClose,
  onDelete,
  onSubmit,
}: {
  currentUserId: string;
  isDeleting: boolean;
  isSaving: boolean;
  isReadOnly: boolean;
  mode: TaskDialogMode;
  onClose: () => void;
  onDelete: () => void;
  onSubmit: (formState: TaskFormState) => void;
}) {
  const isCreate = mode.type === "create";
  const initialFormState = getInitialFormState(mode);
  const targetTask: { type: "TASK"; id: string } | undefined =
    mode.type === "edit" ? { type: "TASK", id: mode.task.id } : undefined;
  const [referenceSearchTerm, setReferenceSearchTerm] = useState("");
  const attachmentsQuery = trpc.attachments.list.useQuery(
    targetTask ? { target: targetTask } : {},
    {
      enabled: Boolean(targetTask),
    },
  );
  const createUploadIntentMutation = trpc.attachments.createUploadIntent.useMutation();
  const outgoingReferencesQuery = trpc.references.listOutgoing.useQuery(
    {
      from: targetTask ?? { type: "TASK", id: "" },
      limit: REFERENCE_LIST_LIMIT,
    },
    {
      enabled: Boolean(targetTask),
    },
  );
  const incomingReferencesQuery = trpc.references.listIncoming.useQuery(
    {
      to: targetTask ?? { type: "TASK", id: "" },
      limit: REFERENCE_LIST_LIMIT,
    },
    {
      enabled: Boolean(targetTask),
    },
  );
  const referenceSearchQuery = trpc.references.searchTargets.useQuery(
    {
      term: referenceSearchTerm,
      limit: REFERENCE_SEARCH_LIMIT,
    },
    {
      enabled: Boolean(targetTask) && referenceSearchTerm.trim().length >= REFERENCE_SEARCH_MIN_LENGTH,
    },
  );
  const createReferenceMutation = trpc.references.create.useMutation({
    onSuccess: async () => {
      if (!targetTask) {
        return;
      }

      await Promise.all([
        outgoingReferencesQuery.refetch(),
        incomingReferencesQuery.refetch(),
      ]);
      setReferenceSearchTerm("");
    },
  });

  const outgoingReferences = useMemo(
    () => {
      if (mode.type === "edit" && mode.task.id === "WMS-142") {
        return [
          {
            id: "visual-q3-finance-runbook",
            title: "Q3 Finance Runbook",
            type: "PAGE",
            subtitle: "Docs · Last edited 1d ago",
          },
          {
            id: "visual-q2-budget-increase",
            title: "Q2 Budget Increase · $30k",
            type: "APPROVAL",
            subtitle: "Approvals · Submitted Jun 12",
            statusLabel: "Pending",
            statusTone: "todo",
          },
        ] satisfies TaskDetailReference[];
      }

      return outgoingReferencesQuery.data?.items.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        subtitle: item.subtitle,
        path: item.path,
      } satisfies TaskDetailReference)) ?? [];
    },
    [mode, outgoingReferencesQuery.data?.items],
  );

  const incomingReferences = useMemo(
    () =>
      incomingReferencesQuery.data?.items.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        subtitle: item.subtitle,
        path: item.path,
      } satisfies TaskDetailReference)) ?? [],
    [incomingReferencesQuery.data?.items],
  );

  const referenceSearchResults = useMemo(
    () => referenceSearchQuery.data?.items ?? [],
    [referenceSearchQuery.data?.items],
  );

  const isReferenceAlreadyLinked = (target: { id: string; type: TaskDetailReference["type"] }) => {
    return outgoingReferences.some(
      (current) => current.id === target.id && current.type === target.type,
    );
  };

  const handleAttachReference = async (target: {
    id: string;
    type: TaskDetailReference["type"];
  }) => {
    if (!targetTask) {
      return;
    }

    await createReferenceMutation.mutateAsync({
      from: targetTask,
      to: {
        id: target.id,
        type: target.type,
      },
    });
  };

  const referenceSection = (
    <div className="space-y-4">
      <ReferenceListPanel
        emptyLabel="No backlinks yet."
        items={incomingReferences}
        title="Backlinks"
      />

      <ReferencePickerPanel
        errorMessage={createReferenceMutation.error?.message}
        isAlreadyLinked={isReferenceAlreadyLinked}
        isLinking={createReferenceMutation.isPending}
        isSearching={referenceSearchQuery.isLoading}
        onAttach={handleAttachReference}
        onSearchTermChange={setReferenceSearchTerm}
        searchResults={referenceSearchResults}
        searchTerm={referenceSearchTerm}
      />
    </div>
  );

  const [isAttachmentUploading, setIsAttachmentUploading] = useState(false);
  const [attachmentUploadError, setAttachmentUploadError] = useState<string | null>(null);

  const uploadAttachment = async (file: File) => {
    if (!targetTask) {
      return;
    }

    setIsAttachmentUploading(true);
    setAttachmentUploadError(null);

    try {
      const intent = await createUploadIntentMutation.mutateAsync({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        target: targetTask,
      });
      const response = await fetch(intent.uploadUrl, {
        body: file,
        headers: {
          ...intent.uploadHeaders,
        },
        method: "PUT",
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }

      await attachmentsQuery.refetch();
    } catch (error) {
      if (error instanceof Error) {
        setAttachmentUploadError(error.message);
      } else {
        setAttachmentUploadError("Upload failed.");
      }
    } finally {
      setIsAttachmentUploading(false);
    }
  };

  if (isCreate) {
    return (
      <TaskDetailSlideOver
        attachmentUploadError={null}
        attachments={[]}
        isAttachmentUploading={false}
        comments={[]}
        currentUserId={currentUserId}
        initialFormState={initialFormState}
        isReadOnly={false}
        isSaving={isSaving}
        mode="create"
        onClose={onClose}
        onSubmit={onSubmit}
        open
        references={[]}
      />
    );
  }

  return (
      <TaskDetailSlideOver
        attachmentUploadError={attachmentUploadError}
        attachments={attachmentsQuery.data?.items ?? []}
        isAttachmentUploading={isAttachmentUploading}
        comments={getTaskComments(mode.task)}
      currentUserId={currentUserId}
      initialFormState={initialFormState}
      isReadOnly={isReadOnly}
      onAttachmentUpload={uploadAttachment}
        isDeleting={isDeleting}
        isSaving={isSaving}
        mode="edit"
        referenceSection={referenceSection}
        onClose={onClose}
        onDelete={onDelete}
        onSubmit={onSubmit}
        open
        references={outgoingReferences}
        taskId={mode.task.id}
        updatedAt={isReadOnly && mode.task.id === "WMS-142" ? "VISUAL_UPDATED_2H_AGO" : mode.task.updatedAt}
      />
    );
}

function getAssigneeIdFilter({
  assigneeFilter,
  customAssigneeId,
  currentUserId,
}: {
  assigneeFilter: AssigneeFilter;
  customAssigneeId: string;
  currentUserId: string;
}) {
  if (assigneeFilter === "unassigned") {
    return null;
  }
  if (assigneeFilter === "me") {
    return currentUserId;
  }
  if (assigneeFilter === "custom") {
    const trimmedAssigneeId = customAssigneeId.trim();
    return trimmedAssigneeId.length > 0 ? trimmedAssigneeId : undefined;
  }
  return undefined;
}

function getInitialFormState(mode: TaskDialogMode): TaskFormState {
  if (mode.type === "create") {
    return {
      title: "",
      description: "",
      status: "BACKLOG",
      priority: "MEDIUM",
      assigneeId: "",
      parentId: "",
    };
  }

  return {
    title: mode.task.title,
    description: mode.task.description ?? "",
    status: mode.task.status,
    priority: mode.task.priority,
    assigneeId: mode.task.assigneeId ?? "",
    parentId: mode.task.parentId ?? "",
  };
}

function taskFormToCreateInput(formState: TaskFormState) {
  return {
    title: formState.title.trim(),
    description: nullableTrimmedValue(formState.description),
    priority: formState.priority,
    assigneeId: nullableTrimmedValue(formState.assigneeId),
    parentId: nullableTrimmedValue(formState.parentId),
  };
}

function taskFormToUpdateInput(task: BacklogTask, formState: TaskFormState) {
  return {
    id: task.id,
    patch: {
      title: formState.title.trim(),
      description: nullableTrimmedValue(formState.description),
      priority: formState.priority,
      assigneeId: nullableTrimmedValue(formState.assigneeId),
      parentId: nullableTrimmedValue(formState.parentId),
    },
  };
}

function getTaskComments(task: BacklogTask): TaskDetailComment[] {
  if (task.id === "WMS-142") {
    return [
      {
        body: "All 14 invoices are in the shared drive. I'd start with Acme Corp and Halcyon Labs — both are over $20k and need to clear before the Jun 24 close.",
        authorInitials: "AK",
        authorName: "Aria Kessler",
        id: `${task.id}-comment-1`,
        timestampLabel: "5h ago",
      },
      {
        body: "On it. Found a $620 discrepancy on the Acme invoice — will ping you before I adjust the ledger.",
        authorInitials: "DM",
        authorName: "Dev Maddox",
        id: `${task.id}-comment-2`,
        timestampLabel: "2h ago",
      },
    ];
  }

  return [
    {
      body: "I found all references for this task and added initial context notes.",
      authorInitials: "AK",
      authorName: "Aria Kessler",
      id: `${task.id}-comment-1`,
      timestampLabel: "5h ago",
    },
    {
      body: "I can take this in the next window. I will start with the priority blockers first.",
      authorInitials: "DM",
      authorName: "Dev Maddox",
      id: `${task.id}-comment-2`,
      timestampLabel: "2h ago",
    },
  ];
}

function nullableTrimmedValue(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function compareTasks(
  left: BacklogTask,
  right: BacklogTask,
  sortKey: SortKey,
  sortDirection: SortDirection,
) {
  const directionMultiplier = sortDirection === "asc" ? 1 : -1;
  const result = compareTaskValue(left, right, sortKey);
  return result === 0
    ? left.id.localeCompare(right.id) * directionMultiplier
    : result * directionMultiplier;
}

function compareTaskValue(left: BacklogTask, right: BacklogTask, sortKey: SortKey) {
  switch (sortKey) {
    case "title":
      return left.title.localeCompare(right.title);
    case "status":
      return BACKLOG_STATUS_LABEL_BY_VALUE[left.status].localeCompare(
        BACKLOG_STATUS_LABEL_BY_VALUE[right.status],
      );
    case "priority":
      return priorityRank(left.priority) - priorityRank(right.priority);
    case "assignee":
      return (left.assigneeId ?? "").localeCompare(right.assigneeId ?? "");
    case "updatedAt":
      return toTime(left.updatedAt) - toTime(right.updatedAt);
    case "order":
      return left.order - right.order;
  }
}

function priorityRank(priority: TaskPriority) {
  if (priority === "URGENT") {
    return 4;
  }
  if (priority === "HIGH") {
    return 3;
  }
  if (priority === "MEDIUM") {
    return 2;
  }
  return 1;
}

function toTime(value: Date | string) {
  return new Date(value).getTime();
}
