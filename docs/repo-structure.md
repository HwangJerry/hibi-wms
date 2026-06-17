# Repo structure

Turborepo monorepo with pnpm workspaces.

```
.
├── AGENTS.md
├── docs/
├── package.json            # workspace root, shared scripts
├── pnpm-workspace.yaml
├── turbo.json
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
│   ├── auth/               # Lucia setup, session helpers
│   └── config/             # shared eslint/tsconfig/tailwind presets
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
- `apps/web` imports the tRPC `AppRouter` type only (no server code).
