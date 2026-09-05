# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page visual designer (React 19 + TypeScript + Vite + Tailwind) for authoring **Minecraft Bedrock GUI forms** for the BedrockGUI server plugin. The user designs a form visually and the app exports a YAML config that the plugin consumes. The app is client-only and deploys to Cloudflare.

Note: the project was originally dual-platform (Java + Bedrock). Java support has been removed, and the `Platform` type with it — Bedrock is the only target. Do not reintroduce a Java code path.

## Commands

```bash
npm run dev          # Vite dev server on :5173
npm run build        # typecheck THEN vite build (build fails on type errors)
npm run typecheck    # tsc --noEmit, no build
npm test             # vitest run (unit/integration, jsdom)
npm run test:ui      # vitest watch mode
npm run e2e          # Playwright e2e (auto-starts dev server, runs chromium/firefox/webkit)
npm run check:bundle # bundle-size guard (scripts/check-bundle.mjs)
npm run deploy       # wrangler deploy (Cloudflare)
npm run verify       # the full gate: typecheck + test + build + check:bundle + chromium e2e
```

Run a single unit test:
```bash
npx vitest run src/tests/golden-roundtrip.spec.ts   # one file
npx vitest run -t "has all seven fixtures"          # by test name
```
Run a single e2e test: `npx playwright test e2e/basic.spec.ts -g "name"`.

`npm run verify` is the full pre-merge gate and should be run before finishing any branch of work — it is not wired into `npm test` because e2e needs a dev server and is slow; keeping the fast unit suite fast is what makes people actually run it.

Unit/integration specs live in `src/tests/*.spec.{ts,tsx}` (config: `vitest.config.ts`, setup `src/tests/setup.ts`). E2e specs live in `e2e/` (config: `playwright.config.ts`). These are two separate runners — vitest never picks up `e2e/`.

## Architecture

### The plugin contract — `src/plugin/`
`src/plugin/` is the single versioned source of truth for BedrockGUI **2.0.11** (`PLUGIN_TARGET` in `src/plugin/index.ts`) and is the file a newcomer most needs to read first. It is data-only — it imports nothing from the app (only `js-yaml` and its own static data tables) — and everything else in the codebase derives from it:
- `actions.ts` — the **14** real action types, all of which the picker always offers (`command`, `open`, `message`, `delay`, `server`, `broadcast`, `inventory`, `sound`, `economy`, `title`, `actionbar`, `conditional`, `random`, `bungee`), each with a capability gate (`always` / `commandExecutor` / `sound` / `economy` / `title`) resolved per platform. **There is no `url` action** — it was removed from the plugin and must never be reintroduced; the designer shipped it by mistake until this rewrite.
- `grammar.ts` — parses and serializes the `type { … }` action-block text (`parseActionBlock` / `serializeActionBlock`), including the nested `conditional` and `random` shapes and the `bungee` subchannel form. `VisualActionEditor` and `src/core/validateProject.ts` both consume it. An `ActionInstance` still round-trips through YAML via its `raw` string; the grammar is what structures that string for the typed editors.
- `conditions.ts` — operators and validation for `show_condition` / conditional-check strings (`permission:`, `placeholder:`, `plugin:`, `bedrock_player:`, `java_player:`, `not:`).
- `placeholders.ts`, `images.ts`, `addons.ts`, `keys.ts`, `limits.ts`, `platforms.ts` — builtin placeholder tokens, button-image classification, the addon **action types** (see below), the camelCase→snake_case key tables, plugin-enforced limits, and platform capability gating, respectively. `parse/form.ts` and `serialize/form.ts` read every plugin key name from `keys.ts`, including the `bedrock`/`java` document envelope in `DOCUMENT_KEYS`. Renaming a constant breaks the golden tests — except for `permission`, `description` and `alternativeOnClick`, which appear in no fixture and are pinned instead by `src/tests/plugin/keys.spec.ts` plus direct parse/serialize tests. `CONFIG_KEYS` is declared but not yet wired: `parse/config.ts` still spells those keys inline.

**Addon ids are action types, not menu names.** `addons.ts` lists what each addon registers via `registerActionHandler` — `bw_shop_main`, `hs_region_menu`, `pd_duel` and the rest. They are written as their own action in **colon form** — `bw_shop_main:` , or `bw_shop_cat:<value>` where the handler reads one — never as an `open` target, and never in brace form: `ActionExecutor.parseNewFormat` returns null when a `{ }` block holds no `- "…"` entry, and the addons' own `getUsageExamples()` return the colon shape. Beware: `open` resolves through `FormMenuUtil.hasMenu`, which knows only the forms declared under `forms:` in `config.yml`, so `open { - "bw_shop_main" }` fails at runtime **even with the addon installed**. The contract called this field `formIds` until the whole-branch review; the data was right and the noun was wrong, and every consumer inherited the error — the designer both offered a construct that always fails and rejected the one that works. Keep the naming honest.

