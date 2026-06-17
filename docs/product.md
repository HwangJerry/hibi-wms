# Product

## Vision
A single private workspace where two business partners run the company: track work,
approve money and decisions, manage finances, and co-author documents in real time.
Trust and auditability matter as much as features — both partners must be able to
verify what happened and when.

## Users
- Exactly **two users** today (the partners). Both are developers and admins.
- Design for two, but don't hardcode "2" — model users as a normal table so a small
  team could be added later without a rewrite.

## Scope (v1)
- **Backlog**: tasks/epics with status, priority, assignee, board + list views.
- **Approval**: a generic request → sign-off engine used by both finance and work.
- **Finance**: accounts, categorized transactions, budgets, balances, reports.
  Financial changes that require sign-off are gated by Approval.
- **Docs**: a Confluence-style wiki — spaces, nested pages, real-time co-editing
  with live cursors, version history, comments.
- **Cross-links**: any entity can reference any other (a task → its spec doc → its
  budget approval).

## Out of scope (v1)
- Multi-tenant / org separation.
- Mobile native apps (responsive web is enough).
- External integrations beyond Cloudflare R2 for file storage.
- Email/SSO providers (auth is local; Cloudflare Access guards the perimeter).

## Glossary
- **ApprovalRequest** — a unit of sign-off with a type, requester, approver, state.
- **Reference** — a polymorphic link between any two entities.
- **AuditLog** — append-only record of significant actions, esp. financial.
- **Space / Page** — wiki container and document.
- **Awareness** — Yjs presence data (live cursors, selections).

## Roadmap (build order — start here)
**Phase 1 — Workspace foundation**
- Auth (sessions), Users.
- Backlog module (CRUD, board + list).
- Docs module with real-time editing (Yjs/Hocuspocus/TipTap), version history.
- Deployable to k3s behind Cloudflare Tunnel.

**Phase 2 — Money & sign-off**
- Approval engine (generic state machine + audit log).
- Finance module: accounts, transactions, categories, budgets.
- Approval-gated posting: a transaction posts to balances only once approved.

**Phase 3 — Insight & polish**
- Reports and dashboards (balances over time, budget vs actual).
- Notifications (in-app; pending approvals, mentions).
- Full-text search across docs and entities.
- Cross-entity reference UI and linking polish.

Build phases in order. Each phase should be independently deployable.
