import { useState } from "react";
import "../../tokens/tokens.css";
import {
  BacklogBoard,
  type BacklogBoardMove,
  type BacklogTaskRow,
} from "../../src";

const rows: BacklogTaskRow[] = [
  {
    id: "WMS-129",
    title: "Annual entity compliance filing",
    description: "Prepare filing notes and attach supporting invoices.",
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
    status: "DONE",
    description: "Closeout and mark expenses as paid.",
    priority: "HIGH",
    assigneeId: "ES",
    parentId: null,
    order: 4096,
    createdAt: new Date("2026-05-31T15:00:00Z"),
    updatedAt: new Date("2026-06-13T14:12:00Z"),
  },
];

function BacklogBoardStory({ dark = false }: { dark?: boolean }) {
  const [tasks, setTasks] = useState(rows);
  const [pendingId, setPendingId] = useState<string | undefined>();

  return (
    <div className={dark ? "dark min-h-screen bg-surface-1 p-8" : "min-h-screen bg-surface-1 p-8"}>
      <BacklogBoard
        onEditTask={() => {
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
        onCardMove={(move) => {
          setTasks((currentTasks) => applyMove(currentTasks, move));
        }}
        pendingStatusTaskId={pendingId}
        tasks={tasks}
      />
    </div>
  );
}

export const BacklogBoardLight = () => <BacklogBoardStory />;
export const BacklogBoardDark = () => <BacklogBoardStory dark />;

const BASE_ORDER_INCREMENT = 1024;

function calculateOrder(beforeOrder: number | undefined, afterOrder: number | undefined) {
  if (beforeOrder === undefined) {
    return afterOrder === undefined ? BASE_ORDER_INCREMENT : afterOrder / 2;
  }

  if (afterOrder === undefined) {
    return beforeOrder + BASE_ORDER_INCREMENT;
  }

  return (beforeOrder + afterOrder) / 2;
}

function applyMove(
  currentTasks: BacklogTaskRow[],
  move: BacklogBoardMove,
): BacklogTaskRow[] {
  const { id, fromStatus, toStatus, beforeId, afterId } = move;
  const sourceTask = currentTasks.find((task) => task.id === id);
  if (!sourceTask) {
    return currentTasks;
  }

  const sourceTasksWithoutActive = currentTasks.filter(
    (task) => task.status === fromStatus && task.id !== id,
  );
  const destinationTasksWithoutActive = currentTasks.filter(
    (task) => task.status === toStatus && task.id !== id,
  );
  const insertionIndex = beforeId
    ? destinationTasksWithoutActive.findIndex((task) => task.id === beforeId) + 1
    : 0;

  const beforeTask = destinationTasksWithoutActive[insertionIndex - 1];
  const afterTask = destinationTasksWithoutActive[insertionIndex];
  const nextOrder = calculateOrder(beforeTask?.order, afterTask?.order);

  const activeTask: BacklogTaskRow = {
    ...sourceTask,
    status: toStatus,
    order: nextOrder,
  };

  const nextTasks = currentTasks.filter((task) => task.status !== toStatus && task.id !== id);
  const adjustedDestinationTasks = [...destinationTasksWithoutActive];

  adjustedDestinationTasks.splice(insertionIndex, 0, activeTask);

  const nextGroupedTasks = {
    BACKLOG: nextTasks.filter((task) => task.status === "BACKLOG"),
    TODO: nextTasks.filter((task) => task.status === "TODO"),
    IN_PROGRESS: nextTasks.filter((task) => task.status === "IN_PROGRESS"),
    DONE: nextTasks.filter((task) => task.status === "DONE"),
  };
  if (fromStatus === toStatus) {
    nextGroupedTasks[toStatus] = adjustedDestinationTasks;
  } else {
    nextGroupedTasks[toStatus] = adjustedDestinationTasks;
    nextGroupedTasks[fromStatus] = sourceTasksWithoutActive;
  }

  return [
    ...nextGroupedTasks.BACKLOG,
    ...nextGroupedTasks.TODO,
    ...nextGroupedTasks.IN_PROGRESS,
    ...nextGroupedTasks.DONE,
  ];
}
