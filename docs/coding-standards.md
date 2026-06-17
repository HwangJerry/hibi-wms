# Coding standards

## TypeScript
- `strict: true`. No `any` (use `unknown` + narrowing). No non-null `!` except where
  provably safe and commented.
- Prefer pure functions in services; keep side effects (db, network) at the edges.

## Naming
- Files: kebab-case. Types/interfaces/enums: PascalCase. Vars/functions: camelCase.
  Constants: UPPER_SNAKE. tRPC procedures: camelCase verbs (`list`, `create`, `approve`).

## Structure
- Router → service → repository(Prisma). Routers validate; services hold logic;
  Prisma access stays in the module.
- No cross-module imports except via a module's exported service interface.

## Working repo discipline
- This is an existing, working repo. Before changing code, inspect the current state:
  list files, read every file the task touches, run `pnpm typecheck`, and run the
  relevant tests for the area being changed.
- Extend and reconcile in place. Never delete or overwrite working code to fit a spec.
  If existing code already satisfies part of a task, keep the change minimal.
- If existing code conflicts with the docs, stop and report the conflict in the summary
  instead of silently replacing the implementation.
- The build must stay green after every task. After each task, review the diff, run
  `pnpm typecheck && pnpm lint && pnpm test`, then commit with a Conventional Commit
  message. Only then move on.

## Testing
- **Vitest** for unit/integration; aim to cover service logic and state machines
  (approval transitions, finance gating, ranking).
- **Playwright** for critical e2e flows (create task, co-edit a doc, approve a payment).
- Tests run in CI; a red test blocks merge.

## Commits & branches
- **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).
- Short-lived feature branches; PR into `main`. Keep PRs scoped to one module/phase.
- One focused PR per task. Tests and types must pass before commit.

## Lint/format
- ESLint + Prettier from `packages/config`. Fix on commit (lint-staged optional).

## Don'ts
- Don't hardcode "2 users", thresholds, or secrets.
- Don't bypass the approval gate for finance.
- Don't add a second Hocuspocus replica.
- Don't edit generated files or shipped migrations.
