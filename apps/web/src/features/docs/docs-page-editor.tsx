import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AttachmentPanel,
  Button,
  DocsVersionHistoryPanel,
  InlineAlert,
  ReferenceListPanel,
  ReferencePickerPanel,
  type ReferenceTargetItem,
} from "@hibi/ui";
import { EditorContent, useEditor } from "@tiptap/react";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import StarterKit from "@tiptap/starter-kit";
import { trpc } from "@/providers/trpc-provider";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

const AUTO_SNAPSHOT_LABEL = "Auto snapshot";
const DEFAULT_EDITOR_LABEL = "Page content";
const MAX_VERSION_LABEL_LENGTH = 120;
const REMOTE_CURSOR_HUE_STEP = 97;
const MAX_TEXT_PROJECTION_LENGTH = 2000;
const PERIODIC_SNAPSHOT_INTERVAL_MS = 120_000;
const VERSION_LIST_LIMIT = 50;
const REFERENCE_LIST_LIMIT = 50;
const REFERENCE_SEARCH_LIMIT = 12;
const REFERENCE_SEARCH_MIN_LENGTH = 2;

interface DocsPageEditorProps {
  pageId: string;
  userId: string;
  userName: string;
}

function getRealtimeUrl() {
  const explicitUrl = import.meta.env.VITE_REALTIME_URL?.trim();
  const rawUrl = explicitUrl?.length === 0 ? undefined : explicitUrl;
  const target = rawUrl ?? "/realtime";
  const url = new URL(target, window.location.origin);

  if (url.protocol === "http:") {
    url.protocol = "ws:";
  }

  if (url.protocol === "https:") {
    url.protocol = "wss:";
  }

  return url.toString();
}

function createConsistentColor(seed: string) {
  const hash = Array.from(seed).reduce((state, character) => {
    const nextState = (state * REMOTE_CURSOR_HUE_STEP + character.charCodeAt(0)) % 360;
    return nextState;
  }, 0);

  return `hsl(${hash} 67% 48%)`;
}

function getUserMeta(user: Record<string, unknown>) {
  return {
    color: typeof user.color === "string" ? user.color : "hsl(0 0% 50%)",
    name: typeof user.name === "string" ? user.name : "Unknown",
  };
}

function encodeYDocToBase64(document: Y.Doc) {
  const update = Y.encodeStateAsUpdate(document);
  if (update.byteLength === 0) {
    throw new Error("Unable to serialize page content.");
  }

  let result = "";
  for (const byte of update) {
    result += String.fromCharCode(byte);
  }

  return btoa(result);
}

function decodeBase64ToUint8Array(data: string) {
  const decoded = atob(data);
  const bytes = new Uint8Array(decoded.length);

  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }

  return bytes;
}

function normalizeTextProjection(input: string) {
  return input.trim().slice(0, MAX_TEXT_PROJECTION_LENGTH);
}

