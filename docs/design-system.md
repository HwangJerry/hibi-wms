# Design system

How Claude Design mockups become real, consistent UI — without drifting across screens
that were each generated independently.

## Principle
**One canonical source of truth.** Claude Design will never export byte-identical CSS
twice — every screen it generates has its own slightly different grays, slightly
different hex for "the accent." If each mockup were implemented literally, the app would
accumulate dozens of near-duplicate colors and spacing values. The fix: mockups are
*reference input*, never *implementation*. Tokens and components live in one place
(`packages/ui`) and every mockup gets reconciled into that one place, not copied from.

Any UI work must follow this pipeline before it is consumed from `apps/web`. Do not
skip straight from a mockup to app code.

## Where things live
```
design/mockups/*.html         # raw Claude Design exports — reference only, never shipped
scripts/extract-tokens.js     # parses mockup CSS vars, diffs against canonical tokens
packages/ui/
  tokens/tokens.json           # canonical source of truth (light + dark)
  tokens/tokens.css            # generated: :root / .dark CSS variables — never hand-edit
  tokens/tailwind-preset.ts    # generated: maps tokens.json to Tailwind theme — never hand-edit
  src/primitives/              # shadcn-based atoms: Button, Input, Tabs, Avatar, ...
  src/components/              # composites specific to this app: StatusPill, DenseTable,
                                #   SlideOver, CommandPalette, KpiTile, AccountTile, ...
  .ladle/                       # component catalog config
apps/web/                      # consumes packages/ui only — no inline hex, no ad-hoc spacing
```

## The pipeline, per screen
1. **Design** the screen in Claude Design; export HTML.
2. **Save** it to `design/mockups/<screen-name>.html` and commit. Plain text, small diff,
   easy to review.
3. **Extract**: run `pnpm tokens:extract`. The script (`scripts/extract-tokens.js`) reads
   every mockup's `:root` / `.dark` CSS variables and writes `tokens.proposed.json` with a
   report of four categories — it never touches the canonical file:
   - **New tokens** — a name that doesn't exist in `tokens.json` yet.
   - **Changed tokens** — an existing name with a different value than canonical.
   - **Near-duplicate colors** — a new color within a small RGB distance of an existing
     token under a different name (the most common source of drift — e.g. exporting
     `--panel-bg: #f5f5f6` when `--surface-2: #f6f6f7` already means the same thing).
   - **Cross-mockup conflicts** — two different mockup files disagree on what the same
     token name means (e.g. one export's `--border` isn't quite the other's).
4. **Reconcile**: a human reads the report and decides, per entry: accept as new, reuse an
   existing token instead (near-duplicates), or pick/average a value (conflicts). Hand-merge
   the accepted result into `tokens.json`. This step is intentionally manual — token meaning
   is a judgment call a script shouldn't make silently.
5. **Generate**: run `pnpm tokens:build` to regenerate `tokens.css` and `tailwind-preset.ts`
   from `tokens.json`. Nothing downstream ever hand-edits generated files.
6. **Implement**: build or extend the needed component(s) in `packages/ui`. Compose shadcn
   primitives with token-driven Tailwind classes — never a literal hex or arbitrary px value
   in component code.
7. **Catalog**: add or update a Ladle story for the component, rendered in both light and
   dark. This is the verification surface — open the story next to the original mockup file
   and compare directly.
8. **Consume**: once the story matches the mockup, wire the component into the relevant
   `apps/web` screen. The app imports from `packages/ui` only.

In short: save the screen's Claude Design HTML to `design/mockups/`, run
`pnpm tokens:extract`, hand-reconcile new, changed, near-duplicate, and conflict tokens
into `packages/ui/tokens/tokens.json`, run `pnpm tokens:build`, build or extend the
component in `packages/ui`, add light and dark Ladle stories that match the mockup, and
only then consume the component from `apps/web`.

## Reuse-before-new rules
- **Color**: if `extract-tokens` flags a near-duplicate, reuse the existing token. Don't
  let "this export's gray" become a fourth gray.
- **Component**: before building a new composite, check `packages/ui/src/components` for
  something close (another dense table, another slide-over) and extend it with a prop
  rather than forking. A component is "new" only if no existing one reasonably fits.
- **Naming**: token names describe *role*, not *appearance* — `surface-2`, `status-pending`,
  `text-secondary`, not `gray-2` or `amber`. Roles stay stable even if the exact hex shifts.

## Definition of done (per component)
A component isn't finished until all of these are true: it's token-driven (no literal
colors/spacing), it has a Ladle story for light and dark, the story visually matches its
source mockup, and `apps/web` consumes it rather than reimplementing it inline.

## Governance (lightweight, for two people)
- `tokens.json`, `tokens.css`, and `tailwind-preset.ts` only change through the pipeline
  above — no ad-hoc edits during a feature PR.
- Changing a *foundational* token (the accent color, base surfaces) affects every screen —
  treat it as a design decision both partners sign off on, not a side effect of one mockup
  export.
- Mockup HTML stays in `design/mockups` indefinitely as the historical "why" behind a token,
  even after its component ships.
