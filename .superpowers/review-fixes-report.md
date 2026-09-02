# Review-fix report — feat/v2011-parity-rewrite

All eight findings (B1–B8) fixed. Gate: `npm run typecheck` clean, `npm test` 218 passing (was 187), `npm run build` succeeds, `npm run check:bundle` passes, `npm audit` 0 vulnerabilities, all 23 golden-roundtrip tests still green.

## B1 — block scalar emitted unloadable YAML for leading-space content

`src/serialize/blockScalar.ts`: `isUnsafeForLiteralBlock` now rejects a decoded value whose first line starts with a space, leaving the original double-quoted scalar untouched instead of converting it. Chose "leave quoted" per the finding's stated preference.

Evidence: `npx vitest run src/tests/block-scalar.spec.ts` — new test "leaves a value whose first line starts with a space double-quoted instead of emitting unloadable YAML" passes; `yaml.load(applyBlockScalars(yaml.dump({x:"  indented\nsecond"})))` now equals `{x: "  indented\nsecond"}` instead of throwing.

## B2 — block scalar corrupted every escape except \n \" \\

`unescapeDoubleQuoted` no longer hand-decodes escapes. It reconstructs the original quoted token (`` `"${inner}"` ``) and lets `yaml.load` parse it — js-yaml's own double-quoted-scalar rules, guaranteed consistent with what `yaml.dump` produced. This covers `\t \r \b \f \0 \/ \xNN \uNNNN` and anything else js-yaml can emit, with no manual escape table to keep in sync.