export function DocsPageEditor({ pageId, userId, userName }: DocsPageEditorProps) {
  const [restoreRevision, setRestoreRevision] = useState(0);
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);
  const [activeRestoreVersionId, setActiveRestoreVersionId] = useState<string | null>(
    null
  );
  const [isAttachmentUploading, setIsAttachmentUploading] = useState(false);
  const [attachmentUploadError, setAttachmentUploadError] = useState<string | null>(
    null
  );
  const [referenceSearchTerm, setReferenceSearchTerm] = useState("");

  const versionsQuery = trpc.docs.versions.list.useQuery({
    pageId,
    limit: VERSION_LIST_LIMIT,
  });
  const attachmentsQuery = trpc.attachments.list.useQuery({
    target: { type: "PAGE", id: pageId },
  });
  const createUploadIntentMutation = trpc.attachments.createUploadIntent.useMutation();
  const outgoingReferencesQuery = trpc.references.listOutgoing.useQuery({
    from: { type: "PAGE", id: pageId },
    limit: REFERENCE_LIST_LIMIT,
  });
  const incomingReferencesQuery = trpc.references.listIncoming.useQuery({
    to: { type: "PAGE", id: pageId },
    limit: REFERENCE_LIST_LIMIT,
  });
  const referenceSearchQuery = trpc.references.searchTargets.useQuery(
    {
      term: referenceSearchTerm,
      limit: REFERENCE_SEARCH_LIMIT,
    },
    {
      enabled: referenceSearchTerm.trim().length >= REFERENCE_SEARCH_MIN_LENGTH,
    }
  );
  const createReferenceMutation = trpc.references.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        outgoingReferencesQuery.refetch(),
        incomingReferencesQuery.refetch(),
      ]);
      setReferenceSearchTerm("");
    },
  });

  const createSnapshotMutation = trpc.docs.versions.snapshot.useMutation({
    onSuccess: () => {
      void versionsQuery.refetch();
    },
  });

  const restoreMutation = trpc.docs.versions.restore.useMutation();
  const loadQueryError = versionsQuery.error
    ? `Failed to load snapshots: ${versionsQuery.error.message}`
    : null;
  const attachmentError = attachmentsQuery.error
    ? `Failed to load attachments: ${attachmentsQuery.error.message}`
    : null;
  const outgoingRefError = outgoingReferencesQuery.error
    ? `Failed to load outgoing references: ${outgoingReferencesQuery.error.message}`
    : null;
  const incomingRefError = incomingReferencesQuery.error
    ? `Failed to load backlinks: ${incomingReferencesQuery.error.message}`
    : null;
  const referenceSearchError = referenceSearchQuery.error
    ? `Failed to search references: ${referenceSearchQuery.error.message}`
    : null;
  const snapshotError = createSnapshotMutation.error
    ? `Failed to save snapshot: ${createSnapshotMutation.error.message}`
    : null;
  const restoreError = restoreMutation.error
    ? `Failed to restore snapshot: ${restoreMutation.error.message}`
    : null;
  const referenceError = createReferenceMutation.error
    ? `Failed to link reference: ${createReferenceMutation.error.message}`
    : null;
  const pageLoadError = loadQueryError ?? attachmentError ?? outgoingRefError ?? incomingRefError ?? referenceSearchError;
  const mutationError = snapshotError ?? restoreError ?? referenceError;

  const retryLoad = () => {
    void Promise.all([
      versionsQuery.refetch(),
      attachmentsQuery.refetch(),
      outgoingReferencesQuery.refetch(),
      incomingReferencesQuery.refetch(),
    ]);
  };

  useEffect(() => {
    setInitialSnapshot(null);
    setRestoreRevision((current) => current + 1);
  }, [pageId]);

  const yDoc = useMemo(() => {
    const document = new Y.Doc();
    if (initialSnapshot) {
      const decoded = decodeBase64ToUint8Array(initialSnapshot);
      Y.applyUpdate(document, decoded);
    }

    return document;
  }, [pageId, restoreRevision, initialSnapshot]);

  const provider = useMemo(() => {
    return new WebsocketProvider(getRealtimeUrl(), pageId, yDoc, {
      connect: true,
    });
  }, [pageId, restoreRevision, yDoc]);

  const userColor = useMemo(() => createConsistentColor(userId), [userId]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          history: false,
        }),
        Collaboration.configure({
          document: yDoc,
        }),
        CollaborationCursor.configure({
          provider,
          user: {
            name: userName,
            color: userColor,
          },
          render: (user) => {
            const { color, name } = getUserMeta(user);
            const cursorElement = document.createElement("span");
            cursorElement.className = "collaboration-cursor__caret";
            cursorElement.style.borderLeftWidth = "2px";
            cursorElement.style.borderLeftStyle = "solid";
            cursorElement.style.borderColor = color;
            cursorElement.style.marginLeft = "-1px";
            cursorElement.style.pointerEvents = "none";

            const label = document.createElement("span");
            label.className = "collaboration-cursor__label";
            label.style.borderRadius = "9999px";
            label.style.color = "var(--text-primary)";
            label.style.fontSize = "11px";
            label.style.lineHeight = "1";
            label.style.padding = "2px 6px";
            label.style.backgroundColor = color;
            label.textContent = name;
            cursorElement.append(label);

            return cursorElement;
          },
          selectionRender: (user) => {
            const { color, name } = getUserMeta(user);

            return {
              nodeName: "span",
              class: "collaboration-cursor__selection",
              style: `background-color: ${color}; opacity: 0.2;`,
              "data-user": name,
            };
          },
        }),
      ],
      editorProps: {
        attributes: {
          class:
            "prose prose-sm max-w-none text-sm leading-relaxed text-text-primary outline-none [&_p]:my-0 [&_h1]:text-2xl [&_h2]:text-xl",
        },
      },
      autofocus: false,
    },
    [provider, userColor, userName, yDoc]
  );

  useEffect(() => {
    provider.awareness.setLocalStateField("user", {
      name: userName,
      color: userColor,
    });

    return () => {
      provider.destroy();
      yDoc.destroy();
    };
  }, [provider, userColor, userName, yDoc]);

  const toggleBold = useCallback(() => {
    editor?.chain().focus().toggleBold().run();
  }, [editor]);

  const toggleItalic = useCallback(() => {
    editor?.chain().focus().toggleItalic().run();
  }, [editor]);

  const toggleHeading = useCallback(() => {
    editor?.chain().focus().toggleHeading({ level: 2 }).run();
  }, [editor]);

  const toggleBulletList = useCallback(() => {
    editor?.chain().focus().toggleBulletList().run();
  }, [editor]);

  const toggleOrderedList = useCallback(() => {
    editor?.chain().focus().toggleOrderedList().run();
  }, [editor]);

  const createSnapshot = useCallback(
    async (label?: string) => {
      const encoded = encodeYDocToBase64(yDoc);
      const normalizedLabel = label?.trim() ?? "";
      const textProjection = editor?.getText() ?? "";

      await createSnapshotMutation.mutateAsync({
        pageId,
        yDoc: encoded,
        label:
          normalizedLabel.length === 0
            ? undefined
            : normalizedLabel.slice(0, MAX_VERSION_LABEL_LENGTH),
        textProjection: normalizeTextProjection(textProjection),
      });
    },
    [createSnapshotMutation, editor, pageId, yDoc]
  );

  const restoreVersion = useCallback(
    async (versionId: string) => {
      setActiveRestoreVersionId(versionId);

      try {
        const restored = await restoreMutation.mutateAsync({
          pageId,
          versionId,
        });

        setInitialSnapshot(restored.yDoc);
        setRestoreRevision((current) => current + 1);
        await versionsQuery.refetch();
      } finally {
        setActiveRestoreVersionId(null);
      }
    },
    [pageId, restoreMutation, versionsQuery]
  );

  const uploadAttachment = async (file: File) => {
    setIsAttachmentUploading(true);
    setAttachmentUploadError(null);

    try {
      const intent = await createUploadIntentMutation.mutateAsync({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        target: { type: "PAGE", id: pageId },
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

  useEffect(() => {
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          await createSnapshot(AUTO_SNAPSHOT_LABEL);
        } catch {
          // Errors are surfaced by the list endpoint and toolbar state.
        }
      })();
    }, PERIODIC_SNAPSHOT_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [createSnapshot]);

  useEffect(() => {
    setAttachmentUploadError(null);
    setIsAttachmentUploading(false);
  }, [pageId]);

  const versions = useMemo(
    () => versionsQuery.data?.items ?? [],
    [versionsQuery.data?.items]
  );

  const outgoingReferences = useMemo(
    () => outgoingReferencesQuery.data?.items ?? [],
    [outgoingReferencesQuery.data?.items]
  );
  const incomingReferences = useMemo(
    () => incomingReferencesQuery.data?.items ?? [],
    [incomingReferencesQuery.data?.items]
  );
  const searchResults = useMemo(
    () => referenceSearchQuery.data?.items ?? [],
    [referenceSearchQuery.data?.items]
  );

  const handleAttachReference = async (
    target: Pick<ReferenceTargetItem, "id" | "type">
  ) => {
    await createReferenceMutation.mutateAsync({
      from: { type: "PAGE", id: pageId },
      to: { id: target.id, type: target.type },
    });
  };

  const isReferenceAlreadyLinked = (target: { id: string; type: string }) => {
    return outgoingReferences.some(
      (item) => item.id === target.id && item.type === target.type
    );
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
        searchResults={searchResults}
        searchTerm={referenceSearchTerm}
      />
    </div>
  );

  if (!editor) {
    return <p className="text-sm text-text-secondary">{DEFAULT_EDITOR_LABEL}</p>;
  }

  return (
    <section className="space-y-8" aria-label={DEFAULT_EDITOR_LABEL}>
      {pageLoadError ? (
        <InlineAlert className="flex items-center justify-between gap-2" tone="error">
          <span>{pageLoadError}</span>
          <Button onClick={retryLoad} size="sm" type="button" variant="outline">
            Retry
          </Button>
        </InlineAlert>
      ) : null}

      {mutationError ? (
        <InlineAlert className="flex items-center justify-between gap-2" tone="error">
          <span>{mutationError}</span>
          <Button
            onClick={() => {
              if (createSnapshotMutation.error) {
                createSnapshotMutation.reset();
                return;
              }

              if (restoreMutation.error) {
                restoreMutation.reset();
                return;
              }

              createReferenceMutation.reset();
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            Retry
          </Button>
        </InlineAlert>
      ) : null}

      <header className="flex flex-wrap items-center gap-1 border-y border-border-subtle py-2">
        <Button
          aria-label="Bold"
          className={editor.isActive("bold") ? "bg-surface-3" : ""}
          onClick={toggleBold}
          size="sm"
          type="button"
          variant="ghost"
        >
          B
        </Button>
        <Button
          aria-label="Italic"
          className={editor.isActive("italic") ? "bg-surface-3" : ""}
          onClick={toggleItalic}
          size="sm"
          type="button"
          variant="ghost"
        >
          I
        </Button>
        <Button
          aria-label="Heading"
          className={editor.isActive("heading", { level: 2 }) ? "bg-surface-3" : ""}
          onClick={toggleHeading}
          size="sm"
          type="button"
          variant="ghost"
        >
          H2
        </Button>
        <Button
          aria-label="Bulleted list"
          className={editor.isActive("bulletList") ? "bg-surface-3" : ""}
          onClick={toggleBulletList}
          size="sm"
          type="button"
          variant="ghost"
        >
          •
        </Button>
        <Button
          aria-label="Numbered list"
          className={editor.isActive("orderedList") ? "bg-surface-3" : ""}
          onClick={toggleOrderedList}
          size="sm"
          type="button"
          variant="ghost"
        >
          1.
        </Button>
      </header>

      <EditorContent
        className="min-h-[360px] text-sm leading-7 text-text-secondary [&_.ProseMirror]:min-h-[360px] [&_.ProseMirror]:outline-none [&_.ProseMirror_h2]:mt-5 [&_.ProseMirror_h2]:mb-2 [&_.ProseMirror_h2]:text-[17px] [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:text-text-primary [&_.ProseMirror_p]:mb-3.5 [&_.ProseMirror_strong]:font-semibold [&_.ProseMirror_strong]:text-text-primary"
        editor={editor}
      />

      <div className="grid gap-4 border-t border-border-subtle pt-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <DocsVersionHistoryPanel
          activeRestoreVersionId={activeRestoreVersionId}
          isLoading={versionsQuery.isLoading}
          isSaving={createSnapshotMutation.isPending || restoreMutation.isPending}
          onCreateSnapshot={createSnapshot}
          onRestore={restoreVersion}
          versions={versions}
        />

        <div className="space-y-4">
          <AttachmentPanel
            attachments={attachmentsQuery.data?.items ?? []}
            isUploading={isAttachmentUploading}
            uploadError={attachmentUploadError}
            onUpload={uploadAttachment}
          />

          {referenceSection}
        </div>
      </div>
    </section>
  );
}
