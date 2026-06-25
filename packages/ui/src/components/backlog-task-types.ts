import type { StatusTone } from "./status-pill";

export type BacklogTaskStatus =
  | "BACKLOG"
  | "TODO"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "BLOCKED"
  | "DONE";
export type BacklogTaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface BacklogTaskRow {
  id: string;
  title: string;
  description: string | null;
  status: BacklogTaskStatus;
  priority: BacklogTaskPriority;
  assigneeId: string | null;
  assigneeName?: string | null;
  parentId: string | null;
  order: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export const BACKLOG_TASK_STATUSES = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "BLOCKED",
  "DONE",
] as const;
export const BACKLOG_TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const BACKLOG_STATUS_LABEL_BY_VALUE: Record<BacklogTaskStatus, string> = {
  BACKLOG: "Backlog",
  TODO: "Todo",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  BLOCKED: "Blocked",
  DONE: "Done",
};

export const BACKLOG_PRIORITY_LABEL_BY_VALUE: Record<BacklogTaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const BACKLOG_STATUS_TONE_BY_VALUE: Record<BacklogTaskStatus, StatusTone> = {
  BACKLOG: "neutral",
  TODO: "todo",
  IN_PROGRESS: "in-progress",
  IN_REVIEW: "review",
  BLOCKED: "blocked",
  DONE: "done",
};

export const BACKLOG_PRIORITY_BADGE_CLASS: Record<
  BacklogTaskPriority,
  string
> = {
  LOW: "text-text-secondary",
  MEDIUM: "text-accent border-accent/30",
  HIGH: "text-status-pending border-status-pending/40",
  URGENT: "text-status-rejected border-status-rejected/40",
};

export const BACKLOG_PRIORITY_DOT_CLASS: Record<
  BacklogTaskPriority,
  string
> = {
  LOW: "bg-text-secondary",
  MEDIUM: "bg-accent",
  HIGH: "bg-status-pending",
  URGENT: "bg-status-rejected",
};
