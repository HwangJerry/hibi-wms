# Repo structure

Turborepo monorepo with pnpm workspaces.

```
.
├── AGENTS.md
├── docs/
├── design/
│   └── mockups/            # raw Claude Design HTML exports — reference only
├── package.json            # workspace root, shared scripts
├── pnpm-workspace.yaml
├── turbo.json
├── scripts/
│   └── extract-tokens.js   # mockup CSS vars -> tokens.proposed.json diff report
├── apps/
│   ├── web/                # React + Vite frontend
│   └── realtime/           # Hocuspocus WebSocket server
├── packages/
│   ├── api/                # tRPC routers + Fastify server (the monolith)
│   │   └── src/
│   │       ├── routers/    # one router per module: backlog, approval, finance, docs
│   │       ├── modules/    # module service layers (business logic)
│   │       ├── context.ts  # tRPC context (auth, db)
│   │       └── server.ts
│   ├── db/                 # Prisma schema, client, migrations, seed
│   ├── core/               # shared primitives: references, audit log, errors, ids
│   ├── auth/                # Lucia setup, session helpers
│   ├── ui/                  # design system: tokens, shadcn primitives, composites, Ladle catalog
│   │   ├── tokens/           # tokens.json (canonical), generated tokens.css + tailwind-preset.ts
│   │   └── src/
│   │       ├── primitives/   # Button, Input, Tabs, Avatar, ...
│   │       └── components/   # StatusPill, DenseTable, SlideOver, CommandPalette, ...
│   └── config/              # shared eslint/tsconfig/tailwind presets
└── infra/
    ├── helm/ or kustomize/ # k8s manifests
    ├── cloudflared/        # tunnel config
    └── scripts/            # backup, migrate jobs
```

## Rules
- Business logic lives in `packages/api/src/modules/*`, exposed to routers and to other
  modules via typed service functions. Routers stay thin (validation + call service).
- `packages/core` has no module-specific code. Modules may depend on `core`, never the
  reverse.
- `packages/db` owns the single Prisma schema; modules import the generated client.
- `apps/web` imports the tRPC `AppRouter` type only (no server code), and imports UI
  only from `packages/ui` — no inline hex colors or arbitrary spacing values. See
  `docs/design-system.md` for the full token/component pipeline.