Investigation surfaced a real YAML constraint: a literal `|` block scalar cannot safely hold `\r` or other C0 control chars (js-yaml throws "non-printable characters" / "null byte not allowed", or in `\r`'s case produces YAML whose structure differs from the string). `isUnsafeForLiteralBlock` therefore also declines the block-scalar conversion for decoded content matching `/[\x00-\x08\x0B-\x1F]/` (i.e. `\r`, NUL, backspace, form-feed, etc. — everything but `\t`/`\n`), falling back to the quoted form for those, which round-trips correctly via its own escapes. `\t`, `/`, and non-ASCII characters (`é` etc.) are all safe in a literal block and still get the pretty block-scalar treatment.

Evidence: new tests in `src/tests/block-scalar.spec.ts` — tab+non-ASCII round-trips as a block scalar; a value containing `\r` round-trips correctly while staying quoted; a list item with an embedded tab round-trips as a block scalar.

## B3 — VisualActionEditor wrote malformed multi-entry conditional/random branches

Fixed as part of the B8 rewrite: `serializeAction`'s `conditional` case now builds a real `{kind:"conditional", check, whenTrue, whenFalse}` and calls `grammar.ts`'s `serializeActionBlock`, whose `appendBranch` already indents every line of every child action (not just the first). `random` no longer has a "branch" concept at all after B4 (see below), so the original two-line-only-indented bug for random is moot — that code path was deleted.

Evidence: `src/tests/visual-action-editor.spec.ts` — "indents every line of a two-entry true branch, not just the first": builds a conditional with 2 entries in `true:`, serializes via `serializeAction`, reparses via `parseActionBlock`, asserts both entries survive as distinct `{kind:"lines", id:"message", ...}` actions.

## B4 — `random`'s shape was wrong in the contract and the editor

- **(a)** `src/plugin/actions.ts`: `random.formatExample`/`placeholder` now use the real flat `@weight`-suffixed list (modeled on `advanced_flow.yml`'s `loot_roll` button); `nestedBlockLabels` removed and `hasNestedBlocks: false` (it isn't a nested-groups shape).
- **(b)** `src/actions/VisualActionEditor.tsx`: deleted `splitRandomBlocks` and the `random`-specific branches in both `parseAction` and `serializeAction`. `random` now falls through to the same flat `lines`-based path as `message`/`command`/etc. (its raw shape — `random { - "..." }` — is structurally identical to those). `src/actions/ActionBlock.tsx`: `random` no longer renders the two-group nested UI (`hasNested = isConditional` only); it gets the ordinary "Values (one per line)" editor with the corrected placeholder.
- **(c)** Contract test added to `src/tests/plugin/actions.spec.ts`: every `ACTIONS[id].formatExample` must parse to a non-`raw` `ParsedAction` via `parseActionBlock`.

  **This test caught a second broken example beyond `random`: `conditional`'s formatExample had unescaped inner quotes** (`"message { - \"You have permission!\" }"` was written without escaping the nested quotes for the *outer* YAML double-quoted scalar, so `yaml.load` treated the string as ending at the first inner `"`, producing invalid YAML and a `raw` parse). Fixed by escaping the nested quotes (`\\"` in the JS source, i.e. `\"` in the actual YAML) so the nested `message { ... }` block round-trips through `yaml.load` correctly. All 14 actions' examples now parse non-raw.

Evidence: `npx vitest run src/tests/plugin/actions.spec.ts` (8/8, including "every action's formatExample parses to a non-raw ParsedAction") and `src/tests/visual-action-editor.spec.ts` ("reads and writes the flat weighted-list random shape (no 1:/2: groups)").

## B5 — schema strictness locked users out of their own in-progress project

`src/core/schemas.ts`: relaxed `bedrockButtonSchema.text` (`.min(1)` → none), `bedrockSimpleSchema.buttons` (`.min(1)` → none), `bedrockModalSchema.buttons` (`.length(2)` → none), `bedrockCustomSchema.components` (`.min(1)` → none). `parseProject`'s id/uniqueness/`activeFormId` refinements are untouched — those remain genuine structural-integrity checks.

`src/plugin/limits.ts`: added `minButtonsPerForm: 1`, `minComponentsPerForm: 1`. `src/panels/ValidationPanel.tsx`: added error-level checks for SIMPLE with fewer than `minButtonsPerForm` buttons, CUSTOM with fewer than `minComponentsPerForm` components, and any SIMPLE/MODAL button with empty/whitespace-only text — so the panel now flags every state the schema newly accepts.

Updated tests that asserted the old (now-intentionally-wrong) rejection behaviour rather than deleting coverage:
- `src/tests/migrate.spec.ts`: "a hand-corrupted legacy save (MODAL with 3 buttons) still fails parseProject" → replaced with a test asserting it now **succeeds** (work-in-progress), plus a new test using a genuinely malformed `bedrock.type` to prove real corruption still fails.
- `src/tests/ui.spec.tsx`: the "refuses to load a legacy save..." and "refuses to save an invalid project..." tests were changed to use a genuinely invalid `bedrock.type` (still correctly refused) instead of the now-valid 3-button-MODAL / 0-component-CUSTOM fixtures; two new tests added proving those work-in-progress states now load/save successfully.

Added acceptance tests in `src/tests/schemas.spec.ts` and `src/tests/projectSchemas.spec.ts` (3-button MODAL, 0-button SIMPLE/MODAL, 0-component CUSTOM, empty button text — all now accepted) and panel-coverage tests in `src/tests/validation-panel.spec.tsx` (each of those states still reported as an error by `ValidationPanel`).

Evidence: `npx vitest run src/tests/schemas.spec.ts src/tests/projectSchemas.spec.ts src/tests/validation-panel.spec.tsx src/tests/migrate.spec.ts src/tests/ui.spec.tsx` — all pass (41 tests across the five files).

## B6 — dropping a palette item could create an invalid component type

`src/core/types.ts`: added `BEDROCK_COMPONENT_TYPES` and the `isBedrockComponentType` guard (single source of truth for the real `input | slider | dropdown | toggle` union). `src/app/DndHost.tsx`: extracted the drop-creation logic into an exported, pure `computeDropResult(bedrock, overId, dropType)` that validates the dropped type against `isBedrockComponentType` before creating a component (dropping `"label"` or any other unknown type is now a no-op) and reuses the shared `nextSequentialId` (see B7) for both buttons and components. `src/panels/Palette.tsx`: removed the "Label" tile entirely (the plugin has no label component) and excluded the "Button" tile on non-SIMPLE forms (previously shown, undisabled, on CUSTOM).

Evidence: `src/tests/dnd-host.spec.ts` (new) — direct unit tests on `computeDropResult`: a `label` drop and an unknown-type drop onto a CUSTOM form both return `null` (no component created); a valid type creates one; a `button` drop onto a CUSTOM form's component zone is ignored; a SIMPLE button drop still works. `npx vitest run src/tests/dnd-host.spec.ts` — 5/5 pass.

## B7 — Add-button minted colliding ids, silently losing a button on export

`src/core/ids.ts` (new): `nextSequentialId` moved out of `DndHost.tsx` into a shared module, imported by both `DndHost.tsx` and `PropertiesPanel.tsx` (no duplication). `src/panels/PropertiesPanel.tsx`'s "Add" button now calls `nextSequentialId("button", bedrock.buttons.map(b => b.id))` instead of `button_${length+1}`, so a slot left empty by a prior removal is correctly reused without colliding with a surviving button. The free-form id-rename input (line ~141) now refuses (silently, consistent with the existing `renameForm` convention in `projectSlice.ts`) a rename that collides with another button's id, and trims/rejects an empty id.

Evidence: `src/tests/ui.spec.tsx` — two new tests: "mints a unique id when Add reuses a removed button's slot, so no button is lost on export" (2 buttons → remove first → add → both ids unique, both buttons — including the original "Second" — present) and "refuses a button id rename that collides with an existing button id" (rename attempt is a no-op, both original ids survive). `npx vitest run src/tests/ui.spec.tsx` — 11/11 pass.

## B8 — nested conditionals were destroyed on first edit

`src/actions/VisualActionEditor.tsx`: `parseAction`'s `conditional` branch and `serializeAction`'s `conditional` branch now delegate entirely to `parseActionBlock`/`serializeActionBlock` from `src/plugin/grammar.ts` instead of the line-based, nesting-unaware `splitConditionalBlocks` (deleted). Each branch entry (`trueLines`/`falseLines`) is now the independently-`serializeActionBlock`'d raw text of one child `ParsedAction`; on serialize, each entry is independently `parseActionBlock`'d and the whole conditional is rebuilt via `serializeActionBlock`, which correctly recurses into further nesting (a conditional inside a conditional, as in the fixture). This was a bounded fix at the boundary (adapting to grammar.ts's shape), not a rewrite of the editor's UI model — no STOP/BLOCKED needed.

Residual note (not a regression, pre-existing and out of this fix's scope): if a user directly edits a conditional branch's textarea by hand while it contains a multi-line nested entry, the textarea's join/split now uses a `\n---\n` sentinel (`BRANCH_ENTRY_SEPARATOR` in `ActionBlock.tsx`) instead of raw `\n`, so multi-line entries survive an actual edit to that field, not just an untouched round-trip. The placeholder text explains the convention.

Evidence: `src/tests/visual-action-editor.spec.ts` — "round-trips the real nested_conditional action from advanced_flow.yml without flattening": parses the fixture's `nested_conditional` button's actual `onClick[0]` raw string (an outer conditional containing an inner conditional) through `parseAction` → `serializeAction`, and asserts `parseActionBlock` of the result is deep-equal to `parseActionBlock` of the original — i.e. the nested structure (check strings, `whenTrue`/`whenFalse` at both levels) is bit-for-bit preserved, not flattened.

## Gate output (final run)

```
npm run typecheck   → tsc --noEmit: clean, no output
npx vitest run       → Test Files  27 passed (27) / Tests  218 passed (218)
npm run build        → vite build: ✓ 337 modules transformed, ✓ built in 359ms
npm run check:bundle → largest js: vendor-DVeowPF5.js (287.01 kB); largest css: index-M3CE4fDp.css (44.83 kB) — pass
npm audit --omit=dev → found 0 vulnerabilities
npx vitest run src/tests/golden-roundtrip.spec.ts → 23/23 passed
```

No fixture in `src/tests/fixtures/plugin-forms/` was modified. No branch/merge/push performed.
