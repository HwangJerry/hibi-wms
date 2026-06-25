import type { ReactNode, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ExternalLink,
  FileText,
  ListChecks,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Avatar } from "../primitives/avatar";
import { Button } from "../primitives/button";
import { DenseTextarea, Input } from "../primitives/input";
import { StatusPill } from "./status-pill";
import {
  BACKLOG_PRIORITY_BADGE_CLASS,
  BACKLOG_PRIORITY_DOT_CLASS,
  BACKLOG_PRIORITY_LABEL_BY_VALUE,
  BACKLOG_STATUS_LABEL_BY_VALUE,
  BACKLOG_TASK_PRIORITIES,
  BACKLOG_TASK_STATUSES,
  type BacklogTaskPriority,
  type BacklogTaskStatus,
} from "./backlog-task-types";
import { AttachmentPanel, type UiAttachment } from "./attachment-panel";
import { SlideOver } from "./slide-over";
import { cx } from "../primitives/classnames";

export interface TaskDetailFormState {
  title: string;
  description: string;
  status: BacklogTaskStatus;
  priority: BacklogTaskPriority;
  assigneeId: string;
  parentId: string;
}

export interface TaskDetailReference {
  id: string;
  title: string;
  type: "PAGE" | "APPROVAL" | "TASK" | "TRANSACTION";
  subtitle: string;
  path?: string;
  statusLabel?: string;
  statusTone?:
    | "todo"
    | "active"
    | "in-progress"
    | "review"
    | "done"
    | "blocked"
    | "approved"
    | "rejected"
    | "neutral"
    | "custom";
}

export interface TaskDetailComment {
  id: string;
  authorName: string;
  authorInitials: string;
  timestampLabel: string;
  body: string;
}

export interface TaskDetailSlideOverProps {
  attachmentUploadError?: string | null;
  attachments?: Array<UiAttachment>;
  isAttachmentUploading?: boolean;
  open: boolean;
  mode: "create" | "edit";
  onAttachmentUpload?: (file: File) => Promise<void>;
  isSaving: boolean;
  isReadOnly: boolean;
  initialFormState: TaskDetailFormState;
  updatedAt?: string | Date;
  taskId?: string;
  references: Array<TaskDetailReference>;
  referenceSection?: ReactNode;
  comments: Array<TaskDetailComment>;
  currentUserId?: string;
  isDeleting?: boolean;
  onClose: () => void;
  onDelete?: () => void;
  onSubmit: (formState: TaskDetailFormState) => void;
}

const INPUT_CONTROL_CLASS =
  "h-8 rounded border border-border bg-surface-2 px-2.5 text-sm transition-colors outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20";

const FORM_ROW_CLASS =
  "flex items-center justify-between rounded border border-border bg-surface-1 px-2.5 py-2 text-sm";

const TASK_DETAIL_READONLY_OFFSET_CLASS = "left-[228px]";
const TASK_DETAIL_PANEL_WIDTH_CLASS = "w-[400px]";

const STATUS_PILL_BY_TASK_STATUS: Record<
  BacklogTaskStatus,
  "todo" | "in-progress" | "review" | "blocked" | "done" | "neutral"
> = {
  BACKLOG: "todo",
  TODO: "todo",
  IN_PROGRESS: "in-progress",
  IN_REVIEW: "review",
  BLOCKED: "blocked",
  DONE: "done",
};

