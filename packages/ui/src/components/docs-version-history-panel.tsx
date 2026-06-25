import { useState, type FormEvent } from "react";
import { Button } from "../primitives/button";

export interface DocsVersionSummary {
  id: string;
  label: string | null;
  createdAt: string | Date;
  author: {
    id: string;
    name: string;
  };
}

export interface DocsVersionHistoryPanelProps {
  versions: DocsVersionSummary[];
  isLoading: boolean;
  isSaving: boolean;
  activeRestoreVersionId: string | null;
  onCreateSnapshot: (label?: string) => Promise<void> | void;
  onRestore: (versionId: string) => Promise<void> | void;
}

const MAX_VERSION_LABEL_LENGTH = 120;

export function DocsVersionHistoryPanel({
  versions,
  isLoading,
  isSaving,
  activeRestoreVersionId,
  onCreateSnapshot,
  onRestore,
}: DocsVersionHistoryPanelProps) {
  const [snapshotLabel, setSnapshotLabel] = useState("");

  const formatCreatedAt = (rawDate: string | Date) => {
    const date = rawDate instanceof Date ? rawDate : new Date(rawDate);
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const handleSnapshotSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalized = snapshotLabel.trim();
    await onCreateSnapshot(normalized.length === 0 ? undefined : normalized.slice(0, MAX_VERSION_LABEL_LENGTH));
    setSnapshotLabel("");
  };

  return (
    <section className="mt-4 rounded-md border border-border bg-surface-2 p-3">
      <header className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
          Version history
        </p>
        <span className="text-xs text-text-secondary">{versions.length} version{versions.length === 1 ? "" : "s"}</span>
      </header>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          void handleSnapshotSubmit(event);
        }}
      >
        <input
          className="h-8 flex-1 rounded border border-border bg-surface-1 px-2 text-sm text-text-primary outline-none"
          onChange={(event) => setSnapshotLabel(event.target.value)}
          placeholder="Snapshot label"
          value={snapshotLabel}
        />
        <Button disabled={isSaving} type="submit" variant="outline">
          Save snapshot
        </Button>
      </form>

      <div className="mt-3 space-y-2">
        {isLoading ? (
          <p className="text-sm text-text-secondary">Loading versions…</p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-text-secondary">No snapshots yet.</p>
        ) : (
          versions.map((version) => {
            const isRestoring = activeRestoreVersionId === version.id;
            return (
              <article
                className="rounded border border-border bg-surface-1 p-2"
                key={version.id}
              >
                <p className="truncate text-sm text-text-primary">
                  {version.label ?? "Unlabeled snapshot"}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {`By ${version.author.name} • ${formatCreatedAt(version.createdAt)}`}
                </p>
                <Button
                  className="mt-2"
                  disabled={isRestoring}
                  onClick={() => {
                    void onRestore(version.id);
                  }}
                  size="sm"
                  variant="outline"
                >
                  {isRestoring ? "Restoring..." : "Restore"}
                </Button>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
