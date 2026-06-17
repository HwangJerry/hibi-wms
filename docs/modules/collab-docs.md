# Module: Docs (collaborative)

## Purpose
A Confluence-style wiki: spaces, nested pages, real-time co-editing with live cursors,
version history, and comments.

## Entities
```prisma
model Space {
  id        String   @id @default(cuid())
  name      String
  deletedAt DateTime?
  createdAt DateTime @default(now())
}

model Page {
  id        String   @id @default(cuid())
  spaceId   String
  parentId  String?            // page tree
  title     String
  yDoc      Bytes              // current Yjs document state (snapshot)
  order     Float
  deletedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model PageVersion {
  id        String   @id @default(cuid())
  pageId    String
  yDoc      Bytes              // snapshot at save point
  authorId  String
  label     String?
  createdAt DateTime @default(now())
}
```

## Editing model
- The page body is a **Yjs document**. The browser connects over WebSocket to the
  **Hocuspocus** server (`apps/realtime`), not the tRPC API.
- Hocuspocus persists the live `yDoc` to `Page.yDoc` via the database extension
  (debounced). Live cursors/selections come from Yjs **awareness** — no extra storage.
- Metadata (title, tree position, permissions, comments) is managed through the tRPC
  `docs` router over HTTP.
- **Versions**: snapshot `PageVersion` on explicit save or on an interval; allow restore
  by loading a version's `yDoc` back into the page.

See `realtime.md` for the sync server details and the single-replica constraint.

## API (tRPC router `docs`)
- `spaces.list/create/rename/softDelete`
- `pages.tree({ spaceId })` · `pages.get({ id })`  // metadata; body comes via WS
- `pages.create({ spaceId, parentId?, title })`
- `pages.rename/move/reorder/softDelete`
- `versions.list({ pageId })` · `versions.restore({ pageId, versionId })`
- Comments attach to a Page via `Reference`.

## Notes
- Editor is TipTap with Yjs extensions; toolbar/marks are a frontend concern.
- Full-text search (Phase 3) indexes a plain-text projection of the Yjs doc.
