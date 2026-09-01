# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page visual designer (React 18 + TypeScript + Vite + Tailwind) for authoring **Minecraft Bedrock GUI forms** for the BedrockGUI server plugin. The user designs a form visually and the app exports a YAML config that the plugin consumes. The app is client-only and deploys to Cloudflare.

Note: the project was originally dual-platform (Java + Bedrock). Java support has been removed — `Platform` is now the single value `"bedrock"`. Do not reintroduce a Java code path.

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
```

Run a single unit test:
```bash
npx vitest run src/tests/golden-roundtrip.spec.ts   # one file
npx vitest run -t "has all seven fixtures"          # by test name
```
Run a single e2e test: `npx playwright test e2e/basic.spec.ts -g "name"`.

Unit/integration specs live in `src/tests/*.spec.{ts,tsx}` (config: `vitest.config.ts`, setup `src/tests/setup.ts`). E2e specs live in `e2e/` (config: `playwright.config.ts`). These are two separate runners — vitest never picks up `e2e/`.

## Architecture

### The plugin contract — `src/plugin/`
`src/plugin/` is the single versioned source of truth for BedrockGUI **2.0.11** (`PLUGIN_TARGET` in `src/plugin/index.ts`) and is the file a newcomer most needs to read first. It is data-only — it imports nothing from the app (only `js-yaml` and its own static data tables) — and everything else in the codebase derives from it:
- `actions.ts` — the **14** real action types (`command`, `open`, `message`, `delay`, `server`, `broadcast`, `inventory`, `sound`, `economy`, `title`, `actionbar`, `conditional`, `random`, `bungee`), each with a capability gate (`always` / `commandExecutor` / `sound` / `economy` / `title`) resolved per platform. **There is no `url` action** — it was removed from the plugin and must never be reintroduced; the designer shipped it by mistake until this rewrite.
- `grammar.ts` — parses and serializes the `type { … }` action-block text (`parseActionBlock` / `serializeActionBlock`), including the nested `conditional` and `random` shapes and the `bungee` subchannel form.
- `conditions.ts` — operators and validation for `show_condition` / conditional-check strings (`permission:`, `placeholder:`, `plugin:`, `bedrock_player:`, `java_player:`, `not:`).
- `placeholders.ts`, `images.ts`, `addons.ts`, `keys.ts`, `limits.ts`, `platforms.ts` — builtin placeholder tokens, button-image classification, known addon jars, the camelCase→snake_case key tables, plugin-enforced limits, and platform capability gating, respectively.

### Data model
`src/core/project.ts` defines the top-level model: a `Project` (`pluginTarget`, `configVersion: 1`, `assets`, `platformTarget`, `activeFormId`) holds many `FormDoc`s (`id`, `fileName`, `bedrock: BedrockForm`, optional `javaRaw` — an opaque `java:` block preserved verbatim through parse/serialize for forms that still carry one, never interpreted). The UI still edits one form at a time; multi-form UI is a later plan. `src/core/projectSchemas.ts` (`parseProject`) validates a whole `Project`, built on the per-shape Zod schemas in `src/core/schemas.ts`.

`src/core/types.ts` is the canonical per-form model. `BedrockForm` is a discriminated union on `type`:
- `SIMPLE` / `MODAL` → `buttons: BedrockButton[]`. **MODAL is not normalized to 2 buttons.** The parser keeps whatever the file says, and `ValidationPanel` reports a mismatch as an error — deliberately, so a real config problem isn't hidden.
- `CUSTOM` → `components: BedrockComponent[]` (`input | slider | dropdown | toggle`, free-form `props`)

Both buttons and components carry `ActionInstance[]` (onClick / action), and the form can have top-level `globalActions`.

### State
`src/store/` composes the Zustand store from slices: `projectSlice` (`Project` CRUD — `loadProject`, `setActiveForm`, `addForm`, `renameForm`, `duplicateForm`, `removeForm`, `setBedrock`, `setGlobalActions`, `setAssets`, `setPlatformTarget`), `selectionSlice`, `historySlice`, `uiSlice`, combined in `src/store/index.ts`. `src/core/store.ts` is now a one-line re-export shim kept for import-path compatibility.

History is **per form**, keyed by form id. Only `setBedrock` and `setGlobalActions` currently call `pushHistory` — `addForm`, `renameForm`, `duplicateForm`, `removeForm`, `setAssets` and `setPlatformTarget` do not, so e.g. `removeForm` is not undoable today. Mutating state outside the store actions breaks history regardless.

### YAML round-trip — the core contract
The old single `src/core/yaml.ts` is gone, split into `src/parse/{form,config,legacy}.ts` and `src/serialize/{form,config,blockScalar}.ts`:
- `parse/form.ts` (`parseFormDocument`) / `serialize/form.ts` (`serializeFormDocument`) — one form file. Reads/writes snake_case plugin keys (`show_condition`, `command_intercept`, `alternative_text`, …) against the camelCase model. Export emits `content:` (**never** `description:`) and no config version — `translations`, `priority` and `priority_condition` are never emitted, because the plugin does not read them.
- `parse/config.ts` / `serialize/config.ts` — `config.yml`: `config-version: 1` (the **only** place a config version is emitted), `assets`, and the form registry.
- `parse/legacy.ts` (`parseLegacyInlineConfig`) — the older all-in-one shape where every form is inlined under a top-level `forms:` key.
- `serialize/blockScalar.ts` (`applyBlockScalars`) — post-processes js-yaml's escaped multi-line strings into `|`/`|-` block scalars.
- `js-yaml` is at **5.x** and ESM-only: `import * as yaml from "js-yaml"`; the dump option is `quoteStyle: "double"`.

**Golden tests are the authority.** `src/tests/fixtures/plugin-forms/` holds byte-exact copies of the seven form files BedrockGUI 2.0.11 actually ships, and `src/tests/golden-roundtrip.spec.ts` parses and re-serializes each, pinning the result. Changing parse or serialize means keeping those green — never edit the fixtures to make a test pass.

### Actions system
`src/actions/` (`ActionPicker`, `ActionBlock`, `VisualActionEditor`) is the visual editing UI and reads `src/plugin/actions.ts` / `grammar.ts` directly — there is no separate `registry.ts` / `types.ts` / `ActionEditor.tsx` layer. An `ActionInstance` still round-trips through YAML primarily via its `raw` string; the plugin's `grammar.ts` is what parses/serializes that string into structured form for the editors.

### Validation
`src/core/schemas.ts` holds the Zod schemas mirroring the per-form model shapes (used by `projectSchemas.ts` and for legacy-project migration in `src/core/migrate.ts`). `src/core/validation.ts` holds drop-rules (e.g. components only droppable on CUSTOM forms). The live validation surfaced to the user is in `src/panels/ValidationPanel.tsx`.

### UI composition
`App.tsx` → `DesignerShell.tsx` is a responsive 3-pane layout:
- Left: `FormTypePanel` + `Palette` (component tabs) / `HistoryPanel`
- Center: `Canvas` (live `BedrockPreview`) + `ValidationPanel`
- Right: `PropertiesPanel` / `YamlEditorPanel` (live YAML view)

Drag-and-drop is `@dnd-kit`, wired through `src/app/DndHost.tsx`. Below 768px the layout collapses to a bottom tab bar (Tools / Preview / Props); `MobileWarning` also gates very small screens. Tailwind uses `brand-*` semantic color tokens (`brand-bg`, `brand-surface`, `brand-accent`, …).

Minecraft `§`/`&` formatting codes are parsed in `src/core/minecraftText.ts` and rendered by the `MinecraftText` component — use these rather than re-implementing color-code parsing.

### Cross-cutting UI utilities
Toasts (`src/core/toast.ts` + `ToastHost`) and confirm dialogs (`src/core/confirm.ts` + `ConfirmDialog`) are imperative singletons — call `toast(...)` / `confirm(...)` from anywhere instead of threading callbacks.

## Deployment
Static build → `dist/`. `npm run deploy` runs `wrangler deploy`, which serves `dist/` as Cloudflare Worker static assets (`wrangler.toml` binds `[assets] directory = "./dist"` to the Worker in `worker.ts`). SPA fallback (unmatched HTML GET/HEAD → `/index.html`) and security headers are implemented in `worker.ts` itself, not via a Pages `_redirects`/`_headers` file. `VITE_GA_MEASUREMENT_ID` is optional (analytics is skipped if unset). A Docker/nginx image (`Dockerfile`, `nginx.conf`) is also available for self-hosting.
