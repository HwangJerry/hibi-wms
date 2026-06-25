import { type ChangeEvent, useRef } from "react";
import { Download, Paperclip } from "lucide-react";
import { Button } from "../primitives/button";

export interface UiAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string | Date;
  downloadUrl: string;
}

export interface AttachmentPanelProps {
  attachments: Array<UiAttachment>;
  isReadOnly?: boolean;
  isUploading?: boolean;
  uploadError?: string | null;
  onUpload?: (file: File) => Promise<void>;
}

export function AttachmentPanel({
  attachments,
  isReadOnly,
  isUploading = false,
  uploadError,
  onUpload,
}: AttachmentPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onUpload) {
      return;
    }

    await onUpload(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <section className="space-y-3 border-t border-border pt-3">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary">
          Attachments
        </h3>
        <span className="text-xs text-text-secondary">{attachments.length}</span>
      </div>

      <div className="space-y-2">
        {attachments.length === 0 ? (
          <p className="rounded-md border border-border bg-surface-2 px-2.5 py-2 text-sm text-text-secondary">
            No attachments yet.
          </p>
        ) : null}

        {attachments.map((attachment) => (
          <article className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-2 px-2.5 py-2" key={attachment.id}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-text-primary">{attachment.fileName}</p>
              <p className="truncate text-xs text-text-secondary">
                {attachment.mimeType} · {formatBytes(attachment.sizeBytes)}
              </p>
            </div>

            <a
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-1 px-2 py-1 text-xs text-text-secondary hover:bg-surface-3"
              href={attachment.downloadUrl}
              rel="noreferrer"
              target="_blank"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Download
            </a>
          </article>
        ))}
      </div>

      {!isReadOnly ? (
        <>
          <input
            aria-label="Upload attachment"
            accept="*/*"
            className="hidden"
            onChange={(event) => {
              void handleUpload(event);
            }}
            ref={fileInputRef}
            type="file"
          />
          <Button
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            type="button"
            variant="outline"
          >
            <Paperclip className="h-4 w-4" aria-hidden="true" />
            {isUploading ? "Uploading..." : "Upload attachment"}
          </Button>

          {uploadError ? (
            <p className="text-xs text-status-rejected">{uploadError}</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function formatBytes(value: number) {
  const units = ["B", "KB", "MB", "GB"];

  if (value < 1024) {
    return `${value} B`;
  }

  let amount = value;
  let unitIndex = 0;

  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }

  return `${amount.toFixed(1)} ${units[unitIndex]}`;
}
