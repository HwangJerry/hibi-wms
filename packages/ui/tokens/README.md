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