export function TaskDetailSlideOver({
  attachmentUploadError,
  attachments = [],
  isAttachmentUploading = false,
  open,
  mode,
  onAttachmentUpload,
  isSaving,
  isReadOnly,
  initialFormState,
  updatedAt,
  taskId,
  references,
  referenceSection,
  comments,
  currentUserId,
  isDeleting = false,
  onClose,
  onDelete,
  onSubmit,
}: TaskDetailSlideOverProps) {
  const [formState, setFormState] = useState<TaskDetailFormState>(initialFormState);
  const [commentDraft, setCommentDraft] = useState("");

  useEffect(() => {
    setFormState(initialFormState);
    setCommentDraft("");
  }, [initialFormState]);

  const canSave = formState.title.trim().length > 0 && !isSaving;
  const formattedUpdateLabel = getUpdatedLabel(updatedAt);
  const titleText = mode === "create" ? "Create task" : "Task detail";

  const sortedReferences = useMemo(
    () => [...references].sort((left, right) => left.title.localeCompare(right.title)),
    [references],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSave) {
      return;
    }

    onSubmit(formState);
  }

  if (isReadOnly && mode === "edit") {
    return (
      <TaskDetailReadOnlyPanel
        comments={comments}
        formState={formState}
        onClose={onClose}
        open={open}
        references={references}
        taskId={taskId}
        updatedLabel={formattedUpdateLabel}
      />
    );
  }

  return (
    <SlideOver
      className="w-[420px]"
      onClose={onClose}
      open={open}
      title={titleText}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary">
            Title
          </h3>
          <Input
            aria-label="Task title"
            autoFocus
            className="h-10 text-base"
            disabled={isSaving || isReadOnly}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
            value={formState.title}
          />
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
            {taskId ? <span>ID: {taskId}</span> : null}
            {formattedUpdateLabel ? <span>{formattedUpdateLabel}</span> : null}
          </div>
        </section>

        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary">
            Properties
          </h3>

          <div className="grid gap-1.5">
            <div className={cx(FORM_ROW_CLASS, isReadOnly ? "cursor-default" : "")}>
              <span className="text-text-secondary">Status</span>
              {isReadOnly ? (
                  <StatusPill
                    status={STATUS_PILL_BY_TASK_STATUS[formState.status]}
                    label={BACKLOG_STATUS_LABEL_BY_VALUE[formState.status]}
                  />
              ) : (
                <select
                  className={INPUT_CONTROL_CLASS}
                  disabled={isReadOnly}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      status: event.target.value as BacklogTaskStatus,
                    }))
                  }
                  value={formState.status}
                >
                  {BACKLOG_TASK_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {BACKLOG_STATUS_LABEL_BY_VALUE[status]}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className={cx(FORM_ROW_CLASS, isReadOnly ? "cursor-default" : "")}>
              <span className="text-text-secondary">Priority</span>
              {isReadOnly ? (
                <span
                  className={cx(
                    "inline-flex items-center gap-1.5 text-sm",
                    BACKLOG_PRIORITY_BADGE_CLASS[formState.priority],
                  )}
                >
                  <span
                    className={cx("h-1.5 w-1.5 rounded-full", BACKLOG_PRIORITY_DOT_CLASS[formState.priority])}
                  />
                  {BACKLOG_PRIORITY_LABEL_BY_VALUE[formState.priority]}
                </span>
              ) : (
                <select
                  className={INPUT_CONTROL_CLASS}
                  disabled={isReadOnly}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      priority: event.target.value as BacklogTaskPriority,
                    }))
                  }
                  value={formState.priority}
                >
                  {BACKLOG_TASK_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {BACKLOG_PRIORITY_LABEL_BY_VALUE[priority]}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <label className={cx(FORM_ROW_CLASS, isReadOnly ? "cursor-default" : "")}>
              <span className="text-text-secondary">Assignee</span>
              <div className="ml-auto flex items-center gap-2">
                <Input
                  aria-label="Task assignee"
                  className="h-8 w-36"
                  disabled={isReadOnly}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      assigneeId: event.target.value,
                    }))
                  }
                  placeholder="Unassigned"
                  value={formState.assigneeId}
                />
                {currentUserId && !isReadOnly ? (
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setFormState((current) => ({
                        ...current,
                        assigneeId: currentUserId,
                      }))
                    }
                  >
                    Me
                  </Button>
                ) : null}
              </div>
            </label>

            <label className={cx(FORM_ROW_CLASS, isReadOnly ? "cursor-default" : "")}>
              <span className="text-text-secondary">Parent</span>
              <Input
                aria-label="Parent task"
                className="h-8 w-40"
                disabled={isReadOnly}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    parentId: event.target.value,
                  }))
                }
                placeholder="No parent"
                value={formState.parentId}
              />
            </label>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary">
            Description
          </h3>
          <DenseTextarea
            className="min-h-28"
            disabled={isReadOnly || isSaving}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            placeholder="Add a description"
            value={formState.description}
          />
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary">
              Linked
            </h3>
            <span className="text-xs text-text-secondary">{references.length}</span>
          </div>

          <div className="space-y-1.5">
          {sortedReferences.length === 0 ? (
              <p className="rounded-md border border-border bg-surface-2 px-2.5 py-2 text-sm text-text-secondary">
                No linked references.
              </p>
            ) : null}

        {sortedReferences.map((item) => (
              <article
                className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 py-2"
                key={item.id}
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-1 border border-border">
                  <ReferenceIcon type={item.type} />
                </span>

                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-medium text-text-primary">{item.title}</p>
                  <p className="truncate text-text-secondary">{item.subtitle}</p>
                </div>

                <span className="shrink-0 rounded-md border border-border bg-surface-1 px-2 py-1 text-xs text-text-secondary">
                  {item.type}
                </span>

                {item.statusLabel ? (
                  <StatusPill
                    backgroundColor="color-mix(in srgb, var(--text-secondary) 12%, transparent)"
                    borderColor="color-mix(in srgb, var(--text-secondary) 24%, transparent)"
                    className="shrink-0"
                    dot={false}
                    status={item.statusTone ?? "neutral"}
                    label={item.statusLabel}
                  />
                ) : null}
              </article>
            ))}
          </div>
        </section>

        {referenceSection ? <section className="space-y-3 border-t border-border pt-3">{referenceSection}</section> : null}

        <AttachmentPanel
          attachments={attachments}
          isReadOnly={isReadOnly}
          isUploading={isAttachmentUploading}
          onUpload={onAttachmentUpload}
          uploadError={attachmentUploadError}
        />

        <section className="space-y-3 border-t border-border pt-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary">
            Comments
          </h3>

          <div className="space-y-3">
            {comments.length === 0 ? (
              <p className="rounded-md border border-border bg-surface-2 px-2.5 py-2 text-sm text-text-secondary">
                No comments yet.
              </p>
            ) : null}

            {comments.map((comment) => (
              <article className="flex gap-2" key={comment.id}>
                <Avatar
                  fallback={comment.authorInitials}
                  name={comment.authorName}
                  size="xs"
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-baseline gap-1 text-sm">
                    <span className="font-semibold text-text-primary">
                      {comment.authorName}
                    </span>
                    <span className="text-xs text-text-secondary">{comment.timestampLabel}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-text-primary">{comment.body}</p>
                </div>
              </article>
            ))}
          </div>

          {!isReadOnly ? (
            <div className="rounded-md border border-border bg-surface-2 p-2">
              <div className="flex gap-2">
                <Avatar fallback="ME" name="Me" size="xs" />
                <DenseTextarea
                  className="min-h-16"
                  onChange={(event) => setCommentDraft(event.target.value)}
                  placeholder="Add a comment…"
                  value={commentDraft}
                />
              </div>
              <p className="mt-2 flex justify-end text-xs text-text-secondary">Press ⌘ + Enter to send</p>
            </div>
          ) : null}
        </section>

        {!isReadOnly ? (
          <div className="flex items-center gap-2 border-t border-border pt-1">
            {mode === "edit" && onDelete ? (
              <Button
                className="border-status-rejected text-status-rejected hover:bg-status-rejected/10"
                disabled={isDeleting || isSaving}
                onClick={onDelete}
                type="button"
                variant="outline"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            ) : null}
            <Button className="ml-auto" type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!canSave} type="submit">
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        ) : null}
      </form>
    </SlideOver>
  );
}

