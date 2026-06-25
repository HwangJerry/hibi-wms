# Gap Report

Generated from the current repo state against `AGENTS.md`, all files in `docs/`,
and the roadmap in `docs/product.md`.

## Surveyed Areas

- Workspace: pnpm + Turborepo are present at `package.json`, `pnpm-workspace.yaml`,
  and `turbo.json`; workspaces cover `apps/*` and `packages/*`.
- Apps: `apps/web` exists as React/Vite; `apps/realtime` exists but is only an HTTP
  placeholder.
- Packages: `packages/api`, `packages/auth`, `packages/core`, `packages/db`,
  `packages/config`, and `packages/ui` exist.
- Database: Prisma schema and migrations exist under `packages/db/prisma`.
- Design: exported mockups exist under `design/mockups`; token scripts exist under
  `scripts/`.
- Infra: only `infra/k8s/postgres.yaml` has manifests; `infra/cloudflared`,
  `infra/helm`, and `infra/scripts` are empty.

## Roadmap Status

### Phase 1 - Workspace Foundation

| Task | Status | Note |
| --- | --- | --- |
| Auth (sessions), Users | Partial | `User`/`Session` schema, migrations, Argon2 session helpers, auth router, and login UI exist in `packages/db/prisma/schema.prisma`, `packages/auth/src/index.ts`, `packages/api/src/routers/auth.ts`, and `apps/web/src/app.tsx`; no Lucia integration despite docs, no user management UI. |
| Backlog module (CRUD, board + list) | Partial | DB model, router, service, tests, and a web list CRUD surface exist in `packages/db/prisma/schema.prisma`, `packages/api/src/routers/backlog.ts`, `packages/api/src/modules/backlog/service.ts`, and `apps/web/src/features/backlog/backlog-page.tsx`; board view and drag/drop board UI are missing. |
| Docs module with real-time editing, version history | Missing | Only a Docs placeholder route exists in `apps/web/src/app.tsx`; no `Space`, `Page`, `PageVersion`, docs router/service, TipTap/Yjs client, Hocuspocus server, or version restore flow. |
| Deployable to k3s behind Cloudflare Tunnel | Partial | Local Postgres compose and a Postgres StatefulSet exist in `docker-compose.yml` and `infra/k8s/postgres.yaml`; no web/api/realtime deployments, services, ingress routes, cloudflared manifests, image build files, migration job, backup job, or complete Kustomize/Helm chart. |

### Phase 2 - Money & Sign-off

| Task | Status | Note |
| --- | --- | --- |
| Approval engine (generic state machine + audit log) | Missing | Shared `AuditLog` exists in `packages/core/src/audit.ts` and Prisma, but there is no `ApprovalRequest`/`ApprovalAction` schema, approval service, router, state machine, or UI. |
| Finance module: accounts, transactions, categories, budgets | Missing | No finance Prisma models, migrations, routers, services, or app routes exist; finance appears only in docs and mockups. |
| Approval-gated posting | Missing | No transaction model or approval module exists, so no gated posting or balance-impact enforcement is implemented. |

### Phase 3 - Insight & Polish

| Task | Status | Note |
| --- | --- | --- |
| Reports and dashboards | Missing | No report routers/services or dashboard screens exist; finance dashboard mockups are reference-only in `design/mockups`. |
| Notifications | Missing | No notification schema, service, router, or UI exists. |
| Full-text search across docs and entities | Missing | No search index/projection, router, service, or UI exists. |
| Cross-entity reference UI and linking polish | Partial | `Reference` schema and helpers exist in `packages/db/prisma/schema.prisma` and `packages/core/src/references.ts`; no tRPC endpoints or UI for creating/browsing links. |

## Module/API Detail

| Area | Status | Note |
| --- | --- | --- |
| tRPC/Fastify API shell | Done | Fastify server, `/health`, tRPC context, protected procedures, and `AppRouter` export exist in `packages/api/src/server.ts`, `packages/api/src/context.ts`, `packages/api/src/trpc.ts`, and `packages/api/src/routers/index.ts`. |
| Router thinness | Partial | Backlog router mostly validates with Zod and calls service; auth router contains credential/session mutation logic directly in `packages/api/src/routers/auth.ts`. |
| Zod boundary validation | Partial | Auth and backlog inputs use Zod in `packages/api/src/routers`; missing modules have no validation. |
| Shared primitives | Partial | `Reference`, `AuditLog`, `Comment`, and `Attachment` schema/helper pieces exist in `packages/db/prisma/schema.prisma` and `packages/core/src`; comments/attachments are not wired to modules or R2 flows. |
| Local seed | Partial | Two users and sample shared primitive rows are seeded in `packages/db/prisma/seed.ts`; seed references non-existent approval/task IDs without seeding corresponding rows. |

