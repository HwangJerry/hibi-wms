import {
  ArrowDownUp,
  Check,
  Edit,
  Loader2,
  Plus,
  RotateCcw,
} from "lucide-react";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/providers/trpc-provider";

const TASK_STATUSES = ["BACKLOG", "TODO", "IN_PROGRESS", "DONE"] as const;
const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const LIST_LIMIT = 100;

type TaskStatus = (typeof TASK_STATUSES)[number];
type TaskPriority = (typeof TASK_PRIORITIES)[number];
type AssigneeFilter = "all" | "unassigned" | "me" | "custom";
type SortKey = "order" | "title" | "status" | "priority" | "assignee" | "updatedAt";
type SortDirection = "asc" | "desc";

type BacklogTask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  parentId: string | null;
  order: number;
  createdAt: Date | string;
  updatedAt: Date | string;
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
};

type BacklogPageProps = {
  currentUserId: string;
  searchTerm?: string;
};

const statusLabels: Record<TaskStatus, string> = {
  BACKLOG: "Backlog",
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

const priorityLabels: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

const priorityRank: Record<TaskPriority, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
};

export function BacklogPage({
  currentUserId,
  searchTerm = "",
}: BacklogPageProps) {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("all");
  const [customAssigneeId, setCustomAssigneeId] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("order");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [dialogMode, setDialogMode] = useState<TaskDialogMode | null>(null);

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
      await utils.backlog.list.invalidate();
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

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

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

  const mutationError =
    createMutation.error?.message ??
    updateMutation.error?.message ??
    setStatusMutation.error?.message;

  const isDialogSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <section className="mx-auto flex max-w-7xl flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal">Backlog</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {tasks.length} task{tasks.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button type="button" onClick={() => setDialogMode({ type: "create" })}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          New task
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/20 p-3">
        <label className="grid gap-1 text-sm font-medium">
          <span>Status</span>
          <select
            className={controlClassName}
            onChange={(event) =>
              setStatusFilter(event.target.value as TaskStatus | "all")
            }
            value={statusFilter}
          >
            <option value="all">All statuses</option>
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm font-medium">
          <span>Assignee</span>
          <select
            className={controlClassName}
            onChange={(event) =>
              setAssigneeFilter(event.target.value as AssigneeFilter)
            }
            value={assigneeFilter}
          >
            <option value="all">All assignees</option>
            <option value="unassigned">Unassigned</option>
            <option value="me">Me</option>
            <option value="custom">Custom ID</option>
          </select>
        </label>

        {assigneeFilter === "custom" ? (
          <label className="grid min-w-64 flex-1 gap-1 text-sm font-medium">
            <span>Assignee ID</span>
            <input
              className={controlClassName}
              onChange={(event) => setCustomAssigneeId(event.target.value)}
              placeholder="User ID"
              value={customAssigneeId}
            />
          </label>
        ) : null}

        <label className="grid gap-1 text-sm font-medium">
          <span>Sort</span>
          <select
            className={controlClassName}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            value={sortKey}
          >
            <option value="order">Rank</option>
            <option value="title">Title</option>
            <option value="status">Status</option>
            <option value="priority">Priority</option>
            <option value="assignee">Assignee</option>
            <option value="updatedAt">Updated</option>
          </select>
        </label>

        <Button
          aria-label="Toggle sort direction"
          type="button"
          variant="outline"
          onClick={() =>
            setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
          }
        >
          <ArrowDownUp className="h-4 w-4" aria-hidden="true" />
          {sortDirection === "asc" ? "Asc" : "Desc"}
        </Button>

        <Button
          aria-label="Reset filters"
          type="button"
          variant="ghost"
          onClick={() => {
            setStatusFilter("all");
            setAssigneeFilter("all");
            setCustomAssigneeId("");
            setSortKey("order");
            setSortDirection("asc");
          }}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Reset
        </Button>
      </div>

      {mutationError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {mutationError}
        </p>
      ) : null}

      <TaskList
        hasMoreTasks={tasksQuery.hasNextPage}
        isFetchingMore={tasksQuery.isFetchingNextPage}
        isLoading={tasksQuery.isLoading}
        onLoadMore={() => void tasksQuery.fetchNextPage()}
        onEditTask={(task) => setDialogMode({ type: "edit", task })}
        onStatusChange={(id, status) => setStatusMutation.mutate({ id, status })}
        pendingStatusTaskId={
          setStatusMutation.isPending ? setStatusMutation.variables?.id : undefined
        }
        tasks={tasks}
      />

      {dialogMode ? (
        <TaskDialog
          currentUserId={currentUserId}
          isSaving={isDialogSaving}
          mode={dialogMode}
          onClose={() => setDialogMode(null)}
          onSubmit={(formState) => {
            if (dialogMode.type === "create") {
              createMutation.mutate(
                taskFormToCreateInput(formState),
                {
                  onSuccess: (task) => {
                    if (task.status !== formState.status) {
                      setStatusMutation.mutate({
                        id: task.id,
                        status: formState.status,
                      });
                    }
                    setDialogMode(null);
                  },
                },
              );
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
    </section>
  );
}

function TaskList({
  hasMoreTasks,
  isFetchingMore,
  isLoading,
  onLoadMore,
  onEditTask,
  onStatusChange,
  pendingStatusTaskId,
  tasks,
}: {
  hasMoreTasks: boolean;
  isFetchingMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  onEditTask: (task: BacklogTask) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  pendingStatusTaskId: string | undefined;
  tasks: BacklogTask[];
}) {
  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md border text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        Loading tasks
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md border text-sm text-muted-foreground">
        No tasks match these filters.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[minmax(220px,1fr)_150px_130px_160px_150px_56px] border-b bg-muted/40 px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
            <span>Task</span>
            <span>Status</span>
            <span>Priority</span>
            <span>Assignee</span>
            <span>Updated</span>
            <span className="text-right">Edit</span>
          </div>
          <ul className="divide-y">
            {tasks.map((task) => {
              const isStatusPending = pendingStatusTaskId === task.id;

              return (
                <li
                  className="grid grid-cols-[minmax(220px,1fr)_150px_130px_160px_150px_56px] items-center gap-3 px-4 py-3"
                  key={task.id}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    {task.description ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {task.description}
                      </p>
                    ) : null}
                  </div>

                  <label className="relative">
                    <span className="sr-only">Task status</span>
                    <select
                      className={cn(controlClassName, "w-full pr-8")}
                      disabled={isStatusPending}
                      onChange={(event) =>
                        onStatusChange(task.id, event.target.value as TaskStatus)
                      }
                      value={task.status}
                    >
                      {TASK_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {statusLabels[status]}
                        </option>
                      ))}
                    </select>
                    {isStatusPending ? (
                      <Loader2
                        className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground"
                        aria-hidden="true"
                      />
                    ) : null}
                  </label>

                  <span className={priorityBadgeClassName(task.priority)}>
                    {priorityLabels[task.priority]}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">
                    {task.assigneeId ?? "Unassigned"}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(task.updatedAt)}
                  </span>
                  <div className="flex justify-end">
                    <Button
                      aria-label={`Edit ${task.title}`}
                      onClick={() => onEditTask(task)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Edit className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      {hasMoreTasks ? (
        <div className="flex justify-center border-t bg-muted/20 px-4 py-3">
          <Button
            disabled={isFetchingMore}
            onClick={onLoadMore}
            type="button"
            variant="outline"
          >
            {isFetchingMore ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function TaskDialog({
  currentUserId,
  isSaving,
  mode,
  onClose,
  onSubmit,
}: {
  currentUserId: string;
  isSaving: boolean;
  mode: TaskDialogMode;
  onClose: () => void;
  onSubmit: (formState: TaskFormState) => void;
}) {
  const [formState, setFormState] = useState<TaskFormState>(() =>
    getInitialFormState(mode),
  );

  const title = mode.type === "create" ? "New task" : "Edit task";
  const canSubmit = formState.title.trim().length > 0 && !isSaving;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    onSubmit(formState);
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 px-4 py-6"
      role="dialog"
    >
      <form
        className="w-full max-w-2xl rounded-md border bg-background p-5 shadow-lg"
        onSubmit={handleSubmit}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold tracking-normal">{title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              ID fields are accepted directly until user lookup is available.
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="grid gap-4">
          <label className="grid gap-1 text-sm font-medium">
            <span>Title</span>
            <input
              autoFocus
              className={controlClassName}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              value={formState.title}
            />
          </label>

          <label className="grid gap-1 text-sm font-medium">
            <span>Description</span>
            <textarea
              className={cn(controlClassName, "min-h-28 py-2")}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              value={formState.description}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-1 text-sm font-medium">
              <span>Status</span>
              <select
                className={controlClassName}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    status: event.target.value as TaskStatus,
                  }))
                }
                value={formState.status}
              >
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm font-medium">
              <span>Priority</span>
              <select
                className={controlClassName}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    priority: event.target.value as TaskPriority,
                  }))
                }
                value={formState.priority}
              >
                {TASK_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priorityLabels[priority]}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm font-medium">
              <span>Assignee ID</span>
              <div className="flex gap-2">
                <input
                  className={controlClassName}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      assigneeId: event.target.value,
                    }))
                  }
                  placeholder="Unassigned"
                  value={formState.assigneeId}
                />
                <Button
                  aria-label="Assign to me"
                  onClick={() =>
                    setFormState((current) => ({
                      ...current,
                      assigneeId: currentUserId,
                    }))
                  }
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </label>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canSubmit} type="submit">
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            Save
          </Button>
        </div>
      </form>
    </div>
  );
}

