# Real-time editing

## Components
- **Yjs** — CRDT document type; resolves concurrent edits without locks.
- **Hocuspocus** — WebSocket server (`apps/realtime`) that syncs Yjs docs between clients.
- **TipTap** — the editor in the frontend, bound to the Yjs doc + awareness.

## Topology constraint (important)
**Run Hocuspocus as a single replica.** It keeps each live document in memory; multiple
replicas would diverge unless they share a sync backend (e.g. the Redis extension).
For two users, one replica is correct and simplest. Do not add `replicas > 1` to the
realtime Deployment, and do not assume statelessness.

## Persistence
- Use `@hocuspocus/extension-database`:
  - `fetch` loads `Page.yDoc` when a document is first opened.
  - `store` writes the updated `yDoc` back, **debounced** (e.g. every few seconds of idle)
    to avoid hammering Postgres.
- Snapshot to `PageVersion` on explicit save or on a timer for history/restore.

## Presence (live cursors)
- Comes free from Yjs **awareness** — broadcast, not persisted. Each client publishes its
  user id, name, color, and selection range; peers render remote cursors from that.

## Auth on the WebSocket
- The client sends the session token on connect; Hocuspocus's `onAuthenticate` validates
  it (shared session check with the API) and resolves the user. Reject unauthenticated or
  unauthorized (no access to the space/page) connections.

## Through Cloudflare
- WebSockets pass through Cloudflare Tunnel and Traefik unchanged. No special config
  beyond routing the realtime hostname/path to the realtime Service.
