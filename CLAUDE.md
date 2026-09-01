# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page visual designer (React 18 + TypeScript + Vite + Tailwind) for authoring **Minecraft Bedrock GUI forms** for the BedrockGUI server plugin. The user designs a form visually and the app exports a YAML config that the plugin consumes. The app is client-only and deploys to Cloudflare Pages.

Note: the project was originally dual-platform (Java + Bedrock). Java support has been removed — `Platform` is now the single value `"bedrock"`. Deleted `Java*` files in git status are part of that migration; do not reintroduce a Java code path.

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
npx vitest run src/tests/yaml-roundtrip.spec.tsx     # one file
npx vitest run -t "round trips a SIMPLE form"        # by test name
```
Run a single e2e test: `npx playwright test e2e/basic.spec.ts -g "name"`.

Unit/integration specs live in `src/tests/*.spec.{ts,tsx}` (config: `vitest.config.ts`, setup `src/tests/setup.ts`). E2e specs live in `e2e/` (config: `playwright.config.ts`). These are two separate runners — vitest never picks up `e2e/`.

## Architecture

### State — single source of truth
`src/core/store.ts` is a single Zustand store holding the entire `DesignerState` plus UI/history state. Key rule: **all model mutations go through the store actions** (`setBedrock`, `setGlobalActions`, `setMenuName`, `loadState`). Each of these snapshots the current state onto `undoStack` and clears `redoStack` — this is how undo/redo and the History panel work. Mutating state outside these actions breaks history. Selection (`selectedBedrockButtonId` / `selectedBedrockComponentId`) and `dirty` also live here.

### Data model
`src/core/types.ts` is the canonical model. `DesignerState` → one `BedrockForm` which is a discriminated union on `type`:
- `SIMPLE` / `MODAL` → `buttons: BedrockButton[]` (MODAL is always normalized to exactly 2 buttons on import)
- `CUSTOM` → `components: BedrockComponent[]` (`input | slider | dropdown | toggle`, free-form `props`)

Both buttons and components carry `ActionInstance[]` (onClick / action), and the form can have top-level `globalActions`.

### YAML round-trip — the core contract
`src/core/yaml.ts` is the most important file to understand before touching serialization:
- `stateToYaml` / `stateToSnippetYaml` → export. Maps camelCase model keys to **snake_case** YAML keys (`showCondition`→`show_condition`, `commandIntercept`→`command_intercept`, etc.), strips `undefined`, and post-processes any string containing `\n` into a YAML block scalar (`|-`). Export deliberately does **not** wrap output in a top-level `forms:` key (asserted by `exporter.spec.ts`).
- `yamlToStateDoc` → import. Accepts both shapes: `forms.<menuName>.bedrock` (full plugin config) and a bare top-level `bedrock`. Used by `src/importers/useImporter.ts`.
- Changes to key mapping, the snake_case casing, or block-scalar handling must keep `yaml-roundtrip.spec.tsx` and `exporter.spec.tsx` green — the round-trip is the product's main guarantee.

### Actions system
`src/actions/registry.ts` defines `ActionRegistry`: each action type (actionbar, broadcast, command, conditional, delay, economy, …) has a Zod `schema` and a `serialize(params)` fn. The visual editors live in `src/actions/` (`ActionEditor`, `VisualActionEditor`, `ActionPicker`, `ActionBlock`). Note: in the current store an `ActionInstance` is round-tripped primarily via its `raw` string (`serializeActionBlocks`/`deserializeActions` in `yaml.ts`) — the registry drives the *editing UI*, the raw string is what persists in YAML.

### Validation
`src/core/schemas.ts` holds the Zod schemas mirroring the type model (used for import validation / safety). `src/core/validation.ts` holds drop-rules (e.g. components only droppable on CUSTOM forms). The live validation surfaced to the user is in `src/panels/ValidationPanel.tsx`.

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
Static build → `dist/`, deployed as a Cloudflare Pages site. SPA redirects come from a `_redirects` file copied into `dist` at build time. `VITE_GA_MEASUREMENT_ID` is optional (analytics is skipped if unset). See `README.cloudflare-pages.md`.