### Data model
`src/core/project.ts` defines the top-level model: a `Project` (`pluginTarget`, `configVersion: 1`, `assets`, `platformTarget` — **vestigial**: validated and persisted, but nothing sets it any more and nothing reads it, kept only so saved projects still parse, `activeFormId`) holds many `FormDoc`s (`id`, `fileName`, `bedrock: BedrockForm`, optional `javaRaw` — an opaque `java:` block preserved verbatim through parse/serialize for forms that still carry one, never interpreted). `FormSwitcher` in the left sidebar edits many forms in one project. `src/core/projectSchemas.ts` (`parseProject`) validates a whole `Project`, built on the per-shape Zod schemas in `src/core/schemas.ts`.

`src/core/types.ts` is the canonical per-form model. `BedrockForm` is a discriminated union on `type`:
- `SIMPLE` / `MODAL` → `buttons: BedrockButton[]`. **MODAL is not normalized to 2 buttons.** The parser keeps whatever the file says, and `ValidationPanel` reports a mismatch as an error — deliberately, so a real config problem isn't hidden.
- `CUSTOM` → `components: BedrockComponent[]` (`input | slider | dropdown | toggle`, free-form `props`)

Both buttons and components carry `ActionInstance[]` (onClick / action), and the form can have top-level `globalActions`.

### State
`src/store/` composes the Zustand store from slices: `projectSlice` (`Project` CRUD — `loadProject`, `setActiveForm`, `addForm`, `renameForm`, `duplicateForm`, `removeForm`, `setBedrock`, `setGlobalActions`, `setAssets`, `setPlatformTarget`), `selectionSlice`, `historySlice`, `uiSlice`, combined in `src/store/index.ts`. `src/core/store.ts` is now a one-line re-export shim kept for import-path compatibility.

History has two stacks. `setBedrock` and `setGlobalActions` call `pushHistory`, which is **per form**, keyed by form id; the structural actions (`addForm`, `renameForm`, `duplicateForm`, `removeForm`, `setAssets`, `setPlatformTarget`) call `pushProjectHistory`, which snapshots the whole `Project`. Mutating state outside the store actions breaks history regardless.

`undo`/`redo` read **only the active form's stack** and return untouched when it is empty — Ctrl+Z never reaches another form or the project. An earlier revision made them span every stack, which fixed a real bug (an empty active stack fell through to the project branch *unconditionally* and deleted the form on screen) by widening scope, and the widened scope was its own complaint: one Ctrl+Z could revert work done anywhere. The fallthrough was the bug, not the scoping. It is unreachable now because there is no project branch left inside `undo()` at all.

Structural changes are undone by `undoProject`/`redoProject`, reached from the toast raised when a form is **deleted** (only deletion — a toast per structural action is noise) and from the History panel's Project section. `undoProject` takes an optional pinned timestamp so a stale toast cannot pop a newer entry. `TopBar` and `HistoryPanel` both ask `activeFormStack` what Ctrl+Z will do, so the buttons cannot describe something else.

There is **no coalescing**: one push, one undo step. An earlier revision collapsed consecutive same-description pushes, which reordered entries past interleaved structural changes and merged genuinely unrelated actions, because a description is not an identity — two "Add" clicks share one. An editor that would otherwise write per keystroke buffers its own commits instead. Per-form undo is capped at 100 entries, project history at 20.

### YAML round-trip — the core contract
The old single `src/core/yaml.ts` is gone, split into `src/parse/{form,config,legacy}.ts` and `src/serialize/{form,config,blockScalar}.ts`:
- `parse/form.ts` (`parseFormDocument`) / `serialize/form.ts` (`serializeFormDocument`) — one form file. Reads/writes snake_case plugin keys (`show_condition`, `command_intercept`, `alternative_text`, …) against the camelCase model. Export emits `content:` (**never** `description:`) and no config version — `translations`, `priority` and `priority_condition` are never emitted, because the plugin does not read them.
- `parse/config.ts` — reads a `config.yml` on import: `config-version: 1`, `assets`, and the form registry. **The designer does not export a `config.yml`.** It exports one file per form and then shows a modal with the lines to paste into the server's own config, built by `serialize/configSnippet.ts`. `serializeConfigDocument` in `serialize/config.ts` is therefore dead by design — it has no caller and is not meant to acquire one.
- `parse/legacy.ts` (`parseLegacyInlineConfig`) — the older all-in-one shape where every form is inlined under a top-level `forms:` key.
- `serialize/blockScalar.ts` (`applyBlockScalars`) — post-processes js-yaml's escaped multi-line strings into `|`/`|-` block scalars.
- `js-yaml` is at **5.x** and ESM-only: `import * as yaml from "js-yaml"`; the dump option is `quoteStyle: "double"`.

