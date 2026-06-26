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
- **UI is token-driven.** No inline hex/spacing in `apps/web` — only `packages/ui` tokens/components. Mockups in `design/mockups` are reference only, never shipped.
- **Extend the working repo in place.** Inspect current state first, read touched files, preserve working code, and reconcile with existing behavior instead of replacing it to fit a spec.
- **Keep the build green.** Run `pnpm typecheck` and relevant tests before and after changes; after each task, review the diff and run `pnpm typecheck && pnpm lint && pnpm test`. Before committing, pushing, or deploying, ask the user whether to proceed.
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
- Design tokens/components pipeline → `docs/design-system.md`
- Conventions → `docs/coding-standards.md`

## Commands
- `pnpm install` · `pnpm dev` · `pnpm build` · `pnpm test` · `pnpm lint` · `pnpm typecheck`
- DB: `pnpm db:migrate` · `pnpm db:studio` · `pnpm db:seed`

## Before you code
1. Inspect current state: list files, read the files the task touches, run `pnpm typecheck`, and run the relevant tests.
2. Read the relevant `docs/modules/*.md` and `docs/data-model.md`.
3. Extend and reconcile in place. Never delete or overwrite working code to fit a spec; if existing code already satisfies part of a task, modify it minimally.
4. If existing code conflicts with the docs, stop and report the conflict in your summary instead of silently replacing it.
5. Follow `docs/coding-standards.md` (strict TS, Vitest, Conventional Commits).
6. Add or update tests. Keep each PR scoped to a single module where possible.
7. After each task, review the diff and run `pnpm typecheck && pnpm lint && pnpm test`.
8. When work is complete, ask the user whether to:
   - commit the changes with a Conventional Commit message;
   - push the commit to the remote branch;
   - run the `deploy-k3s-portal` Codex skill to deploy to the k3s cluster from this host.

## Quick conventions
- Files kebab-case · types/interfaces PascalCase · vars/functions camelCase.
- One tRPC router per module under `packages/api/src/routers/`.
- Never edit generated output (Prisma client, `*.generated.ts`).
