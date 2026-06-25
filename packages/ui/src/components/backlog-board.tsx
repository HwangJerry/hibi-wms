import { type DragEvent, useEffect, useMemo, useState } from "react";
import { Avatar } from "../primitives/avatar";
import {
  BACKLOG_PRIORITY_DOT_CLASS,
  BACKLOG_PRIORITY_LABEL_BY_VALUE,
  BACKLOG_STATUS_LABEL_BY_VALUE,
  type BacklogTaskRow,
  type BacklogTaskStatus,
} from "./backlog-task-types";
import { cx } from "../primitives/classnames";

const BACKLOG_STATUSES = ["BACKLOG", "TODO", "IN_PROGRESS", "DONE"] as const;
const BASE_ORDER_INCREMENT = 1024;
const LOADING_SPINNER_CLASSNAME =
  "inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-text-secondary border-t-transparent";

export interface BacklogBoardProps {
  className?: string;
  tasks: BacklogTaskRow[];
  onCardMove?: (move: BacklogBoardMove) => void;
  onEditTask: (task: BacklogTaskRow) => void;
  onStatusChange: (id: string, status: BacklogTaskStatus) => void;
  pendingStatusTaskId?: string;
}

export interface BacklogBoardMove {
  id: string;
  fromStatus: BacklogTaskStatus;
  toStatus: BacklogTaskStatus;
  beforeId?: string;
  afterId?: string;
}

type BoardTasksByStatus = Record<(typeof BACKLOG_STATUSES)[number], BacklogTaskRow[]>;

function createEmptyBoardTasksByStatus(): BoardTasksByStatus {
  return Object.fromEntries(
    BACKLOG_STATUSES.map((status) => [status, [] as BacklogTaskRow[]]),
  ) as BoardTasksByStatus;
}

