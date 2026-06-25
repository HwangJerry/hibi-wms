import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from "react";
import { Avatar } from "../primitives/avatar";
import { Button } from "../primitives/button";
import { StatusPill } from "./status-pill";
import {
  BACKLOG_PRIORITY_DOT_CLASS,
  BACKLOG_PRIORITY_LABEL_BY_VALUE,
  BACKLOG_STATUS_LABEL_BY_VALUE,
  BACKLOG_STATUS_TONE_BY_VALUE,
  BACKLOG_TASK_STATUSES,
  type BacklogTaskRow,
  type BacklogTaskStatus,
} from "./backlog-task-types";
import { cx } from "../primitives/classnames";

const LOADING_SPINNER_CLASSNAME =
  "inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-text-secondary border-t-transparent";
const BACKLOG_LIST_STATUS_OPTIONS = BACKLOG_TASK_STATUSES;

export const BACKLOG_LIST_SELECTION_COLUMN_WIDTH = 26;
export const BACKLOG_LIST_TASK_COLUMN_MIN_WIDTH = 220;
export const BACKLOG_LIST_STATUS_COLUMN_WIDTH = 128;
export const BACKLOG_LIST_PRIORITY_COLUMN_WIDTH = 104;
export const BACKLOG_LIST_ASSIGNEE_COLUMN_WIDTH = 80;
export const BACKLOG_LIST_UPDATED_COLUMN_WIDTH = 64;
export const BACKLOG_LIST_ACTION_COLUMN_WIDTH = 28;
export const BACKLOG_LIST_HEADER_HEIGHT = 30;
export const BACKLOG_LIST_ROW_HEIGHT = 34;
export const BACKLOG_LIST_CHECKBOX_SIZE = 15;
export const BACKLOG_LIST_SELECTION_INDICATOR_WIDTH = 2;
const BACKLOG_LIST_TASK_ID_FONT_SIZE = 11;
const BACKLOG_LIST_TASK_TITLE_FONT_SIZE = 13;
const BACKLOG_LIST_PILL_FONT_SIZE = 12;
const BACKLOG_LIST_HEADER_FONT_SIZE = 11;
const BACKLOG_LIST_CHECK_MARK_FONT_SIZE = 10;

export const BACKLOG_LIST_GRID_COLUMNS = [
  `${BACKLOG_LIST_SELECTION_COLUMN_WIDTH}px`,
  `minmax(${BACKLOG_LIST_TASK_COLUMN_MIN_WIDTH}px,1fr)`,
  `${BACKLOG_LIST_STATUS_COLUMN_WIDTH}px`,
  `${BACKLOG_LIST_PRIORITY_COLUMN_WIDTH}px`,
  `${BACKLOG_LIST_ASSIGNEE_COLUMN_WIDTH}px`,
  `${BACKLOG_LIST_UPDATED_COLUMN_WIDTH}px`,
  `${BACKLOG_LIST_ACTION_COLUMN_WIDTH}px`,
].join(" ");

const BACKLOG_LIST_HEADER_STYLE: CSSProperties = {
  gridTemplateColumns: BACKLOG_LIST_GRID_COLUMNS,
  height: BACKLOG_LIST_HEADER_HEIGHT,
  fontSize: BACKLOG_LIST_HEADER_FONT_SIZE,
};

const BACKLOG_LIST_ROW_STYLE: CSSProperties = {
  gridTemplateColumns: BACKLOG_LIST_GRID_COLUMNS,
  height: BACKLOG_LIST_ROW_HEIGHT,
};

const BACKLOG_LIST_CHECKBOX_STYLE: CSSProperties = {
  height: BACKLOG_LIST_CHECKBOX_SIZE,
  width: BACKLOG_LIST_CHECKBOX_SIZE,
};

const BACKLOG_LIST_CHECK_MARK_STYLE: CSSProperties = {
  ...BACKLOG_LIST_CHECKBOX_STYLE,
  fontSize: BACKLOG_LIST_CHECK_MARK_FONT_SIZE,
};

const BACKLOG_LIST_TASK_ID_STYLE: CSSProperties = {
  fontSize: BACKLOG_LIST_TASK_ID_FONT_SIZE,
};

const BACKLOG_LIST_TASK_TITLE_STYLE: CSSProperties = {
  fontSize: BACKLOG_LIST_TASK_TITLE_FONT_SIZE,
};

const BACKLOG_LIST_PILL_STYLE: CSSProperties = {
  fontSize: BACKLOG_LIST_PILL_FONT_SIZE,
};