**Golden tests are the authority.** `src/tests/fixtures/plugin-forms/` holds byte-exact copies of the seven form files BedrockGUI 2.0.11 actually ships, and `src/tests/golden-roundtrip.spec.ts` parses and re-serializes each. Note what it does and does not check: it compares **semantically** (`yaml.load` on both sides), so it catches a dropped or renamed key but not a change in key order or formatting — `src/tests/block-scalar.spec.ts` is the only guard on output shape. Its idempotence assertion cannot catch a key rename at all, since parse and serialize share the constant and go wrong together; only the comparison against the original fixture can. Changing parse or serialize means keeping those green — never edit the fixtures to make a test pass.

### Actions system
`src/actions/` (`ActionPicker`, `ActionBlock`, `VisualActionEditor`) is the visual editing UI and reads `src/plugin/actions.ts` directly — there is no separate `registry.ts` / `types.ts` / `ActionEditor.tsx` layer. `VisualActionEditor` parses and rebuilds each block through `grammar.ts`, and dispatches to the typed editors in `src/actions/editors/` (`LinesEditor`, `ConditionalEditor`, `RandomEditor`, `BungeeEditor`, `RawEditor`) on the parsed `ParsedAction.kind`.

### Validation
`src/core/schemas.ts` holds the Zod schemas mirroring the per-form model shapes (used by `projectSchemas.ts` and for legacy-project migration in `src/core/migrate.ts`). The drop rule (e.g. components only droppable on CUSTOM forms) is inlined in `src/app/DndHost.tsx`, not a separate module. The live validation surfaced to the user is in `src/panels/ValidationPanel.tsx`, which defers to `src/plugin/` for its checks — known action ids from `actions.ts`, condition syntax from `conditions.ts`, image-source classification from `images.ts`, and the modal button count from `limits.ts` — rather than hand-maintaining duplicates. Above the per-form issues it renders a **Project** section from `src/core/validateProject.ts`: unresolvable `open` targets, addon action ids misused as `open` targets, `open` arguments that are not usable menu names, duplicate file names, and forms nothing can reach.

`validateProject` mirrors `OpenFormActionHandler` rather than assuming every line of an `open` block is a menu. The plugin opens a chain only when **every** value is a valid, registered menu name; otherwise the first value is the menu and the rest are arguments passed to it. Reporting an argument as a missing menu would put an error on a correct config, so a tail that does not fully resolve is ignored entirely.

### UI composition
`App.tsx` → `DesignerShell.tsx` is a responsive 3-pane layout:
- Left: `FormSwitcher` (the project's forms) + `FormTypePanel` + `Palette` (component tabs) / `HistoryPanel`
- Center: `Canvas` (live `BedrockPreview`) + `ValidationPanel`
- Right: `PropertiesPanel` / `YamlEditorPanel` (live YAML view)

Drag-and-drop is `@dnd-kit`, wired through `src/app/DndHost.tsx`. Below 768px the layout collapses to a bottom tab bar (Tools / Preview / Props); `MobileWarning` also gates very small screens. Tailwind uses `brand-*` semantic color tokens (`brand-bg`, `brand-surface`, `brand-accent`, …).

Minecraft formatting is parsed in `src/core/minecraftText.ts` and rendered by the `MinecraftText` component — legacy `§`/`&` codes, `&#RRGGBB` hex, and MiniMessage tags (`<red>`, `<bold>`, `<#00FF00>`). Use these rather than re-implementing colour parsing. `hasMinecraftCodes` from the same module is what `BedrockPreview` uses to route between `MinecraftText` and `ReactMarkdown`, so a new syntax has to be taught to both or it renders as raw markup.

Button images resolve through `src/core/resolveImage.ts`, which classifies with `images.ts` and mirrors the plugin's `mapImageSource`: URLs, player heads, Mojang texture URLs and base64 skin blobs get a `src`; materials, potions and texture paths get a label instead, because the designer ships no Bedrock texture atlas.

### Cross-cutting UI utilities
Toasts (`src/core/toast.ts` + `ToastHost`) and confirm dialogs (`src/core/confirm.ts` + `ConfirmDialog`) are imperative singletons — call `toast(...)` / `confirm(...)` from anywhere instead of threading callbacks.

## Deployment
Static build → `dist/`. `npm run deploy` runs `wrangler deploy`, which serves `dist/` as Cloudflare Worker static assets (`wrangler.toml` binds `[assets] directory = "./dist"` to the Worker in `worker.ts`). SPA fallback (unmatched HTML GET/HEAD → `/index.html`) and security headers are implemented in `worker.ts` itself, not via a Pages `_redirects`/`_headers` file. `VITE_GA_MEASUREMENT_ID` is optional (analytics is skipped if unset). A Docker/nginx image (`Dockerfile`, `nginx.conf`) is also available for self-hosting.