export function BacklogBoard({
  className,
  tasks,
  onCardMove,
  onEditTask,
  onStatusChange,
  pendingStatusTaskId,
}: BacklogBoardProps) {
  const [displayedTasks, setDisplayedTasks] = useState(tasks);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  useEffect(() => {
    setDisplayedTasks(tasks);
  }, [tasks]);

  const groupedTasks = useMemo(
    () =>
      BACKLOG_STATUSES.reduce<BoardTasksByStatus>(
        (accumulator, status) => {
          accumulator[status] = displayedTasks
            .filter((task) => task.status === status)
            .sort((left, right) => left.order - right.order);
          return accumulator;
        },
        createEmptyBoardTasksByStatus(),
      ),
    [displayedTasks],
  );

  if (displayedTasks.length === 0) {
    return (
      <div className={cx("rounded-md border border-border bg-surface-2/30 px-4 py-5 text-sm text-text-secondary", className)}>
        No tasks match these filters.
      </div>
    );
  }

  function getFractionalOrder(beforeOrder: number | undefined, afterOrder: number | undefined) {
    if (beforeOrder === undefined) {
      return afterOrder === undefined ? BASE_ORDER_INCREMENT : afterOrder / 2;
    }

    if (afterOrder === undefined) {
      return beforeOrder + BASE_ORDER_INCREMENT;
    }

    return (beforeOrder + afterOrder) / 2;
  }

  function moveTaskInPlace(
    activeId: string,
    destinationStatus: BacklogTaskStatus,
    anchorTaskId: string | null,
    insertBeforeAnchor: boolean,
  ) {
    const activeTask = displayedTasks.find((task) => task.id === activeId);
    if (!activeTask) {
      return null;
    }

    const sourceStatus = activeTask.status;
    const destinationTasksWithoutActive = displayedTasks.filter(
      (task) => task.status === destinationStatus && task.id !== activeId,
    );
    const sourceTasks = displayedTasks.filter(
      (task) => task.status === sourceStatus,
    );
    const sourceIndex = sourceTasks.findIndex((task) => task.id === activeId);

    if (sourceStatus === destinationStatus && anchorTaskId === activeId) {
      return null;
    }

    const anchorIndex = anchorTaskId === null
      ? destinationTasksWithoutActive.length
      : destinationTasksWithoutActive.findIndex((task) => task.id === anchorTaskId);

    if (anchorTaskId !== null && anchorIndex === -1) {
      return null;
    }

    const insertIndex = insertBeforeAnchor ? anchorIndex : anchorIndex + 1;

    if (sourceStatus === destinationStatus && sourceIndex === insertIndex) {
      return null;
    }

    const beforeTask = destinationTasksWithoutActive[insertIndex - 1];
    const afterTask = destinationTasksWithoutActive[insertIndex];
    const nextOrder = getFractionalOrder(beforeTask?.order, afterTask?.order);

    const nextSourceStatusTasks = displayedTasks
      .filter((task) => task.status === sourceStatus && task.id !== activeId)
      .slice();
    const nextDestinationStatusTasks = [...destinationTasksWithoutActive];
    nextDestinationStatusTasks.splice(insertIndex, 0, {
      ...activeTask,
      status: destinationStatus,
      order: nextOrder,
    });

    const nextGroupedTasks = BACKLOG_STATUSES.reduce<BoardTasksByStatus>((accumulator, status) => {
      if (sourceStatus === destinationStatus && status === sourceStatus) {
        accumulator[status] = nextDestinationStatusTasks;
      } else if (status === sourceStatus) {
        accumulator[status] = nextSourceStatusTasks;
      } else if (status === destinationStatus) {
        accumulator[status] = nextDestinationStatusTasks;
      } else {
        accumulator[status] = displayedTasks.filter((task) => task.status === status);
      }

      return accumulator;
    }, createEmptyBoardTasksByStatus());

    const nextTasks = BACKLOG_STATUSES.flatMap((status) => nextGroupedTasks[status]);
    setDisplayedTasks(nextTasks);

    return {
      id: activeId,
      fromStatus: sourceStatus,
      toStatus: destinationStatus,
      beforeId: beforeTask?.id,
      afterId: afterTask?.id,
    };
  }

  function handleDropOnCard(
    event: DragEvent<HTMLElement>,
    anchorTask: BacklogTaskRow,
  ) {
    event.preventDefault();
    event.stopPropagation();

    const activeId = draggingTaskId;
    if (!activeId) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const insertBeforeAnchor = event.clientY - bounds.top < bounds.height / 2;
    const movePlan = moveTaskInPlace(
      activeId,
      anchorTask.status,
      anchorTask.id,
      insertBeforeAnchor,
    );

    setDraggingTaskId(null);

    if (!movePlan) {
      return;
    }

    onCardMove?.(movePlan);
  }

  function handleDropOnColumn(
    event: DragEvent<HTMLElement>,
    destinationStatus: BacklogTaskStatus,
  ) {
    event.preventDefault();
    event.stopPropagation();

    const activeId = draggingTaskId;
    if (!activeId) {
      return;
    }

    const movePlan = moveTaskInPlace(activeId, destinationStatus, null, true);
    setDraggingTaskId(null);

    if (!movePlan) {
      return;
    }

    onCardMove?.(movePlan);
  }

  function handleDragStart(event: DragEvent<HTMLElement>, taskId: string) {
    event.dataTransfer.setData("text/plain", taskId);
    setDraggingTaskId(taskId);
  }

  function handleDragEnd() {
    setDraggingTaskId(null);
  }

  return (
    <div className={cx("rounded-md border border-border bg-surface-2/30", className)}>
      <div className="grid grid-cols-4 gap-0">
        {BACKLOG_STATUSES.map((status) => (
          <section
            key={status}
            className="flex min-h-0 flex-col border-r border-border last:border-r-0"
          >
            <header className="flex h-9 items-center gap-2 border-b border-border bg-surface-2 px-3 text-xs font-semibold text-text-secondary">
              <span className="h-2.5 w-2.5 rounded-full bg-text-secondary" />
              <h2 className="truncate">{BACKLOG_STATUS_LABEL_BY_VALUE[status]}</h2>
              <span className="text-text-secondary/80">
                {groupedTasks[status].length}
              </span>
              <button
                aria-label={`Add to ${BACKLOG_STATUS_LABEL_BY_VALUE[status]}`}
                className="ml-auto inline-flex h-4 w-4 items-center justify-center rounded text-text-secondary hover:bg-surface-3"
                type="button"
              >
                +
              </button>
            </header>

            <div
              className="flex min-h-0 flex-1 gap-1 overflow-y-auto px-2 py-2"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDropOnColumn(event, status)}
            >
              <div className="flex min-h-0 flex-1 flex-col gap-1">
                {groupedTasks[status].map((task) => {
                  const isPending = pendingStatusTaskId === task.id;
                  const assigneeLabel = task.assigneeName ?? task.assigneeId ?? "Unassigned";
                  const initials = getInitials(assigneeLabel);
                  const isActive = draggingTaskId === task.id;
                  const statusToneClass =
                    status === "DONE" ? "line-through text-text-secondary/80" : "";

                  return (
                    <button
                      className={cx(
                        "group relative rounded-md border border-border bg-surface-1 px-2 py-1 text-left transition-colors",
                        isActive
                          ? "border-accent/45 bg-surface-3"
                          : "hover:border-border/80 hover:bg-surface-3",
                      )}
                      key={task.id}
                      draggable
                      onDragEnd={handleDragEnd}
                      onDragStart={(event) => handleDragStart(event, task.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleDropOnCard(event, task)}
                      onClick={() => onEditTask(task)}
                      type="button"
                    >
                      <span className="absolute left-1 top-1.5 text-[10px] leading-none text-text-secondary opacity-0 transition-opacity group-hover:opacity-100">
                        ...
                      </span>
                      <p
                        className={cx(
                          "line-clamp-2 min-h-6 text-sm text-text-primary",
                          statusToneClass,
                        )}
                      >
                        {task.title}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-text-secondary">
                        <span className={cx("h-1.5 w-1.5 rounded-full", BACKLOG_PRIORITY_DOT_CLASS[task.priority])} />
                        <span>{BACKLOG_PRIORITY_LABEL_BY_VALUE[task.priority]}</span>
                        <span className="ml-auto text-text-secondary/75">
                          #{task.id}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Avatar
                          fallback={initials}
                          name={assigneeLabel}
                          size="xs"
                        />
                        <span className="min-w-0 flex-1 truncate text-xs">
                          {assigneeLabel}
                        </span>
                        <label className="ml-auto">
                          <select
                            aria-label={`Change status for ${task.title}`}
                            className="h-6 rounded border border-border bg-surface-1 px-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isPending}
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                            onChange={(event) =>
                              onStatusChange(task.id, event.target.value as BacklogTaskStatus)
                            }
                            value={task.status}
                          >
                            {BACKLOG_STATUSES.map((statusOption) => (
                              <option key={statusOption} value={statusOption}>
                                {BACKLOG_STATUS_LABEL_BY_VALUE[statusOption]}
                              </option>
                            ))}
                          </select>
                        </label>
                        {isPending ? (
                          <span aria-hidden="true" className={LOADING_SPINNER_CLASSNAME} />
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function getInitials(value: string) {
  const [first = "", second = ""] = value.trim().split(/\s+/);
  return `${first[0] ?? ""}${second[0] ?? first[1] ?? ""}`.toUpperCase();
}