function getBacklogListRowStyle(isSelected: boolean): CSSProperties {
  if (!isSelected) {
    return BACKLOG_LIST_ROW_STYLE;
  }

  return {
    ...BACKLOG_LIST_ROW_STYLE,
    boxShadow: `inset ${BACKLOG_LIST_SELECTION_INDICATOR_WIDTH}px 0 0 var(--accent)`,
  };
}

export interface BacklogListColumnActionProps {
  task: BacklogTaskRow;
  onEditTask: (task: BacklogTaskRow) => void;
}

export interface BacklogListProps {
  className?: string;
  defaultSelectedTaskIds?: string[];
  tasks: BacklogTaskRow[];
  onEditTask: (task: BacklogTaskRow) => void;
  onStatusChange: (id: string, status: BacklogTaskStatus) => void;
  pendingStatusTaskId?: string;
  isLoading: boolean;
  hasMoreTasks: boolean;
  isFetchingMore: boolean;
  onLoadMore: () => void;
  action: (props: BacklogListColumnActionProps) => ReactNode;
  showSelectionToolbar?: boolean;
}

export function BacklogList({
  className,
  defaultSelectedTaskIds = [],
  tasks,
  onEditTask,
  onStatusChange,
  pendingStatusTaskId,
  isLoading,
  hasMoreTasks,
  isFetchingMore,
  onLoadMore,
  action,
  showSelectionToolbar = true,
}: BacklogListProps) {
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(
    () => new Set(defaultSelectedTaskIds),
  );
  const defaultSelectedTaskKey = defaultSelectedTaskIds.join("\n");
  const selectedCount = selectedTaskIds.size;
  const selectedVisibleCount = useMemo(
    () => tasks.filter((task) => selectedTaskIds.has(task.id)).length,
    [selectedTaskIds, tasks],
  );

  useEffect(() => {
    const nextSelectedTaskIds =
      defaultSelectedTaskKey.length > 0 ? defaultSelectedTaskKey.split("\n") : [];
    setSelectedTaskIds(new Set(nextSelectedTaskIds));
  }, [defaultSelectedTaskKey]);

  if (isLoading) {
    return (
      <div className={cx("rounded-md border border-border px-3 py-4 text-sm text-text-secondary", className)}>
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className={LOADING_SPINNER_CLASSNAME} />
          Loading tasks
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className={cx("rounded-md border border-border px-3 py-5 text-sm text-text-secondary", className)}>
        No tasks match these filters.
      </div>
    );
  }

  function toggleTaskSelection(taskId: string) {
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedTaskIds(new Set());
  }

  return (
    <div
      className={cx("overflow-hidden rounded-md border border-border bg-surface-1", className)}
      data-visual-region="backlog-list"
    >
      {showSelectionToolbar && selectedCount > 0 ? (
        <div className="flex h-10 items-center gap-3 border-b border-accent/20 bg-accent-subtle px-4">
          <span
            aria-hidden="true"
            className="inline-flex items-center justify-center rounded border border-accent bg-accent text-accent-fg"
            style={BACKLOG_LIST_CHECK_MARK_STYLE}
          >
            ✓
          </span>
          <span className="text-xs font-semibold text-accent tabular-nums">
            {selectedVisibleCount} selected
          </span>
          <span className="h-4 w-px bg-accent/20" />
          <button className="rounded px-2 py-1 text-xs text-text-primary hover:bg-surface-1" type="button">
            Status
          </button>
          <button className="rounded px-2 py-1 text-xs text-text-primary hover:bg-surface-1" type="button">
            Assignee
          </button>
          <button className="rounded px-2 py-1 text-xs text-text-primary hover:bg-surface-1" type="button">
            Priority
          </button>
          <button className="rounded px-2 py-1 text-xs text-status-done hover:bg-surface-1" type="button">
            Mark done
          </button>
          <button className="rounded px-2 py-1 text-xs text-status-rejected hover:bg-surface-1" type="button">
            Delete
          </button>
          <button
            className="ml-auto text-xs font-medium text-text-secondary hover:text-text-primary"
            onClick={clearSelection}
            type="button"
          >
            Clear
          </button>
        </div>
      ) : null}

      <div
        className="grid items-center border-b border-border bg-surface-muted px-3 font-semibold uppercase tracking-wide text-text-secondary"
        data-visual-region="backlog-list-header"
        style={BACKLOG_LIST_HEADER_STYLE}
      >
        <span />
        <span>Task</span>
        <span>Status</span>
        <span>Priority</span>
        <span>Assignee</span>
        <span>Updated</span>
        <span />
      </div>

      <div className="bg-surface-1">
        {tasks.map((task) => {
          const isSelected = selectedTaskIds.has(task.id);
          const isPending = pendingStatusTaskId === task.id;
          const assigneeLabel = task.assigneeName ?? task.assigneeId ?? "Unassigned";

          return (
            <div
              className={cx(
                "group grid items-center border-b border-border px-3 text-sm last:border-b-0",
                "transition-colors hover:bg-surface-muted",
                isSelected ? "bg-accent-subtle" : null,
              )}
              data-visual-region="backlog-list-row"
              key={task.id}
              style={getBacklogListRowStyle(isSelected)}
            >
              <button
                aria-label={isSelected ? `Deselect ${task.title}` : `Select ${task.title}`}
                aria-pressed={isSelected}
                className="flex h-full items-center"
                onClick={() => toggleTaskSelection(task.id)}
                type="button"
              >
                <span
                  className={cx(
                    "inline-flex items-center justify-center rounded border transition-opacity",
                    isSelected
                      ? "border-accent bg-accent text-accent-fg opacity-100"
                      : "border-border bg-surface-1 text-transparent opacity-0 group-hover:opacity-100",
                  )}
                  data-visual-region="backlog-list-checkbox"
                  style={BACKLOG_LIST_CHECK_MARK_STYLE}
                >
                  ✓
                </span>
              </button>

              <button
                className="flex min-w-0 items-center gap-2 text-left"
                onClick={() => onEditTask(task)}
                type="button"
              >
                <span
                  className="shrink-0 text-text-secondary tabular-nums"
                  style={BACKLOG_LIST_TASK_ID_STYLE}
                >
                  {task.id}
                </span>
                <span
                  className="truncate font-normal text-text-primary"
                  style={BACKLOG_LIST_TASK_TITLE_STYLE}
                >
                  {task.title}
                </span>
              </button>

              <label className="relative w-fit cursor-pointer">
                <StatusPill
                  className="h-6"
                  label={BACKLOG_STATUS_LABEL_BY_VALUE[task.status]}
                  status={BACKLOG_STATUS_TONE_BY_VALUE[task.status]}
                  style={BACKLOG_LIST_PILL_STYLE}
                />
                <select
                  aria-label={`Change status for ${task.title}`}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                  disabled={isPending}
                  onChange={(event) =>
                    onStatusChange(task.id, event.target.value as BacklogTaskStatus)
                  }
                  value={task.status}
                >
                  {BACKLOG_LIST_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {BACKLOG_STATUS_LABEL_BY_VALUE[status]}
                    </option>
                  ))}
                </select>
                {isPending ? (
                  <span
                    aria-hidden="true"
                    className={cx("pointer-events-none absolute -right-5 top-1.5", LOADING_SPINNER_CLASSNAME)}
                  />
                ) : null}
              </label>

              <span
                className="inline-flex items-center gap-2 text-text-secondary"
                style={BACKLOG_LIST_PILL_STYLE}
              >
                <span className={cx("h-1.5 w-1.5 rounded-full", BACKLOG_PRIORITY_DOT_CLASS[task.priority])} />
                {BACKLOG_PRIORITY_LABEL_BY_VALUE[task.priority]}
              </span>

              <span className="flex items-center">
                <Avatar
                  className={assigneeLabel === "Unassigned" ? "opacity-45" : undefined}
                  fallback={assigneeLabel === "Unassigned" ? "–" : getInitials(assigneeLabel)}
                  name={assigneeLabel}
                  size="xs"
                />
              </span>

              <span className="text-xs text-text-secondary">{formatDate(task.updatedAt)}</span>

              <span className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                {action({ task, onEditTask })}
              </span>
            </div>
          );
        })}
      </div>

      {hasMoreTasks ? (
        <div className="flex justify-center border-t border-border bg-surface-muted px-3 py-2">
          <Button
            onClick={onLoadMore}
            disabled={isFetchingMore}
            type="button"
            variant="outline"
          >
            {isFetchingMore ? (
              <span aria-hidden="true" className={LOADING_SPINNER_CLASSNAME} />
            ) : null}
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function getInitials(value: string) {
  const [first = "", second = ""] = value.trim().split(/\s+/);
  return `${first[0] ?? ""}${second[0] ?? first[1] ?? ""}`.toUpperCase();
}

function formatDate(value: string | Date) {
  const date = new Date(value);
  const elapsedMs = Date.now() - date.getTime();
  const elapsedHours = Math.max(0, Math.round(elapsedMs / 3_600_000));

  if (elapsedHours < 24) {
    return `${Math.max(1, elapsedHours)}h`;
  }

  if (elapsedHours < 24 * 7) {
    return `${Math.round(elapsedHours / 24)}d`;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}
