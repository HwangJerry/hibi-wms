# WMS Documentation

Reference docs for building **WMS**, an internal work-management app for two business partners.
`AGENTS.md` (repo root) is the always-loaded summary; these files hold the detail.

## Reading order
1. `product.md` — what we're building, for whom, and in what order (phases).
2. `architecture.md` — the modular monolith and how requests flow.
3. `tech-stack.md` — exact technologies and versions.
4. `repo-structure.md` — where code lives.
5. `data-model.md` — the database schema and shared primitives.
6. `modules/` — one spec per feature module.
7. `api-conventions.md`, `realtime.md` — implementation patterns.
8. `infrastructure.md`, `deployment.md` — how it runs and ships.
9. `design-system.md` — how Claude Design mockups become real, token-driven UI.
10. `coding-standards.md` — style, testing, commits.

## Conventions for these docs
- Specs describe **intent and contracts**, not line-by-line code.
- Code snippets are illustrative shapes, not final implementations.
- When a doc and `AGENTS.md` disagree, the doc is authoritative.