## Frontend/UI Detail

| Area | Status | Note |
| --- | --- | --- |
| React + Vite app | Done | `apps/web/package.json`, `apps/web/src/main.tsx`, and `apps/web/src/app.tsx` provide the app shell, routing, tRPC provider, login, backlog route, and docs placeholder. |
| Router choice | Done | React Router is used in `apps/web/src/main.tsx` and `apps/web/src/app.tsx`. |
| Backlog list UI | Partial | Filter/sort/create/edit/status update flow exists in `apps/web/src/features/backlog/backlog-page.tsx`; it is list-oriented and lacks board columns/drag reorder UI. |
| `packages/ui` design system | Partial | Canonical tokens and generated token outputs exist in `packages/ui/tokens`; no `packages/ui/src` primitives/components or Ladle catalog exist. |
| Mockup pipeline | Partial | Mockups and token extraction/build scripts exist in `design/mockups`, `scripts/extract-tokens.js`, and `scripts/build-tokens.js`; generated token outputs are present. |

## Infrastructure Detail

| Area | Status | Note |
| --- | --- | --- |
| Local Postgres | Done | `docker-compose.yml` runs PostgreSQL 16 for local development. |
| k3s Postgres | Partial | `infra/k8s/postgres.yaml` defines a namespace, services, and single-replica StatefulSet with local-path PVC and node affinity. |
| Cloudflare Tunnel | Missing | `infra/cloudflared` is empty; no tunnel Deployment, config, or secret templates exist. |
| App workloads | Partial | `packages/api/Dockerfile`, `apps/realtime/Dockerfile`, and `apps/web/Dockerfile` exist, but Kubernetes manifests are still missing. |
| Realtime single replica manifest | Missing | No realtime Deployment exists, so the single-replica Hocuspocus constraint is not represented. |
| Backups to R2 | Missing | `infra/scripts` is empty; no `pg_dump` CronJob or restore script exists. |
| CI/image publishing | Done | `ci` workflow now runs `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm tokens:build`, then builds and pushes `api`, `realtime`, and `web` images to GHCR with `github.sha` and `:main` tags. |

## Conflicts and Risks Against Docs

- Stack conflict: `docs/tech-stack.md` specifies Lucia for auth, but current auth is custom Argon2/session-cookie code in `packages/auth/src/index.ts`; no Lucia dependency is present.
- Realtime conflict: `docs/realtime.md` requires Hocuspocus/Yjs persistence and auth, but `apps/realtime/src/index.ts` is a plain HTTP placeholder with no Hocuspocus, Yjs, database extension, or WebSocket auth.
- UI boundary conflict: `docs/repo-structure.md` and `docs/design-system.md` say `apps/web` should consume `packages/ui`; current UI primitives live in `apps/web/src/components/ui/button.tsx`, and `packages/ui` has only tokens.
- Token conflict: `apps/web/src/styles/globals.css` defines shadcn-style CSS variables directly instead of importing/using generated `packages/ui/tokens/tokens.css`.
- Package gap: `packages/ui` has no `package.json`, source components, or Ladle catalog despite being listed as a workspace package in docs.
- Infra conflict: `docs/deployment.md` asks to pick Helm or Kustomize under `infra/` and document it; `infra/helm` is empty and there is a standalone `infra/k8s/postgres.yaml`.
- Infra risk: `infra/k8s/postgres.yaml` exposes Postgres via `NodePort` (`hibi-postgres-nodeport`), which is not described in the docs' in-cluster-only topology.
- Data model divergence: `Reference.relation` is nullable in `docs/data-model.md`, but implemented as a non-null sentinel-backed field in `packages/db/prisma/schema.prisma`; this is documented in migration intent but differs from the spec shape.
- Seed data risk: `packages/db/prisma/seed.ts` creates audit/reference rows for `seed-task-kickoff` and `seed-approval-finance` without corresponding `Task` or `ApprovalRequest` rows.
- Dependency/version drift: package manifests use Vite 8 and Prisma 7; docs only pin Node 20 and PostgreSQL 16 but do not explicitly bless these newer majors.

## Current Completion Summary

- Done: monorepo shell, Fastify/tRPC API shell, local auth/session basics, user/session models, shared primitive schema/helpers, local Postgres, basic backlog backend, basic backlog list UI.
- Partial: Phase 1 overall, design token pipeline, k3s database manifest, cross-entity reference foundation.
- Missing: collaborative docs, Hocuspocus/Yjs/TipTap, approval engine, finance, reports, notifications, search, complete reference UI, complete `packages/ui`, full app deployment, Cloudflare tunnel, backups, and CI/image publishing.