const controlClassName =
  "h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

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
    };
  }

  return {
    title: mode.task.title,
    description: mode.task.description ?? "",
    status: mode.task.status,
    priority: mode.task.priority,
    assigneeId: mode.task.assigneeId ?? "",
  };
}

function taskFormToCreateInput(formState: TaskFormState) {
  return {
    title: formState.title.trim(),
    description: nullableTrimmedValue(formState.description),
    priority: formState.priority,
    assigneeId: nullableTrimmedValue(formState.assigneeId),
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
    },
  };
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
      return statusLabels[left.status].localeCompare(statusLabels[right.status]);
    case "priority":
      return priorityRank[left.priority] - priorityRank[right.priority];
    case "assignee":
      return (left.assigneeId ?? "").localeCompare(right.assigneeId ?? "");
    case "updatedAt":
      return toTime(left.updatedAt) - toTime(right.updatedAt);
    case "order":
      return left.order - right.order;
  }
}

function toTime(value: Date | string) {
  return new Date(value).getTime();
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function priorityBadgeClassName(priority: TaskPriority) {
  return cn(
    "w-fit rounded-md border px-2 py-1 text-xs font-medium",
    priority === "LOW" && "border-slate-200 bg-slate-50 text-slate-700",
    priority === "MEDIUM" && "border-blue-200 bg-blue-50 text-blue-700",
    priority === "HIGH" && "border-amber-200 bg-amber-50 text-amber-800",
    priority === "URGENT" && "border-red-200 bg-red-50 text-red-700",
  );
}
