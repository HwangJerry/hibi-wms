# Architecture

## Shape: modular monolith
One deployable backend with strictly separated internal modules. Chosen because the
team is two people self-hosting — a monolith minimizes operational surface while
module boundaries keep the codebase clean. Do **not** split into microservices.

Modules: `backlog`, `approval`, `finance`, `docs`. Each owns its tables, services,
and tRPC router. Modules talk to each other only through exported **service
interfaces** — never by reading another module's tables directly.

## Cross-cutting primitives (shared by all modules)
- **Users / Sessions** — identity and auth context.
- **References** — a single polymorphic link table so any entity can point to any
  other (see `data-model.md`).
- **AuditLog** — append-only event record; mandatory for all financial writes.
- **Comments** and **Attachments** — attachable to any entity via References.

## Request flow
1. Browser → Cloudflare edge (optional Access gate, TLS terminates here).
2. → `cloudflared` tunnel connector (in-cluster, outbound-initiated).
3. → Traefik ingress (k3s default).
4. → one of: static **frontend**, **tRPC API** (HTTP), or **Hocuspocus** (WebSocket).
5. API/Hocuspocus → PostgreSQL. File uploads → Cloudflare R2.

Real-time documents bypass the tRPC API for editing: the frontend opens a WebSocket
straight to Hocuspocus, which persists snapshots to Postgres. Everything else
(backlog, approval, finance, doc metadata/permissions) goes through tRPC over HTTP.

## Key decisions (ADR-lite)
- **Generic approval engine.** One `ApprovalRequest` model with a `type` discriminator
  serves both finance and work, instead of duplicating sign-off logic. Reusable,
  consistent audit trail.
- **Approval-gated finance.** Transactions needing sign-off are created in a `pending`
  state and only affect balances after the linked approval is `approved`. Keeps money
  honest between partners.
- **Polymorphic references over per-pair join tables.** One link table keeps
  cross-module coupling out of schemas.
- **Single-replica real-time.** Hocuspocus holds live doc state in memory; one replica
  avoids needing a Redis sync layer. Acceptable for two users.
- **TLS at the edge.** Cloudflare terminates TLS; no cert-manager. Less to operate.