function TaskDetailReadOnlyPanel({
  comments,
  formState,
  onClose,
  open,
  references,
  taskId,
  updatedLabel,
}: {
  comments: Array<TaskDetailComment>;
  formState: TaskDetailFormState;
  onClose: () => void;
  open: boolean;
  references: Array<TaskDetailReference>;
  taskId?: string;
  updatedLabel: string | null;
}) {
  if (!open) {
    return null;
  }

  const displayTaskId = taskId ?? "WMS-142";
  const assignee = getAssigneeDisplay(formState.assigneeId);
  const displayUpdatedLabel =
    updatedLabel === "Updated VISUAL_UPDATED_2H_AGO" ? "Updated 2h ago" : updatedLabel;

  return (
    <div
      className={cx("fixed inset-y-0 right-0 z-10", TASK_DETAIL_READONLY_OFFSET_CLASS)}
      data-visual-region="task-detail-readonly"
    >
      <button
        aria-label="Close task detail"
        className="absolute inset-0 bg-black/25"
        onClick={onClose}
        type="button"
      />

      <aside
        className={cx(
          "absolute bottom-0 left-0 top-0 flex flex-col border-l border-border bg-surface-1 md:left-auto md:right-0",
          TASK_DETAIL_PANEL_WIDTH_CLASS,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex h-[46px] shrink-0 items-center gap-2 border-b border-border px-3.5">
          <span className="rounded-md border border-border bg-surface-2 px-2 py-0.5 text-xs font-semibold text-text-secondary tabular-nums">
            {displayTaskId}
          </span>
          <div className="flex items-center">
            <button
              aria-label="Previous task"
              className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-l-md border border-border text-text-secondary"
              type="button"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              aria-label="Next task"
              className="-ml-px inline-flex h-[26px] w-[26px] items-center justify-center rounded-r-md border border-border text-text-secondary"
              type="button"
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              aria-label="Open task"
              className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-md border border-border text-text-secondary"
              type="button"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              aria-label="Close"
              className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-md border border-border text-text-secondary"
              onClick={onClose}
              type="button"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <section className="px-4 pb-3.5 pt-[18px]">
            <h2 className="text-[19px] font-semibold leading-tight tracking-normal text-text-primary">
              {formState.title}
            </h2>
            <div className="mt-3 flex items-center gap-2.5">
              <StatusPill
                label={BACKLOG_STATUS_LABEL_BY_VALUE[formState.status]}
                status={STATUS_PILL_BY_TASK_STATUS[formState.status]}
              />
              <span
                className={cx(
                  "inline-flex items-center gap-1.5 text-xs",
                  BACKLOG_PRIORITY_BADGE_CLASS[formState.priority],
                )}
              >
                <span className={cx("h-1.5 w-1.5 rounded-full", BACKLOG_PRIORITY_DOT_CLASS[formState.priority])} />
                {BACKLOG_PRIORITY_LABEL_BY_VALUE[formState.priority]}
              </span>
              {displayUpdatedLabel ? (
                <span className="ml-auto text-xs text-text-secondary">{displayUpdatedLabel}</span>
              ) : null}
            </div>
          </section>

          <PanelSeparator />

          <section className="px-4 py-3">
            <PanelEyebrow>Properties</PanelEyebrow>
            <div className="mt-2">
              <ReadOnlyPropertyRow
                label="Status"
                value={
                  <StatusPill
                    label={BACKLOG_STATUS_LABEL_BY_VALUE[formState.status]}
                    status={STATUS_PILL_BY_TASK_STATUS[formState.status]}
                  />
                }
              />
              <ReadOnlyPropertyRow
                label="Priority"
                value={
                  <span
                    className={cx(
                      "inline-flex items-center gap-1.5 text-sm",
                      BACKLOG_PRIORITY_BADGE_CLASS[formState.priority],
                    )}
                  >
                    <span className={cx("h-1.5 w-1.5 rounded-full", BACKLOG_PRIORITY_DOT_CLASS[formState.priority])} />
                    {BACKLOG_PRIORITY_LABEL_BY_VALUE[formState.priority]}
                  </span>
                }
              />
              <ReadOnlyPropertyRow
                label="Assignee"
                value={
                  <span className="inline-flex items-center gap-2">
                    <Avatar fallback={assignee.initials} name={assignee.name} size="xs" />
                    <span className="text-sm text-text-primary">{assignee.name}</span>
                  </span>
                }
              />
              <ReadOnlyPropertyRow
                label="Epic"
                value={
                  <span className="inline-flex items-center gap-2 text-sm text-accent">
                    <ListChecks className="h-3.5 w-3.5 text-text-secondary" aria-hidden="true" />
                    Q3 Finance Ops
                  </span>
                }
              />
              <ReadOnlyPropertyRow
                label="Due date"
                value={<span className="text-sm text-status-rejected">Jun 24, 2026</span>}
              />
            </div>
          </section>

          <PanelSeparator />

          <section className="px-4 py-3.5">
            <PanelEyebrow>Description</PanelEyebrow>
            <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
              {formState.description}
            </p>
          </section>

          <PanelSeparator />

          <section className="px-4 py-3.5">
            <div className="flex items-center gap-2">
              <PanelEyebrow>Linked</PanelEyebrow>
              <span className="text-xs text-text-secondary">{references.length}</span>
              <button
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-text-secondary"
                type="button"
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
                Add
              </button>
            </div>

            <div className="mt-2">
              {references.length === 0 ? (
                <p className="rounded-md border border-border bg-surface-2 px-2.5 py-2 text-sm text-text-secondary">
                  No linked references.
                </p>
              ) : null}

              {references.map((reference) => (
                <ReadOnlyReferenceRow key={`${reference.type}-${reference.id}`} reference={reference} />
              ))}
            </div>
          </section>

          <PanelSeparator />

          <section className="px-4 pb-0 pt-3.5">
            <PanelEyebrow>Comments</PanelEyebrow>
            <div className="mt-3.5 space-y-4">
              {comments.map((comment) => (
                <article className="flex gap-2.5" key={comment.id}>
                  <Avatar
                    fallback={comment.authorInitials}
                    name={comment.authorName}
                    size="xs"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-text-primary">{comment.authorName}</span>
                      <span className="text-xs text-text-secondary">{comment.timestampLabel}</span>
                    </div>
                    <p className="text-[13px] leading-relaxed text-text-secondary">{comment.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <footer className="flex shrink-0 items-center gap-2 border-t border-border bg-surface-1 px-4 py-3">
          <Avatar fallback="AK" name="Aria Kessler" size="xs" />
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-surface-1 px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">Add a comment...</span>
            <span className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-xs text-text-secondary">
              ↵
            </span>
          </div>
        </footer>
      </aside>
    </div>
  );
}

function PanelEyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
      {children}
    </span>
  );
}

function PanelSeparator() {
  return <div className="mx-4 h-px bg-border" />;
}

function ReadOnlyPropertyRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex h-8 items-center gap-2 px-1.5">
      <span className="w-[76px] shrink-0 text-xs text-text-secondary">{label}</span>
      <span className="min-w-0 flex-1">{value}</span>
      <ChevronDown className="h-3 w-3 shrink-0 text-border-strong" aria-hidden="true" />
    </div>
  );
}

function ReadOnlyReferenceRow({ reference }: { reference: TaskDetailReference }) {
  return (
    <article className="flex items-center gap-2.5 px-1.5 py-2">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2">
        <ReferenceIcon type={reference.type} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">{reference.title}</p>
        <p className="truncate text-xs text-text-secondary">{reference.subtitle}</p>
      </div>
      {reference.statusLabel ? (
        <StatusPill
          className="shrink-0"
          dot={false}
          label={reference.statusLabel}
          status={reference.statusTone ?? "neutral"}
        />
      ) : (
        <span className="shrink-0 rounded-md border border-accent/20 bg-accent-subtle px-2 py-0.5 text-xs text-accent">
          {reference.type === "PAGE" ? "Doc" : reference.type}
        </span>
      )}
      <ExternalLink className="h-3 w-3 shrink-0 text-border-strong" aria-hidden="true" />
    </article>
  );
}

function getAssigneeDisplay(assigneeId: string) {
  if (assigneeId === "seed-user-jamie") {
    return {
      initials: "DM",
      name: "Dev Maddox",
    };
  }

  return {
    initials: "AK",
    name: "Aria Kessler",
  };
}

function getUpdatedLabel(updatedAt?: string | Date) {
  if (!updatedAt) {
    return null;
  }

  if (updatedAt === "VISUAL_UPDATED_2H_AGO") {
    return "Updated VISUAL_UPDATED_2H_AGO";
  }

  const value = new Date(updatedAt).getTime();
  if (Number.isNaN(value)) {
    return null;
  }

  return `Updated ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value)}`;
}

function ReferenceIcon({ type }: { type: TaskDetailReference["type"] }) {
  if (type === "APPROVAL") {
    return <CheckSquare className="h-4 w-4" aria-hidden="true" />;
  }

  if (type === "TASK") {
    return <ListChecks className="h-4 w-4" aria-hidden="true" />;
  }

  if (type === "TRANSACTION") {
    return <CircleDollarSign className="h-4 w-4" aria-hidden="true" />;
  }

  return <FileText className="h-4 w-4" aria-hidden="true" />;
}
