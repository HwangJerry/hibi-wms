# AGENTS.md

> Always-loaded agent guide. Keep this lean — detailed specs live in `docs/`.
> If something here conflicts with a file in `docs/`, the `docs/` file wins.

## Project
**WMS** — an internal work-management app for **2 business partners** (both developers).
Modules: **Backlog**, **Approval** (financial + work sign-off), **Finance**, **Docs** (real-time co-editing).
Self-hosted on a **2-node k3s cluster** (laptops), public access via **Cloudflare Tunnel**.

## Stack (one line)
TypeScript end-to-end · React + Vite · tRPC + Fastify · Prisma + PostgreSQL · Yjs + Hocuspocus + TipTap · Turborepo.

## Golden rules
- **Type-safe end to end.** No `any`. Validate every input with Zod.
- **Modular monolith.** Respect module boundaries; cross-module access goes through a module's service layer, never direct table reads from another module.
- **Money is gated.** No financial state changes without an `approved` ApprovalRequest. All financial writes are append-only and audit-logged.
- **Hocuspocus is a single replica.** Never assume horizontal scaling for live documents.
- **Secrets never in code or images.** Use k8s Secrets / env only.
- **TLS terminates at Cloudflare.** No cert-manager in-cluster; services speak plain HTTP behind the tunnel.

## Where things are
- Build order / phases → `docs/product.md` (Roadmap). **Start at Phase 1.**
- Monorepo layout → `docs/repo-structure.md`
- Data model / Prisma → `docs/data-model.md`
- Module specs → `docs/modules/*.md`
- API patterns → `docs/api-conventions.md`
- Real-time editing → `docs/realtime.md`
- Infra & deploy → `docs/infrastructure.md`, `docs/deployment.md`
- Conventions → `docs/coding-standards.md`

## Commands
- `pnpm install` · `pnpm dev` · `pnpm build` · `pnpm test` · `pnpm lint` · `pnpm typecheck`
- DB: `pnpm db:migrate` · `pnpm db:studio` · `pnpm db:seed`

## Before you code
1. Read the relevant `docs/modules/*.md` and `docs/data-model.md`.
2. Follow `docs/coding-standards.md` (strict TS, Vitest, Conventional Commits).
3. Add or update tests. Keep each PR scoped to a single module where possible.

## Quick conventions
- Files kebab-case · types/interfaces PascalCase · vars/functions camelCase.
- One tRPC router per module under `packages/api/src/routers/`.
- Never edit generated output (Prisma client, `*.generated.ts`).
