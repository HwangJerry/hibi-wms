# packages/ui/tokens

`tokens.json` is the **single canonical source of truth** for color tokens (light + dark).

Pipeline:
1. `pnpm tokens:extract` runs `scripts/extract-tokens.js` against `design/mockups/*.html`
   and writes `tokens.proposed.json` — a diff report, never an auto-merge.
2. A human reviews the proposal (new / changed / near-duplicate / cross-mockup-conflict)
   and hand-merges accepted entries into `tokens.json`.
3. A generator (implement alongside the UI package — see `docs/design-system.md`) turns
   `tokens.json` into `tokens.css` (`:root` + `.dark` CSS variables) and a Tailwind preset
   `tailwind-preset.ts`, both consumed by `apps/web` and this package. Never hand-edit
`tokens.css` or `tailwind-preset.ts` — they're generated.

## Component-level constants

Keep `tokens.json` limited to shared semantic colors that should apply across the
product. Do not add one-off component geometry to the global token file.

Mockup-derived layout values that only make sense inside one component should
live near that component as named constants. For example, `BacklogList` owns its
fixed table geometry:

- `BACKLOG_LIST_GRID_COLUMNS`
- `BACKLOG_LIST_HEADER_HEIGHT`
- `BACKLOG_LIST_ROW_HEIGHT`
- `BACKLOG_LIST_CHECKBOX_SIZE`
- `BACKLOG_LIST_SELECTION_INDICATOR_WIDTH`

These values encode the Backlog list mockup's fixed row and column proportions.
They should only be promoted into global density or layout tokens after the same
values are reused by multiple unrelated components with the same semantic role.

## Raw visual value audit exceptions

The visual parity gate fails raw hex values everywhere. Pixel geometry is allowed
only in the files below, where the values are component-local geometry or
third-party/editor integration styling that should not become global tokens yet.

<!-- visual-audit-allow:start -->
- `apps/web/src/app.tsx` — visual parity command-palette fixture frame geometry used only by `/visual/command-palette`.
- `apps/web/src/features/docs/docs-page-editor.tsx` — Yjs remote cursor inline DOM styling; values are required by the editor decoration API.
- `packages/ui/src/components/account-tile.tsx` — tile-local numeric typography values from the finance mockup.
- `packages/ui/src/components/approval-panels.tsx` — approval table/action column widths and activity timeline marker size.
- `packages/ui/src/components/backlog-board.tsx` — board-card drag handle typography.
- `packages/ui/src/components/backlog-list.tsx` — exported Backlog list component constants for fixed dense-list geometry.
- `packages/ui/src/components/balance-over-time-chart.tsx` — chart viewport height derived from the finance dashboard mockup.
- `packages/ui/src/components/command-palette.tsx` — command palette overlay offset, width/height, and keyboard hint typography.
- `packages/ui/src/components/dense-table.tsx` — dense table header typography from data-table mockups.
- `packages/ui/src/components/docs-page-tree.tsx` — docs tree disclosure/action control sizes.
- `packages/ui/src/components/finance-dashboard.tsx` — finance dashboard chart/table column widths and responsive chart split.
- `packages/ui/src/components/finance-transactions-table.tsx` — finance transaction table column widths.
- `packages/ui/src/components/kpi-tile.tsx` — KPI tile-local numeric typography values from finance mockups.
- `packages/ui/src/components/notification-bell.tsx` — notification popover badge and metadata microcopy sizes.
- `packages/ui/src/components/reference-links.tsx` — reference chip microcopy size.
- `packages/ui/src/components/slide-over.tsx` — generic slide-over width from detail mockups.
- `packages/ui/src/components/task-detail-slide-over.tsx` — task detail panel width from task-detail mockup.
- `packages/ui/src/components/workspace-shell.tsx` — app shell/sidebar/topbar dimensions from shell mockups.
- `packages/ui/src/primitives/avatar.tsx` — avatar size-specific microcopy sizes.
<!-- visual-audit-allow:end -->
