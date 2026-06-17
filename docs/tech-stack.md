# Tech stack

Pin to these. If a newer major version is needed, note it in the PR.

## Language & tooling
- **TypeScript** (strict). Node.js 20 LTS. **pnpm** workspaces. **Turborepo** for tasks.
- Lint/format: **ESLint** + **Prettier**. Tests: **Vitest** (unit/integration),
  **Playwright** (e2e).

## Frontend
- **React 18** + **Vite**.
- UI: **shadcn/ui** (Radix + Tailwind CSS).
- Server state: **TanStack Query** (via the tRPC React client).
- Routing: **TanStack Router** or React Router (pick one, document in repo).
- Editor: **TipTap** (ProseMirror) with the **Yjs** collaboration extensions.

## API / backend
- **tRPC v11** on **Fastify**.
- Validation: **Zod** (shared input schemas).
- ORM: **Prisma** with **PostgreSQL 16**.
- Auth: **Lucia** (session-based) — see `docs/api-conventions.md` and a future `auth` note.
- Background jobs (Phase 3): start with a simple cron CronJob; add BullMQ + Redis only
  if needed.

## Real-time
- **Yjs** (CRDT), **Hocuspocus** server, persistence via `@hocuspocus/extension-database`
  writing snapshots to Postgres.

## Storage & infra
- **PostgreSQL** (pinned to one k3s node, local-path volume).
- **Cloudflare R2** (S3-compatible) for file attachments.
- **k3s** on two laptops, **Traefik** ingress, **cloudflared** tunnel.

## Rationale (brief)
End-to-end TypeScript + tRPC gives compile-time safety across the wire with one team
owning both ends. Prisma + Zod keep the data and validation layers typed and shared.
Yjs/Hocuspocus/TipTap is the proven stack for Google-Docs-style editing, so we don't
build conflict resolution ourselves.
