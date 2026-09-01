# BedrockGUI Designer Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernise the toolchain, then replace the designer's scattered knowledge of the BedrockGUI plugin with one versioned contract module and a project-shaped model that serialises to real BedrockGUI 2.0.11 config.

**Architecture:** A data-only `src/plugin/` module describes plugin 2.0.11 — its 14 actions, condition grammar, placeholders, image sources, addon form ids and limits. A `Project` model holds many forms plus asset settings. `src/parse/` and `src/serialize/` derive entirely from the contract, and are pinned by golden tests against the seven real form files the plugin ships.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Vitest 4, Tailwind 4, Zod 4, Zustand 5, js-yaml 5, @dnd-kit.

**Spec:** `docs/superpowers/specs/2026-09-01-designer-v2011-parity-design.md`

## Global Constraints

- Target plugin version is **BedrockGUI 2.0.11**. `PLUGIN_TARGET = "2.0.11"`.
- **Java menus are out of scope.** Never author, preview, validate or generate a `java:` section. An imported `java:` block is preserved verbatim on `FormDoc.javaRaw` and round-tripped untouched. Do not add a Java editor, palette, preview or type.
- **Exactly 14 actions exist:** `command`, `open`, `message`, `delay`, `server`, `broadcast`, `inventory`, `sound`, `economy`, `title`, `actionbar`, `conditional`, `random`, `bungee`. **There is no `url` action** — it was deleted from the plugin on 2026-08-15 and errors at runtime.
- Never emit `translations`, `priority`, or `priority_condition` — the plugin does not parse them.
- Form files carry a bare `bedrock:` root. `config-version: 1` belongs only in `config.yml`, never in a form file.
- Write `content:` on export; read `description:` only as an import fallback.
- No code comments. Write the change only. (Standing user preference across the BedrockGUI projects.)
- Plugin source of truth for verification lives at `C:\Users\pintu\Desktop\Server\BedrockGUI`.
- `yaml.load` from **js-yaml** is the safe loader — since js-yaml 4 it uses the default schema
  and constructs no arbitrary types, so it is the correct call here. Do not reach for a custom
  `Loader`, and do not confuse it with PyYAML's unsafe `yaml.load`.
- Every task ends green: `npm run typecheck` and `npm test` both pass before the commit.

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `src/plugin/limits.ts` | numeric and cardinality limits |
| `src/plugin/platforms.ts` | Paper/Velocity/Bungee and which action capabilities each has |
| `src/plugin/actions.ts` | the 14 action definitions |
| `src/plugin/grammar.ts` | parse and serialize the `type { … }` action block text |
| `src/plugin/conditions.ts` | condition atoms, operators per syntax context |
| `src/plugin/placeholders.ts` | built-in placeholders and reference forms |
| `src/plugin/images.ts` | the seven image source kinds |
| `src/plugin/addons.ts` | the four addons and their form ids |
| `src/plugin/keys.ts` | YAML key names and the parsed-key set |
| `src/plugin/index.ts` | re-exports plus `PLUGIN_TARGET` |
| `src/core/project.ts` | `Project` and `FormDoc` types |
| `src/core/projectSchemas.ts` | Zod schemas for the project model |
| `src/core/migrate.ts` | legacy single-form design to project |
| `src/store/projectSlice.ts` | forms, assets, platform target |
| `src/store/selectionSlice.ts` | active form and selected element |
| `src/store/historySlice.ts` | per-form undo and redo |
| `src/store/uiSlice.ts` | wizard, panels, dirty flag |
| `src/store/index.ts` | composed `useDesignerStore` |
| `src/parse/form.ts` | a form document to a `FormDoc` |
| `src/parse/config.ts` | `config.yml` to project settings |
| `src/parse/legacy.ts` | old inline `forms:` config |
| `src/serialize/form.ts` | a `FormDoc` to a form document |
| `src/serialize/config.ts` | project settings to `config.yml` |
| `src/serialize/blockScalar.ts` | the `- |` post-processing helper |
| `src/tests/fixtures/plugin-forms/*.yml` | the seven real plugin form files |

**Deleted:** `src/core/yaml.ts`, `src/actions/registry.ts` (superseded by `src/plugin/actions.ts`).

**Modified:** `src/core/types.ts`, `src/core/schemas.ts`, `src/core/store.ts`, `src/importers/useImporter.ts`, `src/exporters/useExporter.ts`, `package.json`, `postcss.config.cjs`, `src/styles.css`, `vite.config.ts`.

---

# Phase 1 — Toolchain

### Task 1: React 19

**Files:**
- Modify: `package.json`
- Modify: `src/main.tsx`
- Test: existing `src/tests/*.spec.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: React 19 runtime for all later tasks.

- [ ] **Step 1: Record the green baseline**

Run: `npm test`
Expected: PASS, 22 tests across 6 files. Note the number; it must not drop in any later task.

- [ ] **Step 2: Install the React 19 stack**

```bash
npm install react@19.2.8 react-dom@19.2.8
npm install -D @types/react@19.2.18 @types/react-dom@19.2.8 @testing-library/react@16.3.3 @vitejs/plugin-react@6.1.1
```

- [ ] **Step 3: Run typecheck to see what React 19 breaks**

Run: `npm run typecheck`
Expected: errors, if any, come from `JSX.Element` namespace changes or implicit `children`. React 19 removed the global `JSX` namespace and no longer gives every component an implicit `children` prop.

- [ ] **Step 4: Fix each reported type error**

For a component that renders children, declare it explicitly:

```tsx
type Props = { title: string; children?: React.ReactNode };
```

For a `JSX.Element` return annotation, use `React.JSX.Element` or drop the annotation.

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm test`
Expected: typecheck clean, 22 tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src
git commit -m "build: upgrade to React 19"
```

---

### Task 2: Vite 8, Vitest 4, jsdom 30

**Files:**
- Modify: `package.json`, `vite.config.ts`, `vitest.config.ts`

**Interfaces:**
- Consumes: React 19 from Task 1.
- Produces: the test runner every later task uses.

- [ ] **Step 1: Install**

```bash
npm install -D vite@8.2.2 vitest@4.1.11 jsdom@30.0.1
```

- [ ] **Step 2: Run the tests to surface runner breakage**

Run: `npm test`
Expected: either PASS, or a config error from Vitest 4. Vitest 4 requires `environment: "jsdom"` to be set explicitly and no longer infers it from a comment.

- [ ] **Step 3: Confirm the vitest config is explicit**

`vitest.config.ts` must contain:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/tests/setup.ts"],
    include: ["src/tests/**/*.spec.{ts,tsx}"]
  }
});
```

- [ ] **Step 4: Verify the dev build still works**

Run: `npm run build`
Expected: typecheck passes, Vite emits `dist/`.

- [ ] **Step 5: Verify tests**

Run: `npm test`
Expected: 22 tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.ts vitest.config.ts
git commit -m "build: upgrade Vite to 8 and Vitest to 4"
```

---

### Task 3: Tailwind 4

**Files:**
- Modify: `src/styles.css`, `postcss.config.cjs`, `package.json`
- Delete: `tailwind.config.cjs`

**Interfaces:**
- Consumes: nothing.
- Produces: the same `brand-*` utility class names, backed by `@theme`.

Tailwind 4 is CSS-first. The JS config goes away, the PostCSS plugin moves to its own
package, and vendor prefixing and import inlining are built in, so `autoprefixer` and
`postcss-import` are removed.

- [ ] **Step 1: Install**

```bash
npm install -D tailwindcss@4.3.3 @tailwindcss/postcss@4.3.3
npm uninstall autoprefixer
```

- [ ] **Step 2: Replace the PostCSS config**

`postcss.config.cjs` becomes:

```js
module.exports = {
  plugins: {
    "@tailwindcss/postcss": {}
  }
};
```

- [ ] **Step 3: Replace the directives at the top of `src/styles.css`**

```css
@import "tailwindcss";
```

replaces all three of `@tailwind base;`, `@tailwind components;`, `@tailwind utilities;`.

- [ ] **Step 4: Move the brand palette into `@theme`**

Keep the existing `:root` block of `--ui-*` triples exactly as it is. Add, directly after
the `@import`:

```css
@theme {
  --color-brand-bg: rgb(var(--ui-bg));
  --color-brand-surface: rgb(var(--ui-surface));
  --color-brand-surface-raised: rgb(var(--ui-surface-raised));
  --color-brand-surface2: rgb(var(--ui-surface-2));
  --color-brand-border: rgb(var(--ui-border));
  --color-brand-borderStrong: rgb(var(--ui-border-strong));
  --color-brand-text: rgb(var(--ui-text));
  --color-brand-muted: rgb(var(--ui-muted));
  --color-brand-accent: rgb(var(--ui-accent));
  --color-brand-accentHover: rgb(var(--ui-accent-hover));
  --color-brand-accentPressed: rgb(var(--ui-accent-pressed));
  --color-brand-accentText: rgb(var(--ui-accent-text));
  --color-brand-focus: rgb(var(--ui-focus));
  --color-brand-success: rgb(var(--ui-success));
  --color-brand-warning: rgb(var(--ui-warning));
  --color-brand-danger: rgb(var(--ui-danger));
}
```

The `<alpha-value>` placeholder is not used in v4 — opacity modifiers such as
`bg-brand-surface/50` are handled with `color-mix` automatically.

- [ ] **Step 5: Convert the custom utilities**

Each class inside `@layer utilities` becomes an `@utility` rule. The `@layer utilities`
wrapper is removed:

```css
@utility font-minecraft {
  font-family: 'Silkscreen', cursive, monospace;
}
@utility font-body {
  font-family: 'IBM Plex Sans', sans-serif;
}
@utility font-mono-ui {
  font-family: 'IBM Plex Mono', monospace;
}
@utility font-smooth-none {
  -webkit-font-smoothing: none;
  -moz-osx-font-smoothing: grayscale;
}
@utility custom-scrollbar {
  -webkit-overflow-scrolling: touch;
}
```

The `.custom-scrollbar::-webkit-scrollbar` rule and any other bare selector move out of the
layer to plain top-level CSS. `@layer base` and `@layer components` blocks stay as they are;
`@apply` continues to work inside them.

- [ ] **Step 6: Delete the JS config**

```bash
git rm tailwind.config.cjs
```

Tailwind 4 discovers source files automatically; the `content` array is no longer needed.

- [ ] **Step 7: Build and eyeball the app**

Run: `npm run build && npm run dev`
Expected: build succeeds. Open http://localhost:5173 and confirm the dark panels, green
accent buttons and pixel font all render as before. A white unstyled page means the
`@import` or the PostCSS plugin is wrong.

- [ ] **Step 8: Verify tests**

Run: `npm run typecheck && npm test`
Expected: typecheck clean, 22 tests pass.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "build: migrate to Tailwind 4 CSS-first config"
```

---

### Task 4: Zod 4

**Files:**
- Modify: `package.json`, `src/core/schemas.ts:38`
- Test: `src/tests/schemas.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: Zod 4 for the project schemas in Task 15.

Zod 4's relevant breaking change here: `z.record()` no longer accepts a single argument.
`src/core/schemas.ts` uses `props: z.record(z.any())`, which becomes a type error.

- [ ] **Step 1: Write a failing test for the record schema**

Add to `src/tests/schemas.spec.ts`:

```ts
import { describe, it, expect } from "vitest";
import { bedrockComponentSchema } from "../core/schemas";

describe("bedrockComponentSchema", () => {
  it("accepts free-form props", () => {
    const result = bedrockComponentSchema.safeParse({
      id: "nickname",
      type: "input",
      props: { text: "Display name", placeholder: "Type a nickname" }
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run it against Zod 3 to confirm it passes today**

Run: `npx vitest run src/tests/schemas.spec.ts`
Expected: PASS. This is the behaviour the upgrade must preserve.

- [ ] **Step 3: Install Zod 4**

```bash
npm install zod@4.5.4 @hookform/resolvers@5.9.1
```

- [ ] **Step 4: Run typecheck to see the break**

Run: `npm run typecheck`
Expected: an error on `src/core/schemas.ts` line 38, `Expected 2 arguments, but got 1`.

- [ ] **Step 5: Fix the record schema**

```ts
export const bedrockComponentSchema = z.object({
  id: z.string(),
  type: z.enum(["input", "slider", "dropdown", "toggle"]),
  props: z.record(z.string(), z.any()),
  action: z.array(actionSchema).optional()
});
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npm test`
Expected: typecheck clean, 23 tests pass.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/core/schemas.ts src/tests/schemas.spec.ts
git commit -m "build: upgrade to Zod 4"
```

---

### Task 5: Zustand 5, dnd-kit, react-markdown

**Files:**
- Modify: `package.json`, `src/core/store.ts` if types complain

**Interfaces:**
- Consumes: React 19.
- Produces: Zustand 5, which Task 16 splits into slices.

- [ ] **Step 1: Install**

```bash
npm install zustand@5.0.15 @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0 react-markdown@10.1.0 react-hook-form@7.87.0
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: the existing `create<T>()((set, get) => …)` curried form is already the shape
Zustand 5 requires, so the store should compile. `@dnd-kit/sortable` 10 may rename or
retype `SortableContext` props — fix any error at the call site it reports.

- [ ] **Step 3: Fix reported errors**

Address each error where it is reported. Do not restructure the store in this task; the
split is Task 16.

- [ ] **Step 4: Verify drag and drop by hand**

Run: `npm run dev`
Expected: dragging a button in the canvas still reorders it, and dropping a component onto
a CUSTOM form still works.

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm test`
Expected: typecheck clean, 23 tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "build: upgrade Zustand, dnd-kit and react-markdown"
```

---

### Task 6: TypeScript 7 and the remaining tooling

**Files:**
- Modify: `package.json`, `tsconfig.json` if needed

**Interfaces:**
- Consumes: everything above.
- Produces: the green modern baseline Phase 2 builds on.

- [ ] **Step 1: Install**

```bash
npm install -D typescript@7.0.2 @playwright/test@1.62.1 playwright@1.62.1 wrangler@4.127.1 @types/node@22
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean. TypeScript 7 is the native port of the same compiler and should accept the
existing config.

- [ ] **Step 3: If TypeScript 7 fails, fall back**

If `tsc` errors on config options it does not implement, or a dependency's `.d.ts` fails to
resolve, revert only this package:

```bash
npm install -D typescript@5.9.3
```

Record the fallback in the commit message. Everything else in this plan is unaffected.

- [ ] **Step 4: Full verification gate**

Run: `npm run build && npm test && npm run check:bundle`
Expected: all three succeed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "build: upgrade TypeScript and remaining tooling"
```

---

# Phase 2 — The plugin contract

### Task 7: Fixtures, limits and platforms

**Files:**
- Create: `src/tests/fixtures/plugin-forms/*.yml`, `src/plugin/limits.ts`, `src/plugin/platforms.ts`
- Test: `src/tests/plugin/platforms.spec.ts`

**Interfaces:**
- Produces:
  - `LIMITS: { messageMaxChars: 2048; delayMaxMs: 30000; modalButtonCount: 2 }`
  - `type PlatformTarget = "paper" | "velocity" | "bungee"`
  - `type ActionCapability = "always" | "commandExecutor" | "sound" | "economy" | "title"`
  - `PLATFORM_CAPABILITIES: Record<PlatformTarget, readonly ActionCapability[]>`
  - `hasCapability(cap: ActionCapability, platform: PlatformTarget): boolean`

- [ ] **Step 1: Copy the seven real plugin form files in**

```bash
mkdir -p src/tests/fixtures/plugin-forms
cp /c/Users/pintu/Desktop/Server/BedrockGUI/common/src/main/resources/forms/*.yml src/tests/fixtures/plugin-forms/
ls src/tests/fixtures/plugin-forms/
```

Expected: `advanced_flow.yml`, `basic_actions.yml`, `button_images.yml`, `confirm_reset.yml`,
`economy_shop.yml`, `main_menu.yml`, `player_settings.yml`.

- [ ] **Step 2: Write the failing platform test**

`src/tests/plugin/platforms.spec.ts`:

```ts
import { describe, it, expect } from "vitest";
import { hasCapability, PLATFORM_CAPABILITIES } from "../../plugin/platforms";

describe("platform capabilities", () => {
  it("gives Paper every capability", () => {
    expect(hasCapability("sound", "paper")).toBe(true);
    expect(hasCapability("economy", "paper")).toBe(true);
    expect(hasCapability("title", "paper")).toBe(true);
    expect(hasCapability("commandExecutor", "paper")).toBe(true);
  });

  it("denies sound and economy on proxies", () => {
    for (const proxy of ["velocity", "bungee"] as const) {
      expect(hasCapability("sound", proxy)).toBe(false);
      expect(hasCapability("economy", proxy)).toBe(false);
      expect(hasCapability("title", proxy)).toBe(true);
      expect(hasCapability("commandExecutor", proxy)).toBe(true);
    }
  });

  it("always grants the always capability", () => {
    for (const p of Object.keys(PLATFORM_CAPABILITIES) as Array<keyof typeof PLATFORM_CAPABILITIES>) {
      expect(hasCapability("always", p)).toBe(true);
    }
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run src/tests/plugin/platforms.spec.ts`
Expected: FAIL, cannot resolve `../../plugin/platforms`.

- [ ] **Step 4: Write `src/plugin/limits.ts`**

```ts
export const LIMITS = {
  messageMaxChars: 2048,
  delayMaxMs: 30000,
  modalButtonCount: 2
} as const;
```

- [ ] **Step 5: Write `src/plugin/platforms.ts`**

The table is taken from the plugin: `BedrockGUIApi` receives a command executor on every
platform and a title manager whose `isSupported()` returns true everywhere, while Velocity
and Bungee both pass `null` for the sound and economy managers.

```ts
export type PlatformTarget = "paper" | "velocity" | "bungee";

export type ActionCapability = "always" | "commandExecutor" | "sound" | "economy" | "title";

export const PLATFORM_CAPABILITIES: Record<PlatformTarget, readonly ActionCapability[]> = {
  paper: ["always", "commandExecutor", "sound", "economy", "title"],
  velocity: ["always", "commandExecutor", "title"],
  bungee: ["always", "commandExecutor", "title"]
};

export function hasCapability(cap: ActionCapability, platform: PlatformTarget): boolean {
  return PLATFORM_CAPABILITIES[platform].includes(cap);
}
```

- [ ] **Step 6: Run the test**

Run: `npx vitest run src/tests/plugin/platforms.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 7: Commit**

```bash
git add src/plugin src/tests
git commit -m "feat(plugin): add limits, platform capabilities and real plugin fixtures"
```

---

### Task 8: The 14 action definitions

**Files:**
- Create: `src/plugin/actions.ts`
- Test: `src/tests/plugin/actions.spec.ts`

**Interfaces:**
- Consumes: `ActionCapability` from `src/plugin/platforms.ts`.
- Produces:
  - `type ActionId = "command" | "open" | "message" | "delay" | "server" | "broadcast" | "inventory" | "sound" | "economy" | "title" | "actionbar" | "conditional" | "random" | "bungee"`
  - `type ActionBodyShape = "lines" | "conditional" | "random"`
  - `interface ActionDef { id: ActionId; label: string; capability: ActionCapability; body: ActionBodyShape; hint: string }`
  - `ACTIONS: Record<ActionId, ActionDef>`
  - `ACTION_IDS: readonly ActionId[]`
  - `actionsForPlatform(platform: PlatformTarget): ActionDef[]`

- [ ] **Step 1: Write the failing test**

`src/tests/plugin/actions.spec.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ACTION_IDS, ACTIONS, actionsForPlatform } from "../../plugin/actions";

describe("action registry", () => {
  it("ships exactly 14 actions", () => {
    expect(ACTION_IDS).toHaveLength(14);
  });

  it("does not contain url", () => {
    expect(ACTION_IDS).not.toContain("url");
  });

  it("contains every action the plugin registers", () => {
    for (const id of [
      "command", "open", "message", "delay", "server", "broadcast", "inventory",
      "sound", "economy", "title", "actionbar", "conditional", "random", "bungee"
    ]) {
      expect(ACTION_IDS).toContain(id);
    }
  });

  it("offers 12 actions on a proxy, omitting sound and economy", () => {
    const ids = actionsForPlatform("velocity").map((a) => a.id);
    expect(ids).toHaveLength(12);
    expect(ids).not.toContain("sound");
    expect(ids).not.toContain("economy");
  });

  it("offers all 14 on Paper", () => {
    expect(actionsForPlatform("paper")).toHaveLength(14);
  });

  it("gives every action a label and a hint", () => {
    for (const id of ACTION_IDS) {
      expect(ACTIONS[id].label.length).toBeGreaterThan(0);
      expect(ACTIONS[id].hint.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/plugin/actions.spec.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/plugin/actions.ts`**

```ts
import { ActionCapability, PlatformTarget, hasCapability } from "./platforms";

export type ActionId =
  | "command" | "open" | "message" | "delay"
  | "server" | "broadcast" | "inventory"
  | "sound" | "economy"
  | "title" | "actionbar"
  | "conditional" | "random" | "bungee";

export type ActionBodyShape = "lines" | "conditional" | "random";

export interface ActionDef {
  id: ActionId;
  label: string;
  capability: ActionCapability;
  body: ActionBodyShape;
  hint: string;
}

export const ACTIONS: Record<ActionId, ActionDef> = {
  command: { id: "command", label: "Player Command", capability: "always", body: "lines", hint: "Runs as the player, without a leading slash." },
  open: { id: "open", label: "Open Form", capability: "always", body: "lines", hint: "The form id from config.yml, or an addon form id." },
  message: { id: "message", label: "Message", capability: "always", body: "lines", hint: "Chat to the clicking player. 2048 characters maximum." },
  delay: { id: "delay", label: "Delay", capability: "always", body: "lines", hint: "Milliseconds, up to 30000. A second value chains one action." },
  server: { id: "server", label: "Console Command", capability: "commandExecutor", body: "lines", hint: "Runs as console, bypassing player permissions." },
  broadcast: { id: "broadcast", label: "Broadcast", capability: "commandExecutor", body: "lines", hint: "Chat to everyone." },
  inventory: { id: "inventory", label: "Inventory", capability: "commandExecutor", body: "lines", hint: "give | remove | check | clear." },
  sound: { id: "sound", label: "Sound", capability: "sound", body: "lines", hint: "name, name:volume, or name:volume:pitch." },
  economy: { id: "economy", label: "Economy", capability: "economy", body: "lines", hint: "add | remove | set | check | pay." },
  title: { id: "title", label: "Title", capability: "title", body: "lines", hint: "title:subtitle:fadeIn:stay:fadeOut, timings in ticks." },
  actionbar: { id: "actionbar", label: "Action Bar", capability: "title", body: "lines", hint: "Text above the hotbar." },
  conditional: { id: "conditional", label: "Conditional", capability: "always", body: "conditional", hint: "check with true and false branches. Nests." },
  random: { id: "random", label: "Random", capability: "always", body: "random", hint: "Picks one entry. Append @weight to bias it." },
  bungee: { id: "bungee", label: "Proxy Message", capability: "always", body: "lines", hint: "A BungeeCord plugin message, subchannel first." }
};

export const ACTION_IDS = Object.keys(ACTIONS) as ActionId[];

export function actionsForPlatform(platform: PlatformTarget): ActionDef[] {
  return ACTION_IDS.map((id) => ACTIONS[id]).filter((a) => hasCapability(a.capability, platform));
}

export function isActionId(value: string): value is ActionId {
  return value in ACTIONS;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/tests/plugin/actions.spec.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/plugin/actions.ts src/tests/plugin/actions.spec.ts
git commit -m "feat(plugin): define the 14 BedrockGUI actions"
```

---

### Task 9: The action block grammar

**Files:**
- Create: `src/plugin/grammar.ts`
- Test: `src/tests/plugin/grammar.spec.ts`

**Interfaces:**
- Consumes: `ActionId`, `isActionId`, `ACTIONS` from `src/plugin/actions.ts`.
- Produces:
  - `type ParsedAction = { kind: "lines"; id: ActionId; lines: string[] } | { kind: "conditional"; check: string; whenTrue: ParsedAction[]; whenFalse: ParsedAction[] } | { kind: "random"; entries: Array<{ text: string; weight?: number }> } | { kind: "raw"; text: string }`
  - `parseActionBlock(text: string): ParsedAction`
  - `serializeActionBlock(action: ParsedAction): string`

This is the highest-risk unit in the plan. The block format is a header, a brace, a YAML
body, and a closing brace:

```
message {
  - "First line"
  - "Second line"
}
```

The body is ordinary YAML, so the parser strips the header and braces and hands the inside
to `js-yaml`. Two traps to respect:

1. In `conditional`, the keys `true:` and `false:` are parsed by YAML as **booleans**, not
   strings. Read them as `body[true as unknown as string]`, or normalise the loaded map by
   stringifying its keys before reading.
2. Anything that does not match the shape must return `{ kind: "raw", text }` unchanged, so
   an unrecognised block still round-trips byte-for-byte.

- [ ] **Step 1: Write the failing test**

`src/tests/plugin/grammar.spec.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseActionBlock, serializeActionBlock } from "../../plugin/grammar";

const MESSAGE = `message {
  - "First line"
  - "Second line"
}`;

const CONDITIONAL = `conditional {
  check: "placeholder:%vault_eco_balance% >= 25"
  true:
    - |
      economy {
        - "remove:25"
      }
  false:
    - |
      message {
        - "Not enough."
      }
}`;

describe("parseActionBlock", () => {
  it("parses a lines action", () => {
    expect(parseActionBlock(MESSAGE)).toEqual({
      kind: "lines",
      id: "message",
      lines: ["First line", "Second line"]
    });
  });

  it("parses a conditional with both branches", () => {
    const parsed = parseActionBlock(CONDITIONAL);
    if (parsed.kind !== "conditional") throw new Error("expected a conditional");
    expect(parsed.check).toBe("placeholder:%vault_eco_balance% >= 25");
    expect(parsed.whenTrue).toEqual([{ kind: "lines", id: "economy", lines: ["remove:25"] }]);
    expect(parsed.whenFalse).toEqual([{ kind: "lines", id: "message", lines: ["Not enough."] }]);
  });

  it("parses weighted random entries", () => {
    const parsed = parseActionBlock(`random {\n  - "message:Common@3.0"\n  - "message:Rare@1.0"\n}`);
    if (parsed.kind !== "random") throw new Error("expected a random");
    expect(parsed.entries).toEqual([
      { text: "message:Common", weight: 3.0 },
      { text: "message:Rare", weight: 1.0 }
    ]);
  });

  it("returns raw for an unknown action type", () => {
    const text = `url {\n  - "https://example.com"\n}`;
    expect(parseActionBlock(text)).toEqual({ kind: "raw", text });
  });

  it("returns raw for malformed input", () => {
    expect(parseActionBlock("not a block at all")).toEqual({ kind: "raw", text: "not a block at all" });
  });
});

describe("serializeActionBlock", () => {
  it("round-trips a lines action", () => {
    expect(serializeActionBlock(parseActionBlock(MESSAGE))).toBe(MESSAGE);
  });

  it("round-trips a conditional", () => {
    const once = serializeActionBlock(parseActionBlock(CONDITIONAL));
    const twice = serializeActionBlock(parseActionBlock(once));
    expect(twice).toBe(once);
  });

  it("emits raw text unchanged", () => {
    expect(serializeActionBlock({ kind: "raw", text: "anything at all" })).toBe("anything at all");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/plugin/grammar.spec.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/plugin/grammar.ts`**

```ts
import yaml from "js-yaml";
import { ActionId, isActionId } from "./actions";

export type ParsedAction =
  | { kind: "lines"; id: ActionId; lines: string[] }
  | { kind: "conditional"; check: string; whenTrue: ParsedAction[]; whenFalse: ParsedAction[] }
  | { kind: "random"; entries: Array<{ text: string; weight?: number }> }
  | { kind: "raw"; text: string };

const HEADER = /^\s*([A-Za-z_]+)\s*\{([\s\S]*)\}\s*$/;

export function parseActionBlock(text: string): ParsedAction {
  const raw: ParsedAction = { kind: "raw", text };
  const match = text.match(HEADER);
  if (!match) return raw;

  const id = match[1];
  const body = dedent(match[2]);
  if (!isActionId(id)) return raw;

  try {
    if (id === "conditional") return parseConditional(body, raw);
    if (id === "random") return parseRandom(body, raw);
    const loaded = yaml.load(body);
    if (!Array.isArray(loaded) || !loaded.every((v) => typeof v === "string")) return raw;
    return { kind: "lines", id, lines: loaded as string[] };
  } catch {
    return raw;
  }
}

function parseConditional(body: string, raw: ParsedAction): ParsedAction {
  const loaded = yaml.load(body);
  if (!loaded || typeof loaded !== "object" || Array.isArray(loaded)) return raw;
  const map = new Map(Object.entries(loaded as Record<string, unknown>).map(([k, v]) => [String(k), v]));
  const check = map.get("check");
  if (typeof check !== "string") return raw;
  return {
    kind: "conditional",
    check,
    whenTrue: parseBranch(map.get("true")),
    whenFalse: parseBranch(map.get("false"))
  };
}

function parseBranch(value: unknown): ParsedAction[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string").map(parseActionBlock);
}

function parseRandom(body: string, raw: ParsedAction): ParsedAction {
  const loaded = yaml.load(body);
  if (!Array.isArray(loaded) || !loaded.every((v) => typeof v === "string")) return raw;
  return {
    kind: "random",
    entries: (loaded as string[]).map((entry) => {
      const at = entry.lastIndexOf("@");
      if (at === -1) return { text: entry };
      const weight = Number(entry.slice(at + 1));
      if (!Number.isFinite(weight)) return { text: entry };
      return { text: entry.slice(0, at), weight };
    })
  };
}

export function serializeActionBlock(action: ParsedAction): string {
  if (action.kind === "raw") return action.text;
  if (action.kind === "lines") return wrap(action.id, action.lines.map(quoted));
  if (action.kind === "random") {
    return wrap("random", action.entries.map((e) => quoted(e.weight === undefined ? e.text : `${e.text}@${e.weight}`)));
  }
  const lines: string[] = [`  check: ${JSON.stringify(action.check)}`];
  appendBranch(lines, "true", action.whenTrue);
  appendBranch(lines, "false", action.whenFalse);
  return `conditional {\n${lines.join("\n")}\n}`;
}

function appendBranch(out: string[], key: string, branch: ParsedAction[]) {
  if (!branch.length) return;
  out.push(`  ${key}:`);
  for (const child of branch) {
    out.push("    - |");
    for (const line of serializeActionBlock(child).split("\n")) out.push(`      ${line}`);
  }
}

function wrap(id: string, entries: string[]): string {
  return `${id} {\n${entries.map((e) => `  - ${e}`).join("\n")}\n}`;
}

function quoted(value: string): string {
  return JSON.stringify(value);
}

function dedent(body: string): string {
  const lines = body.replace(/^\n/, "").split("\n");
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)![0].length);
  const min = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(min)).join("\n");
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/tests/plugin/grammar.spec.ts`
Expected: PASS, 8 tests. If the conditional round-trip differs only in indentation, adjust
`appendBranch` until the second serialization equals the first — the test asserts
idempotence, not byte equality with the fixture.

- [ ] **Step 5: Verify against every action block in the real fixtures**

Add to the same spec:

```ts
import fs from "node:fs";
import path from "node:path";

it("returns a non-raw parse for every block in the shipped fixtures", () => {
  const dir = path.resolve(__dirname, "../fixtures/plugin-forms");
  const blocks: string[] = [];
  for (const file of fs.readdirSync(dir)) {
    const doc = yaml.load(fs.readFileSync(path.join(dir, file), "utf8")) as any;
    collectBlocks(doc, blocks);
  }
  expect(blocks.length).toBeGreaterThan(20);
  const unparsed = blocks.filter((b) => parseActionBlock(b).kind === "raw");
  expect(unparsed).toEqual([]);
});

function collectBlocks(node: unknown, out: string[]) {
  if (typeof node === "string") {
    if (/^\s*[A-Za-z_]+\s*\{[\s\S]*\}\s*$/.test(node)) out.push(node);
    return;
  }
  if (Array.isArray(node)) { node.forEach((n) => collectBlocks(n, out)); return; }
  if (node && typeof node === "object") Object.values(node).forEach((n) => collectBlocks(n, out));
}
```

Import `yaml` at the top of the spec. Run it; every block in the seven real files must parse.
Any that does not is a genuine grammar gap — fix `grammar.ts`, not the test.

- [ ] **Step 6: Commit**

```bash
git add src/plugin/grammar.ts src/tests/plugin/grammar.spec.ts
git commit -m "feat(plugin): parse and serialize the action block grammar"
```

---

### Task 10: Conditions

**Files:**
- Create: `src/plugin/conditions.ts`
- Test: `src/tests/plugin/conditions.spec.ts`

**Interfaces:**
- Produces:
  - `type ConditionContext = "colon" | "symbol"` — `colon` for `show_condition` and `conditions[].condition`, `symbol` for a `conditional` action's `check`
  - `type ConditionOperator = { word: string | null; symbol: string | null; label: string; numeric: boolean; needsExpected: boolean }`
  - `OPERATORS: readonly ConditionOperator[]`
  - `operatorsFor(context: ConditionContext): ConditionOperator[]`
  - `ATOM_KINDS: readonly ["permission", "placeholder", "plugin", "not"]`
  - `validateCondition(text: string, context: ConditionContext): string[]` — returns human-readable problems, empty when valid

- [ ] **Step 1: Write the failing test**

`src/tests/plugin/conditions.spec.ts`:

```ts
import { describe, it, expect } from "vitest";
import { operatorsFor, validateCondition } from "../../plugin/conditions";

describe("operatorsFor", () => {
  it("offers word operators only in colon context", () => {
    expect(operatorsFor("colon").map((o) => o.word)).toContain("greater_than");
    expect(operatorsFor("symbol").map((o) => o.word).filter(Boolean)).toEqual([]);
  });

  it("offers symbol operators in both contexts", () => {
    expect(operatorsFor("symbol").map((o) => o.symbol)).toContain(">=");
    expect(operatorsFor("colon").map((o) => o.symbol)).toContain(">=");
  });
});

describe("validateCondition", () => {
  it("accepts a permission atom", () => {
    expect(validateCondition("permission:bedrockgui.admin", "colon")).toEqual([]);
  });

  it("accepts a colon placeholder comparison", () => {
    expect(validateCondition("placeholder:%vault_eco_balance%:greater_than:25", "colon")).toEqual([]);
  });

  it("accepts a symbol placeholder comparison in a check", () => {
    expect(validateCondition("placeholder:%vault_eco_balance% >= 25", "symbol")).toEqual([]);
  });

  it("rejects symbol syntax in a colon context", () => {
    expect(validateCondition("placeholder:%x% >= 5", "colon").length).toBeGreaterThan(0);
  });

  it("rejects an unknown operator", () => {
    expect(validateCondition("placeholder:%x%:bigger_than:5", "colon").length).toBeGreaterThan(0);
  });

  it("accepts combined atoms with and or", () => {
    expect(validateCondition("permission:a.b && (plugin:Vault || not:permission:c.d)", "colon")).toEqual([]);
  });

  it("rejects unbalanced parentheses", () => {
    expect(validateCondition("(permission:a.b", "colon").length).toBeGreaterThan(0);
  });

  it("accepts the operators that need no expected value", () => {
    expect(validateCondition("placeholder:%x%:not_empty", "colon")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/plugin/conditions.spec.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/plugin/conditions.ts`**

The operator table mirrors `ConditionEvaluator` in the plugin. Word forms are legal only in
the colon syntax; symbol forms are legal in both.

```ts
export type ConditionContext = "colon" | "symbol";

export interface ConditionOperator {
  word: string | null;
  symbol: string | null;
  label: string;
  numeric: boolean;
  needsExpected: boolean;
}

export const OPERATORS: readonly ConditionOperator[] = [
  { word: "equals", symbol: "==", label: "equals", numeric: false, needsExpected: true },
  { word: "not_equals", symbol: "!=", label: "does not equal", numeric: false, needsExpected: true },
  { word: "contains", symbol: null, label: "contains", numeric: false, needsExpected: true },
  { word: "starts_with", symbol: null, label: "starts with", numeric: false, needsExpected: true },
  { word: "ends_with", symbol: null, label: "ends with", numeric: false, needsExpected: true },
  { word: "greater_than", symbol: ">", label: "is greater than", numeric: true, needsExpected: true },
  { word: "greater_equal", symbol: ">=", label: "is at least", numeric: true, needsExpected: true },
  { word: "less_than", symbol: "<", label: "is less than", numeric: true, needsExpected: true },
  { word: "less_equal", symbol: "<=", label: "is at most", numeric: true, needsExpected: true },
  { word: "regex", symbol: null, label: "matches regex", numeric: false, needsExpected: true },
  { word: "empty", symbol: null, label: "is empty", numeric: false, needsExpected: false },
  { word: "not_empty", symbol: null, label: "is not empty", numeric: false, needsExpected: false }
];

export const ATOM_KINDS = ["permission", "placeholder", "plugin", "not"] as const;

export function operatorsFor(context: ConditionContext): ConditionOperator[] {
  if (context === "symbol") return OPERATORS.filter((o) => o.symbol !== null).map((o) => ({ ...o, word: null }));
  return [...OPERATORS];
}

export function validateCondition(text: string, context: ConditionContext): string[] {
  const problems: string[] = [];
  const trimmed = text.trim();
  if (!trimmed) return ["Condition is empty."];

  let depth = 0;
  for (const ch of trimmed) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth < 0) { problems.push("Unbalanced parentheses."); break; }
  }
  if (depth !== 0 && !problems.length) problems.push("Unbalanced parentheses.");

  for (const atom of splitAtoms(trimmed)) {
    problems.push(...validateAtom(atom, context));
  }
  return problems;
}

function splitAtoms(text: string): string[] {
  return text
    .split(/\|\||&&/)
    .map((part) => part.replace(/[()]/g, "").trim())
    .filter(Boolean);
}

function validateAtom(atom: string, context: ConditionContext): string[] {
  const body = atom.startsWith("not:") ? atom.slice(4) : atom;
  if (body.startsWith("permission:") || body.startsWith("plugin:")) {
    return body.split(":").slice(1).join(":").trim() ? [] : [`"${atom}" is missing its value.`];
  }
  if (!body.startsWith("placeholder:")) {
    return [`"${atom}" is not a known condition. Use permission:, placeholder:, plugin: or not:.`];
  }
  return context === "symbol" ? validateSymbolAtom(atom, body) : validateColonAtom(atom, body);
}

function validateSymbolAtom(atom: string, body: string): string[] {
  const match = body.slice("placeholder:".length).match(/^(.*?)\s+(>=|<=|==|!=|>|<)\s+(.*)$/);
  if (!match) return [`"${atom}" must read placeholder:<value> <operator> <expected> inside a conditional check.`];
  return OPERATORS.some((o) => o.symbol === match[2]) ? [] : [`"${match[2]}" is not a valid operator.`];
}

function validateColonAtom(atom: string, body: string): string[] {
  if (/\s(>=|<=|==|!=|>|<)\s/.test(body)) {
    return [`"${atom}" uses conditional-check syntax. Here it must be placeholder:<value>:<operator>:<expected>.`];
  }
  const parts = body.split(":");
  if (parts.length < 3) return [`"${atom}" must read placeholder:<value>:<operator>[:<expected>].`];
  const opToken = parts[2];
  const operator = OPERATORS.find((o) => o.word === opToken || o.symbol === opToken);
  if (!operator) return [`"${opToken}" is not a valid operator.`];
  if (operator.needsExpected && parts.length < 4) return [`"${opToken}" needs a value to compare against.`];
  return [];
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/tests/plugin/conditions.spec.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Check the shipped fixtures validate**

Add a test that pulls every `show_condition` out of the seven fixtures and asserts
`validateCondition(value, "colon")` is empty, and every `conditional` `check` and asserts
`validateCondition(value, "symbol")` is empty. Any failure is a real gap in the validator.

- [ ] **Step 6: Commit**

```bash
git add src/plugin/conditions.ts src/tests/plugin/conditions.spec.ts
git commit -m "feat(plugin): model condition atoms and operators per syntax context"
```

---

### Task 11: Placeholders

**Files:**
- Create: `src/plugin/placeholders.ts`
- Test: `src/tests/plugin/placeholders.spec.ts`

**Interfaces:**
- Produces:
  - `BUILTIN_PLACEHOLDERS: ReadonlyArray<{ token: string; description: string }>` — `{player}`, `{uuid}`, `{time}`, `{hour}`, `{minute}`, `{timestamp}`
  - `findUnknownBracePlaceholders(text: string): string[]`
  - `componentReference(key: string): string` — returns `$<key>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { BUILTIN_PLACEHOLDERS, componentReference, findUnknownBracePlaceholders } from "../../plugin/placeholders";

describe("placeholders", () => {
  it("knows the six built-ins", () => {
    expect(BUILTIN_PLACEHOLDERS.map((p) => p.token)).toEqual(
      ["{player}", "{uuid}", "{time}", "{hour}", "{minute}", "{timestamp}"]
    );
  });

  it("accepts a built-in", () => {
    expect(findUnknownBracePlaceholders("Hello {player}!")).toEqual([]);
  });

  it("flags a brace placeholder that is not built in", () => {
    expect(findUnknownBracePlaceholders("Balance {money}")).toEqual(["{money}"]);
  });

  it("ignores PlaceholderAPI syntax", () => {
    expect(findUnknownBracePlaceholders("Balance %vault_eco_balance%")).toEqual([]);
  });

  it("builds a component reference", () => {
    expect(componentReference("render_distance")).toBe("$render_distance");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/plugin/placeholders.spec.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/plugin/placeholders.ts`**

```ts
export const BUILTIN_PLACEHOLDERS = [
  { token: "{player}", description: "The player's name" },
  { token: "{uuid}", description: "The player's UUID" },
  { token: "{time}", description: "Server time in ticks" },
  { token: "{hour}", description: "Current hour, 0 to 23" },
  { token: "{minute}", description: "Current minute" },
  { token: "{timestamp}", description: "Unix time in milliseconds" }
] as const;

const BUILTIN_TOKENS = new Set(BUILTIN_PLACEHOLDERS.map((p) => p.token));

export function findUnknownBracePlaceholders(text: string): string[] {
  const found = text.match(/\{[a-z_][a-z0-9_]*\}/gi) ?? [];
  return [...new Set(found.filter((token) => !BUILTIN_TOKENS.has(token.toLowerCase())))];
}

export function componentReference(key: string): string {
  return `$${key}`;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/tests/plugin/placeholders.spec.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/plugin/placeholders.ts src/tests/plugin/placeholders.spec.ts
git commit -m "feat(plugin): model built-in placeholders and component references"
```

---

### Task 12: Image sources

**Files:**
- Create: `src/plugin/images.ts`
- Test: `src/tests/plugin/images.spec.ts`

**Interfaces:**
- Consumes: the material list already in `src/data/materials.ts`.
- Produces:
  - `type ImageKind = "material" | "potion" | "texturePath" | "head" | "url" | "assetFile" | "none" | "unknown"`
  - `classifyImage(value: string): { kind: ImageKind; detail?: string }`
  - `NO_ICON_MATERIALS: readonly string[]`
  - `ASSET_EXTENSIONS: readonly string[]`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { classifyImage } from "../../plugin/images";

describe("classifyImage", () => {
  it("recognises a material", () => {
    expect(classifyImage("DIAMOND_SWORD").kind).toBe("material");
  });

  it("recognises a potion with an effect", () => {
    expect(classifyImage("POTION:HEALING").kind).toBe("potion");
    expect(classifyImage("TIPPED_ARROW:LONG_POISON").kind).toBe("potion");
  });

  it("recognises a resource pack path", () => {
    expect(classifyImage("textures/ui/icon_setting").kind).toBe("texturePath");
  });

  it("recognises a player head", () => {
    expect(classifyImage("head:Notch").kind).toBe("head");
    expect(classifyImage("head:{player}").kind).toBe("head");
  });

  it("recognises a URL", () => {
    expect(classifyImage("https://example.com/shop.png").kind).toBe("url");
  });

  it("recognises a local asset file", () => {
    expect(classifyImage("logo.png").kind).toBe("assetFile");
    expect(classifyImage("banner.webp").kind).toBe("assetFile");
  });

  it("recognises materials that draw no icon", () => {
    expect(classifyImage("BARRIER").kind).toBe("none");
    expect(classifyImage("AIR").kind).toBe("none");
  });

  it("reports anything else as unknown", () => {
    expect(classifyImage("not a real thing").kind).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/plugin/images.spec.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/plugin/images.ts`**

```ts
import { MATERIALS } from "../data/materials";

export type ImageKind =
  | "material" | "potion" | "texturePath" | "head" | "url" | "assetFile" | "none" | "unknown";

export const NO_ICON_MATERIALS = [
  "AIR", "CAVE_AIR", "VOID_AIR", "STRUCTURE_VOID", "BARRIER", "LIGHT"
] as const;

export const ASSET_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp"] as const;

const POTION_PREFIXES = ["POTION", "SPLASH_POTION", "LINGERING_POTION", "TIPPED_ARROW"];
const MATERIAL_SET = new Set(MATERIALS.map((m) => m.toUpperCase()));
const NO_ICON_SET = new Set<string>(NO_ICON_MATERIALS);

export function classifyImage(value: string): { kind: ImageKind; detail?: string } {
  const raw = value.trim();
  if (!raw) return { kind: "unknown" };

  if (/^https?:\/\//i.test(raw)) return { kind: "url" };
  if (raw.startsWith("textures/")) return { kind: "texturePath" };
  if (raw.toLowerCase().startsWith("head:")) return { kind: "head", detail: raw.slice(5) };

  const upper = raw.toUpperCase();
  if (NO_ICON_SET.has(upper)) return { kind: "none" };

  const colon = upper.indexOf(":");
  if (colon > 0 && POTION_PREFIXES.includes(upper.slice(0, colon))) {
    return { kind: "potion", detail: normalisePotionEffect(upper.slice(colon + 1)) };
  }

  if (MATERIAL_SET.has(upper)) return { kind: "material" };

  const ext = raw.split(".").pop()?.toLowerCase();
  if (ext && (ASSET_EXTENSIONS as readonly string[]).includes(ext)) return { kind: "assetFile" };

  return { kind: "unknown" };
}

function normalisePotionEffect(effect: string): string {
  return effect.replace(/^LONG_/, "").replace(/^STRONG_/, "");
}
```

- [ ] **Step 4: Check the export name in `src/data/materials.ts`**

Run: `grep -n "export" src/data/materials.ts`
If the exported binding is not `MATERIALS`, use whatever name is there and adjust the import.
If it exports objects rather than strings, map to the name field.

- [ ] **Step 5: Run the test**

Run: `npx vitest run src/tests/plugin/images.spec.ts`
Expected: PASS, 8 tests. `DIAMOND_SWORD` must be in the materials list; if the local list is
short, add the materials used by the fixtures rather than weakening the test.

- [ ] **Step 6: Commit**

```bash
git add src/plugin/images.ts src/tests/plugin/images.spec.ts src/data/materials.ts
git commit -m "feat(plugin): classify the seven button image source kinds"
```

---

### Task 13: Addons, key map and the contract index

**Files:**
- Create: `src/plugin/addons.ts`, `src/plugin/keys.ts`, `src/plugin/index.ts`
- Test: `src/tests/plugin/addons.spec.ts`

**Interfaces:**
- Produces:
  - `interface AddonDef { id: string; name: string; jar: string; minPluginVersion: string; formIds: readonly string[]; parameterised?: readonly string[] }`
  - `ADDONS: readonly AddonDef[]`
  - `ADDON_FORM_IDS: ReadonlySet<string>`
  - `findAddonForFormId(id: string): AddonDef | undefined`
  - `FORM_KEYS`, `BUTTON_KEYS`, `COMPONENT_KEYS`, `IGNORED_KEYS` from `keys.ts`
  - `PLUGIN_TARGET = "2.0.11"` from `index.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { ADDONS, findAddonForFormId } from "../../plugin/addons";
import { IGNORED_KEYS } from "../../plugin/keys";
import { PLUGIN_TARGET } from "../../plugin";

describe("addons", () => {
  it("ships four addons, each with form ids", () => {
    expect(ADDONS).toHaveLength(4);
    for (const addon of ADDONS) expect(addon.formIds.length).toBeGreaterThan(0);
  });

  it("resolves a plain addon form id", () => {
    expect(findAddonForFormId("bw_arena_main")?.id).toBe("bedwars");
    expect(findAddonForFormId("essentials_hub")?.id).toBe("essentials");
  });

  it("resolves a parameterised Homestead id", () => {
    expect(findAddonForFormId("hs_region_menu:12345")?.id).toBe("homestead");
  });

  it("returns undefined for an unknown id", () => {
    expect(findAddonForFormId("my_own_menu")).toBeUndefined();
  });
});

describe("keys", () => {
  it("marks the phantom keys as ignored by the plugin", () => {
    expect(IGNORED_KEYS).toContain("translations");
    expect(IGNORED_KEYS).toContain("priority");
    expect(IGNORED_KEYS).toContain("priority_condition");
  });
});

describe("contract", () => {
  it("targets plugin 2.0.11", () => {
    expect(PLUGIN_TARGET).toBe("2.0.11");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/plugin/addons.spec.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write `src/plugin/addons.ts`**

```ts
export interface AddonDef {
  id: string;
  name: string;
  jar: string;
  minPluginVersion: string;
  formIds: readonly string[];
  parameterised?: readonly string[];
}

export const ADDONS: readonly AddonDef[] = [
  {
    id: "essentials",
    name: "Essentials Addon",
    jar: "BedrockGUI-EssentialsAddon.jar",
    minPluginVersion: "2.0.8",
    formIds: [
      "essentials_hub", "essentials_warp_main", "essentials_kit_main",
      "home_main", "public_home_main", "tpa_main", "essentials_pet_main"
    ]
  },
  {
    id: "bedwars",
    name: "Bedwars Addon",
    jar: "BedrockGUI-BedwarsAddon.jar",
    minPluginVersion: "2.0.8",
    formIds: [
      "bw_shop_main", "bw_shop_cat", "bw_shop_buy",
      "bw_upgrade_main", "bw_upgrade_buy",
      "bw_arena_main", "bw_arena_join", "bw_stats",
      "bw_spec_main", "bw_spec_tp",
      "bw_party_main", "bw_party_add", "bw_party_kick", "bw_party_leave", "bw_party_disband"
    ]
  },
  {
    id: "homestead",
    name: "Homestead Addon",
    jar: "BedrockGUI-HomesteadAddon.jar",
    minPluginVersion: "2.0.8",
    formIds: ["hs_regions"],
    parameterised: ["hs_region_menu", "hs_players", "hs_flags"]
  },
  {
    id: "phoenixduels",
    name: "PhoenixDuels Addon",
    jar: "BedrockGUI-PhoenixDuelsAddon.jar",
    minPluginVersion: "2.0.8",
    formIds: [
      "queue", "party", "duel_player", "stats",
      "leaderboard", "settings", "ongoing_matches", "kit_preview"
    ]
  }
];

export const ADDON_FORM_IDS: ReadonlySet<string> = new Set(ADDONS.flatMap((a) => a.formIds));

export function findAddonForFormId(id: string): AddonDef | undefined {
  const base = id.includes(":") ? id.slice(0, id.indexOf(":")) : id;
  return ADDONS.find((a) => a.formIds.includes(id) || (a.parameterised ?? []).includes(base));
}
```

- [ ] **Step 4: Write `src/plugin/keys.ts`**

```ts
export const FORM_KEYS = {
  type: "type",
  title: "title",
  content: "content",
  description: "description",
  permission: "permission",
  command: "command",
  commandIntercept: "command_intercept",
  buttons: "buttons",
  components: "components",
  globalActions: "global_actions"
} as const;

export const BUTTON_KEYS = {
  text: "text",
  image: "image",
  onClick: "onClick",
  showCondition: "show_condition",
  alternativeText: "alternative_text",
  alternativeImage: "alternative_image",
  alternativeOnClick: "alternative_onClick",
  conditions: "conditions"
} as const;

export const COMPONENT_KEYS = {
  type: "type",
  text: "text",
  placeholder: "placeholder",
  default: "default",
  min: "min",
  max: "max",
  step: "step",
  options: "options",
  action: "action"
} as const;

export const IGNORED_KEYS = ["translations", "priority", "priority_condition"] as const;
```

- [ ] **Step 5: Write `src/plugin/index.ts`**

```ts
export const PLUGIN_TARGET = "2.0.11" as const;

export * from "./actions";
export * from "./addons";
export * from "./conditions";
export * from "./grammar";
export * from "./images";
export * from "./keys";
export * from "./limits";
export * from "./placeholders";
export * from "./platforms";
```

- [ ] **Step 6: Run the test**

Run: `npx vitest run src/tests/plugin/addons.spec.ts`
Expected: PASS, 6 tests.

- [ ] **Step 7: Full verification and commit**

```bash
npm run typecheck && npm test
git add src/plugin src/tests/plugin
git commit -m "feat(plugin): add addon catalogue, key map and contract index"
```

---

# Phase 3 — Project model and store

### Task 14: The project model

**Files:**
- Create: `src/core/project.ts`
- Modify: `src/core/types.ts`
- Test: `src/tests/project.spec.ts`

**Interfaces:**
- Consumes: `PlatformTarget` from `src/plugin/platforms.ts`, `PLUGIN_TARGET` from `src/plugin`.
- Produces:
  - `interface Project { pluginTarget: "2.0.11"; configVersion: 1; assets: AssetsConfig; platformTarget: PlatformTarget; forms: FormDoc[]; activeFormId: string }`
  - `interface AssetsConfig { enabled: boolean; port: number; host: string }`
  - `interface FormDoc { id: string; fileName: string; bedrock: BedrockForm; javaRaw?: unknown }`
  - `createEmptyProject(): Project`
  - `createForm(id: string): FormDoc`
  - `findForm(project: Project, id: string): FormDoc | undefined`

`BedrockForm` keeps its discriminated union but `content` widens to `string | string[]`, and
`translations`, `priority` and `priorityCondition` are removed from `BedrockButton`.

`globalActions` moves too. Today it sits on `DesignerState`, beside `bedrock`. In the plugin
`global_actions` is a key **under** `bedrock:`, and each form file has its own, so it belongs
on `BedrockFormBase`. The old top-level field is deleted.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { createEmptyProject, createForm, findForm } from "../core/project";

describe("project model", () => {
  it("starts with one SIMPLE form that is active", () => {
    const project = createEmptyProject();
    expect(project.forms).toHaveLength(1);
    expect(project.activeFormId).toBe(project.forms[0].id);
    expect(project.forms[0].bedrock.type).toBe("SIMPLE");
  });

  it("targets plugin 2.0.11 with config version 1", () => {
    const project = createEmptyProject();
    expect(project.pluginTarget).toBe("2.0.11");
    expect(project.configVersion).toBe(1);
  });

  it("defaults the assets server to off", () => {
    expect(createEmptyProject().assets).toEqual({ enabled: false, port: 0, host: "" });
  });

  it("derives a file name from the form id", () => {
    expect(createForm("main_menu").fileName).toBe("main_menu.yml");
  });

  it("finds a form by id", () => {
    const project = createEmptyProject();
    project.forms.push(createForm("shop"));
    expect(findForm(project, "shop")?.id).toBe("shop");
    expect(findForm(project, "nope")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/project.spec.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Update `src/core/types.ts`**

Widen content and delete the phantom fields:

```ts
export interface BedrockFormBase {
  type: BedrockFormType;
  title: string;
  content?: string | string[];
  description?: string;
  command?: string;
  commandIntercept?: string;
  permission?: string;
  globalActions?: ActionInstance[];
}

export interface BedrockButton {
  id: string;
  text: string;
  image?: string;
  onClick?: ActionInstance[];
  showCondition?: string;
  alternativeText?: string;
  alternativeImage?: string;
  alternativeOnClick?: string;
  conditions?: BedrockButtonConditionRule[];
}
```

Remove `translations`, `priority` and `priorityCondition` from the interface, and remove
`Platform` and `ConfigVersion` if nothing references them after Task 17.

- [ ] **Step 4: Write `src/core/project.ts`**

```ts
import { PlatformTarget } from "../plugin/platforms";
import { PLUGIN_TARGET } from "../plugin";
import { BedrockForm } from "./types";

export interface AssetsConfig {
  enabled: boolean;
  port: number;
  host: string;
}

export interface FormDoc {
  id: string;
  fileName: string;
  bedrock: BedrockForm;
  javaRaw?: unknown;
}

export interface Project {
  pluginTarget: typeof PLUGIN_TARGET;
  configVersion: 1;
  assets: AssetsConfig;
  platformTarget: PlatformTarget;
  forms: FormDoc[];
  activeFormId: string;
}

export function createForm(id: string): FormDoc {
  return {
    id,
    fileName: `${id}.yml`,
    bedrock: {
      type: "SIMPLE",
      title: "New Form",
      content: "",
      buttons: [{ id: "button_1", text: "Click me" }]
    }
  };
}

export function createEmptyProject(): Project {
  const form = createForm("main_menu");
  return {
    pluginTarget: PLUGIN_TARGET,
    configVersion: 1,
    assets: { enabled: false, port: 0, host: "" },
    platformTarget: "paper",
    forms: [form],
    activeFormId: form.id
  };
}

export function findForm(project: Project, id: string): FormDoc | undefined {
  return project.forms.find((f) => f.id === id);
}
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run src/tests/project.spec.ts`
Expected: PASS, 5 tests. Typecheck will still fail elsewhere because callers reference the
removed fields; Task 17 clears those. If a caller blocks the test run, delete the reference
to `translations`, `priority` or `priorityCondition` at that site now.

- [ ] **Step 6: Commit**

```bash
git add src/core/project.ts src/core/types.ts src/tests/project.spec.ts
git commit -m "feat(core): add the project model and drop keys the plugin ignores"
```

---

### Task 15: Project schemas

**Files:**
- Create: `src/core/projectSchemas.ts`
- Test: `src/tests/projectSchemas.spec.ts`

**Interfaces:**
- Consumes: Zod 4, the project types.
- Produces: `projectSchema`, `formDocSchema`, `assetsSchema`, and `parseProject(value: unknown)` returning `{ ok: true; project: Project } | { ok: false; problems: string[] }`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { createEmptyProject } from "../core/project";
import { parseProject } from "../core/projectSchemas";

describe("parseProject", () => {
  it("accepts a freshly created project", () => {
    const result = parseProject(createEmptyProject());
    expect(result.ok).toBe(true);
  });

  it("rejects a project whose active form does not exist", () => {
    const project = { ...createEmptyProject(), activeFormId: "ghost" };
    const result = parseProject(project);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(" ")).toContain("ghost");
  });

  it("rejects duplicate form ids", () => {
    const project = createEmptyProject();
    project.forms.push({ ...project.forms[0] });
    const result = parseProject(project);
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/projectSchemas.spec.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/core/projectSchemas.ts`**

Reuse `bedrockSimpleSchema`, `bedrockModalSchema` and `bedrockCustomSchema` from
`src/core/schemas.ts`, widening `content` to `z.union([z.string(), z.array(z.string())])`
in `bedrockBaseSchema` and removing the phantom fields from `bedrockButtonSchema`.

```ts
import { z } from "zod";
import { Project } from "./project";
import { bedrockCustomSchema, bedrockModalSchema, bedrockSimpleSchema } from "./schemas";

export const assetsSchema = z.object({
  enabled: z.boolean(),
  port: z.number().int().min(0).max(65535),
  host: z.string()
});

export const formDocSchema = z.object({
  id: z.string().min(1),
  fileName: z.string().min(1),
  bedrock: z.union([bedrockSimpleSchema, bedrockModalSchema, bedrockCustomSchema]),
  javaRaw: z.unknown().optional()
});

export const projectSchema = z
  .object({
    pluginTarget: z.literal("2.0.11"),
    configVersion: z.literal(1),
    assets: assetsSchema,
    platformTarget: z.enum(["paper", "velocity", "bungee"]),
    forms: z.array(formDocSchema).min(1),
    activeFormId: z.string().min(1)
  })
  .refine((p) => p.forms.some((f) => f.id === p.activeFormId), {
    message: "activeFormId does not match any form"
  })
  .refine((p) => new Set(p.forms.map((f) => f.id)).size === p.forms.length, {
    message: "form ids must be unique"
  });

export function parseProject(value: unknown):
  | { ok: true; project: Project }
  | { ok: false; problems: string[] } {
  const result = projectSchema.safeParse(value);
  if (result.success) return { ok: true, project: result.data as Project };
  return {
    ok: false,
    problems: result.error.issues.map((i) => {
      const path = i.path.join(".");
      return path ? `${path}: ${i.message}` : i.message;
    })
  };
}
```

The `activeFormId` test asserts the id appears in the message. If Zod's refine message does
not carry it, add the id into the message with a custom refinement.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/tests/projectSchemas.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/projectSchemas.ts src/core/schemas.ts src/tests/projectSchemas.spec.ts
git commit -m "feat(core): validate the project model with Zod 4"
```

---

### Task 16: Store slices

**Files:**
- Create: `src/store/projectSlice.ts`, `src/store/selectionSlice.ts`, `src/store/historySlice.ts`, `src/store/uiSlice.ts`, `src/store/index.ts`
- Modify: `src/core/store.ts` to re-export from `src/store/index.ts`
- Test: `src/tests/store.spec.ts`

**Interfaces:**
- Produces `useDesignerStore` exposing:
  - state: `project`, `dirty`, `selectedBedrockButtonId`, `selectedBedrockComponentId`, `isWizardOpen`
  - actions: `setActiveForm(id)`, `addForm(id)`, `renameForm(from, to)`, `duplicateForm(id)`, `removeForm(id)`, `setBedrock(form, description?)`, `setGlobalActions(actions, description?)`, `setAssets(assets)`, `setPlatformTarget(target)`, `loadProject(project)`, `undo()`, `redo()`
  - selectors: `activeForm()` returning `FormDoc`

Every mutating action pushes the previous state of the affected form onto that form's undo
stack and clears its redo stack. This is the invariant the History panel depends on.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useDesignerStore } from "../store";
import { createEmptyProject } from "../core/project";

describe("designer store", () => {
  beforeEach(() => {
    useDesignerStore.getState().loadProject(createEmptyProject());
  });

  it("adds a form and leaves the active form alone", () => {
    const before = useDesignerStore.getState().project.activeFormId;
    useDesignerStore.getState().addForm("shop");
    const state = useDesignerStore.getState();
    expect(state.project.forms.map((f) => f.id)).toContain("shop");
    expect(state.project.activeFormId).toBe(before);
  });

  it("refuses a duplicate form id", () => {
    useDesignerStore.getState().addForm("shop");
    useDesignerStore.getState().addForm("shop");
    expect(useDesignerStore.getState().project.forms.filter((f) => f.id === "shop")).toHaveLength(1);
  });

  it("renames a form and its file", () => {
    useDesignerStore.getState().renameForm("main_menu", "hub");
    const form = useDesignerStore.getState().project.forms[0];
    expect(form.id).toBe("hub");
    expect(form.fileName).toBe("hub.yml");
  });

  it("undoes a title change on the active form only", () => {
    useDesignerStore.getState().addForm("shop");
    const active = useDesignerStore.getState().activeForm();
    useDesignerStore.getState().setBedrock({ ...active.bedrock, title: "Changed" });
    expect(useDesignerStore.getState().activeForm().bedrock.title).toBe("Changed");
    useDesignerStore.getState().undo();
    expect(useDesignerStore.getState().activeForm().bedrock.title).toBe("New Form");
    expect(useDesignerStore.getState().project.forms.map((f) => f.id)).toContain("shop");
  });

  it("redoes what it undid", () => {
    const active = useDesignerStore.getState().activeForm();
    useDesignerStore.getState().setBedrock({ ...active.bedrock, title: "Changed" });
    useDesignerStore.getState().undo();
    useDesignerStore.getState().redo();
    expect(useDesignerStore.getState().activeForm().bedrock.title).toBe("Changed");
  });

  it("marks the project dirty on mutation", () => {
    expect(useDesignerStore.getState().dirty).toBe(false);
    const active = useDesignerStore.getState().activeForm();
    useDesignerStore.getState().setBedrock({ ...active.bedrock, title: "Changed" });
    expect(useDesignerStore.getState().dirty).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/store.spec.ts`
Expected: FAIL, cannot resolve `../store`.

- [ ] **Step 3: Write `src/store/uiSlice.ts` and `src/store/selectionSlice.ts`**

```ts
import { StateCreator } from "zustand";

export interface UiSlice {
  dirty: boolean;
  isWizardOpen: boolean;
  setDirty: (dirty: boolean) => void;
  setIsWizardOpen: (open: boolean) => void;
}

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set) => ({
  dirty: false,
  isWizardOpen: false,
  setDirty: (dirty) => set({ dirty }),
  setIsWizardOpen: (isWizardOpen) => set({ isWizardOpen })
});
```

```ts
import { StateCreator } from "zustand";

export interface SelectionSlice {
  selectedBedrockButtonId: string | null;
  selectedBedrockComponentId: string | null;
  setSelectedBedrockButtonId: (id: string | null) => void;
  setSelectedBedrockComponentId: (id: string | null) => void;
}

export const createSelectionSlice: StateCreator<SelectionSlice, [], [], SelectionSlice> = (set) => ({
  selectedBedrockButtonId: null,
  selectedBedrockComponentId: null,
  setSelectedBedrockButtonId: (selectedBedrockButtonId) => set({ selectedBedrockButtonId }),
  setSelectedBedrockComponentId: (selectedBedrockComponentId) => set({ selectedBedrockComponentId })
});
```

- [ ] **Step 4: Write `src/store/historySlice.ts`**

History is keyed by form id, so undoing in one form never touches another.

```ts
import { StateCreator } from "zustand";
import { FormDoc, findForm } from "../core/project";
import { ProjectSlice } from "./projectSlice";
import { UiSlice } from "./uiSlice";

export interface HistoryEntry {
  form: FormDoc;
  description: string;
  timestamp: number;
}

export interface FormHistory {
  undo: HistoryEntry[];
  redo: HistoryEntry[];
}

export interface HistorySlice {
  history: Record<string, FormHistory>;
  pushHistory: (formId: string, description: string) => void;
  undo: () => void;
  redo: () => void;
}

const EMPTY: FormHistory = { undo: [], redo: [] };

export const createHistorySlice: StateCreator<
  ProjectSlice & HistorySlice & UiSlice, [], [], HistorySlice
> = (set, get) => ({
  history: {},

  pushHistory: (formId, description) => {
    const form = findForm(get().project, formId);
    if (!form) return;
    set((s) => {
      const current = s.history[formId] ?? EMPTY;
      return {
        history: {
          ...s.history,
          [formId]: {
            undo: [...current.undo, { form: structuredClone(form), description, timestamp: Date.now() }],
            redo: []
          }
        }
      };
    });
  },

  undo: () =>
    set((s) => {
      const id = s.project.activeFormId;
      const current = s.history[id] ?? EMPTY;
      const previous = current.undo[current.undo.length - 1];
      const live = findForm(s.project, id);
      if (!previous || !live) return s;
      return {
        project: { ...s.project, forms: s.project.forms.map((f) => (f.id === id ? previous.form : f)) },
        history: {
          ...s.history,
          [id]: {
            undo: current.undo.slice(0, -1),
            redo: [...current.redo, { form: structuredClone(live), description: previous.description, timestamp: Date.now() }]
          }
        },
        dirty: true
      };
    }),

  redo: () =>
    set((s) => {
      const id = s.project.activeFormId;
      const current = s.history[id] ?? EMPTY;
      const next = current.redo[current.redo.length - 1];
      const live = findForm(s.project, id);
      if (!next || !live) return s;
      return {
        project: { ...s.project, forms: s.project.forms.map((f) => (f.id === id ? next.form : f)) },
        history: {
          ...s.history,
          [id]: {
            undo: [...current.undo, { form: structuredClone(live), description: next.description, timestamp: Date.now() }],
            redo: current.redo.slice(0, -1)
          }
        },
        dirty: true
      };
    })
});
```

- [ ] **Step 5: Write `src/store/projectSlice.ts`**

Every mutating action calls `pushHistory` before it writes.

```ts
import { StateCreator } from "zustand";
import { AssetsConfig, FormDoc, Project, createEmptyProject, createForm, findForm } from "../core/project";
import { PlatformTarget } from "../plugin/platforms";
import { ActionInstance, BedrockForm } from "../core/types";
import { HistorySlice } from "./historySlice";
import { UiSlice } from "./uiSlice";

export interface ProjectSlice {
  project: Project;
  activeForm: () => FormDoc;
  loadProject: (project: Project) => void;
  setActiveForm: (id: string) => void;
  addForm: (id: string) => void;
  renameForm: (from: string, to: string) => void;
  duplicateForm: (id: string) => void;
  removeForm: (id: string) => void;
  setBedrock: (form: BedrockForm, description?: string) => void;
  setGlobalActions: (actions: ActionInstance[] | undefined, description?: string) => void;
  setAssets: (assets: AssetsConfig) => void;
  setPlatformTarget: (target: PlatformTarget) => void;
}

export const createProjectSlice: StateCreator<
  ProjectSlice & HistorySlice & UiSlice, [], [], ProjectSlice
> = (set, get) => ({
  project: createEmptyProject(),

  activeForm: () => {
    const { project } = get();
    return findForm(project, project.activeFormId) ?? project.forms[0];
  },

  loadProject: (project) => set({ project, dirty: false, history: {} }),

  setActiveForm: (id) =>
    set((s) => (findForm(s.project, id) ? { project: { ...s.project, activeFormId: id } } : s)),

  addForm: (id) =>
    set((s) => {
      if (!id.trim() || findForm(s.project, id)) return s;
      return { project: { ...s.project, forms: [...s.project.forms, createForm(id)] }, dirty: true };
    }),

  renameForm: (from, to) =>
    set((s) => {
      if (!to.trim() || findForm(s.project, to) || !findForm(s.project, from)) return s;
      return {
        project: {
          ...s.project,
          forms: s.project.forms.map((f) => (f.id === from ? { ...f, id: to, fileName: `${to}.yml` } : f)),
          activeFormId: s.project.activeFormId === from ? to : s.project.activeFormId
        },
        dirty: true
      };
    }),

  duplicateForm: (id) =>
    set((s) => {
      const source = findForm(s.project, id);
      if (!source) return s;
      let copyId = `${id}_copy`;
      let n = 2;
      while (findForm(s.project, copyId)) copyId = `${id}_copy_${n++}`;
      const copy: FormDoc = { ...structuredClone(source), id: copyId, fileName: `${copyId}.yml` };
      return { project: { ...s.project, forms: [...s.project.forms, copy] }, dirty: true };
    }),

  removeForm: (id) =>
    set((s) => {
      if (s.project.forms.length <= 1) return s;
      const forms = s.project.forms.filter((f) => f.id !== id);
      return {
        project: {
          ...s.project,
          forms,
          activeFormId: s.project.activeFormId === id ? forms[0].id : s.project.activeFormId
        },
        dirty: true
      };
    }),

  setBedrock: (bedrock, description = "Updated form") => {
    const id = get().project.activeFormId;
    get().pushHistory(id, description);
    set((s) => ({
      project: {
        ...s.project,
        forms: s.project.forms.map((f) => (f.id === id ? { ...f, bedrock } : f))
      },
      dirty: true
    }));
  },

  setGlobalActions: (globalActions, description = "Updated global actions") => {
    const active = get().activeForm();
    get().setBedrock({ ...active.bedrock, globalActions } as BedrockForm, description);
  },

  setAssets: (assets) => set((s) => ({ project: { ...s.project, assets }, dirty: true })),

  setPlatformTarget: (platformTarget) =>
    set((s) => ({ project: { ...s.project, platformTarget }, dirty: true }))
});
```

- [ ] **Step 6: Compose them in `src/store/index.ts`**

```ts
import { create } from "zustand";
import { createProjectSlice, ProjectSlice } from "./projectSlice";
import { createSelectionSlice, SelectionSlice } from "./selectionSlice";
import { createHistorySlice, HistorySlice } from "./historySlice";
import { createUiSlice, UiSlice } from "./uiSlice";

export type DesignerStore = ProjectSlice & SelectionSlice & HistorySlice & UiSlice;

export const useDesignerStore = create<DesignerStore>()((...a) => ({
  ...createUiSlice(...(a as Parameters<typeof createUiSlice>)),
  ...createSelectionSlice(...(a as Parameters<typeof createSelectionSlice>)),
  ...createHistorySlice(...a),
  ...createProjectSlice(...a)
}));
```

- [ ] **Step 7: Point the old module at the new one**

`src/core/store.ts` becomes a single re-export so existing imports keep working while the UI
is migrated in the next plan:

```ts
export * from "../store";
```

- [ ] **Step 8: Run the test**

Run: `npx vitest run src/tests/store.spec.ts`
Expected: PASS, 6 tests.

- [ ] **Step 9: Fix the UI call sites the rename breaks**

Run: `npm run typecheck`
Components still reading `bedrock` and `menuName` off the store root need to read
`activeForm().bedrock` and `activeForm().id`. Update each reported site. Do not redesign any
component here; the multi-form UI is the next plan.

- [ ] **Step 10: Verify**

Run: `npm run typecheck && npm test`
Expected: typecheck clean, all tests pass.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "refactor(store): split into project, selection, history and ui slices"
```

---

### Task 17: Legacy migration

**Files:**
- Create: `src/core/migrate.ts`
- Test: `src/tests/migrate.spec.ts`

**Interfaces:**
- Produces: `migrateLegacyDesign(value: unknown): { project: Project; notes: string[] }`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { migrateLegacyDesign } from "../core/migrate";

const LEGACY = {
  configVersion: "1.0.0",
  menuName: "welcome",
  platform: "bedrock",
  bedrock: {
    type: "SIMPLE",
    title: "Welcome",
    content: "Hello",
    buttons: [
      {
        id: "site",
        text: "Website",
        translations: { it: "Sito" },
        priority: 5,
        priorityCondition: "permission:a.b",
        onClick: [{ id: "raw", params: 'url {\n  - "https://example.com"\n}', raw: 'url {\n  - "https://example.com"\n}' }]
      }
    ]
  }
};

describe("migrateLegacyDesign", () => {
  it("produces a one-form project keyed by menuName", () => {
    const { project } = migrateLegacyDesign(LEGACY);
    expect(project.forms).toHaveLength(1);
    expect(project.forms[0].id).toBe("welcome");
    expect(project.activeFormId).toBe("welcome");
  });

  it("drops the keys the plugin ignores and says so", () => {
    const { project, notes } = migrateLegacyDesign(LEGACY);
    const button = (project.forms[0].bedrock as any).buttons[0];
    expect(button.translations).toBeUndefined();
    expect(button.priority).toBeUndefined();
    expect(button.priorityCondition).toBeUndefined();
    expect(notes.join(" ")).toContain("translations");
    expect(notes.join(" ")).toContain("priority");
  });

  it("flags the removed url action but keeps its text", () => {
    const { project, notes } = migrateLegacyDesign(LEGACY);
    const button = (project.forms[0].bedrock as any).buttons[0];
    expect(button.onClick[0].raw).toContain("https://example.com");
    expect(notes.join(" ")).toContain("url");
  });

  it("sets the modern config version", () => {
    expect(migrateLegacyDesign(LEGACY).project.configVersion).toBe(1);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/migrate.spec.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/core/migrate.ts`**

```ts
import { Project, createEmptyProject, createForm } from "./project";
import { ActionInstance, BedrockForm } from "./types";

const IGNORED_BUTTON_KEYS = ["translations", "priority", "priorityCondition"] as const;

export function migrateLegacyDesign(value: unknown): { project: Project; notes: string[] } {
  const legacy = (value ?? {}) as Record<string, any>;
  const notes: string[] = [];
  const project = createEmptyProject();

  const id =
    typeof legacy.menuName === "string" && legacy.menuName.trim() ? legacy.menuName.trim() : "main_menu";
  const form = createForm(id);

  if (legacy.bedrock && typeof legacy.bedrock === "object") {
    form.bedrock = stripForm(legacy.bedrock as BedrockForm, notes);
  }
  if (Array.isArray(legacy.globalActions) && legacy.globalActions.length) {
    form.bedrock = { ...form.bedrock, globalActions: flagUrl(legacy.globalActions, notes) };
  }

  project.forms = [form];
  project.activeFormId = form.id;
  return { project, notes };
}

function stripForm(form: BedrockForm, notes: string[]): BedrockForm {
  const next = { ...form } as any;
  if (Array.isArray(next.buttons)) next.buttons = next.buttons.map((b: any) => stripButton(b, notes));
  if (Array.isArray(next.components)) {
    next.components = next.components.map((c: any) => ({ ...c, action: flagUrl(c.action, notes) }));
  }
  if (next.globalActions) next.globalActions = flagUrl(next.globalActions, notes);
  return next as BedrockForm;
}

function stripButton(button: Record<string, any>, notes: string[]) {
  const next = { ...button };
  for (const key of IGNORED_BUTTON_KEYS) {
    if (next[key] !== undefined) {
      delete next[key];
      note(notes, `Removed ${key} — BedrockGUI 2.0.11 does not read it.`);
    }
  }
  next.onClick = flagUrl(next.onClick, notes);
  return next;
}

function flagUrl(actions: ActionInstance[] | undefined, notes: string[]) {
  if (!actions?.length) return actions;
  for (const action of actions) {
    if (typeof action.raw === "string" && /^\s*url\s*\{/.test(action.raw)) {
      note(
        notes,
        "Kept a url action as raw text — the url action was removed from the plugin and fails at runtime."
      );
    }
  }
  return actions;
}

function note(notes: string[], message: string) {
  if (!notes.includes(message)) notes.push(message);
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/tests/migrate.spec.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/migrate.ts src/tests/migrate.spec.ts
git commit -m "feat(core): migrate legacy single-form designs into projects"
```

---

# Phase 4 — Serialization

### Task 18: Parse a form document

**Files:**
- Create: `src/parse/form.ts`
- Test: `src/tests/parse-form.spec.ts`

**Interfaces:**
- Consumes: `FORM_KEYS`, `BUTTON_KEYS`, `COMPONENT_KEYS`, `parseActionBlock`.
- Produces: `parseFormDocument(text: string, id: string): FormDoc`

Rules this task must honour: `content` may be a string or a list and both survive;
`description` is read only when `content` is absent; `buttons` and `components` are keyed
maps whose keys become element ids; `onClick` and `action` may each be a list or one block
scalar; a `java:` section is captured whole onto `javaRaw` and never interpreted.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseFormDocument } from "../parse/form";

const fixture = (name: string) =>
  fs.readFileSync(path.resolve(__dirname, "fixtures/plugin-forms", name), "utf8");

describe("parseFormDocument", () => {
  it("parses a SIMPLE form with keyed buttons", () => {
    const doc = parseFormDocument(fixture("main_menu.yml"), "main_menu");
    expect(doc.bedrock.type).toBe("SIMPLE");
    expect(doc.bedrock.title).toContain("BedrockGUI Demo");
    const buttons = (doc.bedrock as any).buttons;
    expect(buttons.map((b: any) => b.id)).toContain("economy_shop");
    expect(buttons[0].onClick[0].raw).toContain("open {");
  });

  it("keeps a multi-line content block", () => {
    const doc = parseFormDocument(fixture("main_menu.yml"), "main_menu");
    expect(String(doc.bedrock.content)).toContain("guided tour");
  });

  it("parses CUSTOM components with their props and action", () => {
    const doc = parseFormDocument(fixture("player_settings.yml"), "player_settings");
    expect(doc.bedrock.type).toBe("CUSTOM");
    const components = (doc.bedrock as any).components;
    const slider = components.find((c: any) => c.id === "render_distance");
    expect(slider.type).toBe("slider");
    expect(slider.props.min).toBe(2);
    expect(slider.props.max).toBe(32);
    expect(slider.action[0].raw).toContain("message {");
  });

  it("parses a MODAL with exactly two buttons", () => {
    const doc = parseFormDocument(fixture("confirm_reset.yml"), "confirm_reset");
    expect(doc.bedrock.type).toBe("MODAL");
    expect((doc.bedrock as any).buttons).toHaveLength(2);
  });

  it("keeps show_condition and alternative text", () => {
    const doc = parseFormDocument(fixture("economy_shop.yml"), "economy_shop");
    const admin = (doc.bedrock as any).buttons.find((b: any) => b.id === "admin_restock");
    expect(admin.showCondition).toBe("permission:bedrockgui.admin");
    expect(admin.alternativeText).toContain("requires bedrockgui.admin");
  });

  it("captures a java section without interpreting it", () => {
    const doc = parseFormDocument(fixture("economy_shop.yml"), "economy_shop");
    expect(doc.javaRaw).toBeDefined();
    expect((doc.javaRaw as any).type).toBe("CHEST");
  });

  it("has no java section when the file has none", () => {
    expect(parseFormDocument(fixture("main_menu.yml"), "main_menu").javaRaw).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/parse-form.spec.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/parse/form.ts`**

```ts
import yaml from "js-yaml";
import {
  ActionInstance,
  BedrockButton,
  BedrockButtonConditionRule,
  BedrockComponent,
  BedrockComponentType,
  BedrockForm
} from "../core/types";
import { FormDoc } from "../core/project";

export function parseFormDocument(text: string, id: string): FormDoc {
  const doc = (yaml.load(text) ?? {}) as Record<string, any>;
  const bedrock = (doc.bedrock ?? doc) as Record<string, any>;
  const type = String(bedrock.type ?? "SIMPLE").toUpperCase();

  const base = {
    title: String(bedrock.title ?? "Unknown"),
    content: readContent(bedrock),
    command: str(bedrock.command),
    commandIntercept: str(bedrock.command_intercept),
    permission: str(bedrock.permission),
    globalActions: readActions(bedrock.global_actions)
  };

  const form: BedrockForm =
    type === "CUSTOM"
      ? { ...base, type: "CUSTOM", components: readComponents(bedrock.components) }
      : { ...base, type: type === "MODAL" ? "MODAL" : "SIMPLE", buttons: readButtons(bedrock.buttons) };

  const result: FormDoc = { id, fileName: `${id}.yml`, bedrock: form };
  if (doc.java !== undefined) result.javaRaw = doc.java;
  return result;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readContent(bedrock: Record<string, any>): string | string[] | undefined {
  const content = bedrock.content ?? bedrock.description;
  if (Array.isArray(content)) return content.map(String);
  return typeof content === "string" ? content : undefined;
}

function readActions(value: unknown): ActionInstance[] | undefined {
  const list = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const actions = list
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((raw) => ({ id: "raw", params: raw.trim(), raw: raw.trim() }) as ActionInstance);
  return actions.length ? actions : undefined;
}

function readButtons(value: unknown): BedrockButton[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, any>).map(([id, b]) => {
    const button: BedrockButton = { id, text: String(b?.text ?? "") };
    if (str(b?.image)) button.image = b.image;
    const onClick = readActions(b?.onClick);
    if (onClick) button.onClick = onClick;
    if (str(b?.show_condition)) button.showCondition = b.show_condition;
    if (str(b?.alternative_text)) button.alternativeText = b.alternative_text;
    if (str(b?.alternative_image)) button.alternativeImage = b.alternative_image;
    if (str(b?.alternative_onClick)) button.alternativeOnClick = b.alternative_onClick;
    const conditions = readConditions(b?.conditions);
    if (conditions) button.conditions = conditions;
    return button;
  });
}

function readConditions(value: unknown): BedrockButtonConditionRule[] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const rules = Object.entries(value as Record<string, any>).map(([id, c]) => ({
    id,
    condition: String(c?.condition ?? ""),
    property: (c?.property ?? "text") as BedrockButtonConditionRule["property"],
    value: String(c?.value ?? "")
  }));
  return rules.length ? rules : undefined;
}

function readComponents(value: unknown): BedrockComponent[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, any>).map(([id, raw]) => {
    const { type, action, ...props } = (raw ?? {}) as Record<string, any>;
    const component: BedrockComponent = {
      id,
      type: String(type ?? "input").toLowerCase() as BedrockComponentType,
      props
    };
    const parsed = readActions(action);
    if (parsed) component.action = parsed;
    return component;
  });
}
```

Note on MODAL: the plugin refuses a MODAL that does not have exactly two buttons. Import does
**not** pad or truncate — it keeps what the file says and lets validation report the problem,
because silently inventing a button hides a real config error from the user.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/tests/parse-form.spec.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/parse/form.ts src/tests/parse-form.spec.ts
git commit -m "feat(parse): read BedrockGUI form documents into the project model"
```

---

### Task 19: Serialize a form document

**Files:**
- Create: `src/serialize/form.ts`, `src/serialize/blockScalar.ts`
- Test: `src/tests/serialize-form.spec.ts`

**Interfaces:**
- Produces: `serializeFormDocument(doc: FormDoc): string`, and `applyBlockScalars(yamlText: string): string`

Requirements: emit `content:` never `description:`; emit no `configVersion`, no
`translations`, no `priority`, no `priority_condition`; emit `buttons` and `components` as
keyed maps in model order; emit multi-line strings as `|-` block scalars because the action
grammar depends on it; re-emit `javaRaw` verbatim under `java:` when present.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import yaml from "js-yaml";
import { serializeFormDocument } from "../serialize/form";
import { createForm } from "../core/project";

describe("serializeFormDocument", () => {
  it("writes content, never description", () => {
    const doc = createForm("welcome");
    doc.bedrock.content = "Hello";
    const text = serializeFormDocument(doc);
    expect(text).toContain("content:");
    expect(text).not.toContain("description:");
  });

  it("never writes a config version into a form file", () => {
    expect(serializeFormDocument(createForm("welcome"))).not.toContain("configVersion");
    expect(serializeFormDocument(createForm("welcome"))).not.toContain("config-version");
  });

  it("writes buttons as a keyed map", () => {
    const text = serializeFormDocument(createForm("welcome"));
    const loaded = yaml.load(text) as any;
    expect(Object.keys(loaded.bedrock.buttons)).toEqual(["button_1"]);
  });

  it("emits action blocks as block scalars", () => {
    const doc = createForm("welcome");
    (doc.bedrock as any).buttons[0].onClick = [
      { id: "raw", params: 'message {\n  - "Hi"\n}', raw: 'message {\n  - "Hi"\n}' }
    ];
    expect(serializeFormDocument(doc)).toContain("- |-");
  });

  it("round-trips a preserved java section", () => {
    const doc = createForm("shop");
    doc.javaRaw = { type: "CHEST", size: "27" };
    const loaded = yaml.load(serializeFormDocument(doc)) as any;
    expect(loaded.java).toEqual({ type: "CHEST", size: "27" });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/serialize-form.spec.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Move the block scalar helper into `src/serialize/blockScalar.ts`**

Lift `postprocessMultilineStrings` and `unescapeDoubleQuoted` out of `src/core/yaml.ts`
unchanged, export `applyBlockScalars`, and add a direct unit test that a mapping value and a
list item containing `\n` both become `|-` blocks.

- [ ] **Step 4: Write `src/serialize/form.ts`**

```ts
import yaml from "js-yaml";
import { FormDoc } from "../core/project";
import { ActionInstance, BedrockButton, BedrockComponent } from "../core/types";
import { applyBlockScalars } from "./blockScalar";

export function serializeFormDocument(doc: FormDoc): string {
  const form = doc.bedrock;
  const bedrock: Record<string, unknown> = {};

  if (form.command) bedrock.command = form.command;
  if (form.commandIntercept) bedrock.command_intercept = form.commandIntercept;
  if (form.permission) bedrock.permission = form.permission;
  bedrock.type = form.type;
  bedrock.title = form.title;

  const content = form.content;
  const hasContent = Array.isArray(content) ? content.length > 0 : Boolean(content);
  if (hasContent) bedrock.content = content;

  if (form.type === "CUSTOM") {
    bedrock.components = componentsToMap(form.components ?? []);
  } else {
    bedrock.buttons = buttonsToMap(form.buttons ?? []);
  }

  const globalActions = actionsToList(form.globalActions);
  if (globalActions) bedrock.global_actions = globalActions;

  const document: Record<string, unknown> = { bedrock };
  if (doc.javaRaw !== undefined) document.java = doc.javaRaw;

  return applyBlockScalars(
    yaml.dump(document, { lineWidth: -1, noRefs: true, forceQuotes: true, quotingType: '"' })
  );
}

function buttonsToMap(buttons: BedrockButton[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const b of buttons) {
    const entry: Record<string, unknown> = { text: b.text };
    if (b.image) entry.image = b.image;
    const onClick = actionsToList(b.onClick);
    if (onClick) entry.onClick = onClick;
    if (b.showCondition) entry.show_condition = b.showCondition;
    if (b.alternativeText) entry.alternative_text = b.alternativeText;
    if (b.alternativeImage) entry.alternative_image = b.alternativeImage;
    if (b.alternativeOnClick) entry.alternative_onClick = b.alternativeOnClick;
    if (b.conditions?.length) {
      entry.conditions = Object.fromEntries(
        b.conditions.map((c) => [c.id, { condition: c.condition, property: c.property, value: c.value }])
      );
    }
    out[b.id] = entry;
  }
  return out;
}

function componentsToMap(components: BedrockComponent[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of components) {
    const entry: Record<string, unknown> = { type: c.type, ...c.props };
    const action = actionsToList(c.action);
    if (action) entry.action = action;
    out[c.id] = entry;
  }
  return out;
}

function actionsToList(actions?: ActionInstance[]): string[] | undefined {
  if (!actions?.length) return undefined;
  const list = actions
    .map((a) =>
      typeof a.raw === "string" && a.raw.trim()
        ? a.raw.trim()
        : typeof a.params === "string"
          ? a.params.trim()
          : ""
    )
    .filter(Boolean);
  return list.length ? list : undefined;
}
```

Nothing here ever writes `description`, `configVersion`, `translations`, `priority` or
`priority_condition` — the model no longer carries them, and the golden tests assert their
absence.

- [ ] **Step 5: Run the test**

Run: `npx vitest run src/tests/serialize-form.spec.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add src/serialize src/tests/serialize-form.spec.ts
git commit -m "feat(serialize): write BedrockGUI form documents from the project model"
```

---

### Task 20: Golden round-trip tests

**Files:**
- Test: `src/tests/golden-roundtrip.spec.ts`

**Interfaces:**
- Consumes: `parseFormDocument`, `serializeFormDocument`.
- Produces: the guarantee every later change is measured against.

- [ ] **Step 1: Write the golden test**

```ts
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { parseFormDocument } from "../parse/form";
import { serializeFormDocument } from "../serialize/form";

const dir = path.resolve(__dirname, "fixtures/plugin-forms");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yml"));

describe("golden round-trip against the shipped plugin forms", () => {
  it("has all seven fixtures", () => {
    expect(files).toHaveLength(7);
  });

  for (const file of files) {
    const id = file.replace(/\.yml$/, "");

    it(`${file} survives parse then serialize`, () => {
      const original = fs.readFileSync(path.join(dir, file), "utf8");
      const once = serializeFormDocument(parseFormDocument(original, id));
      const twice = serializeFormDocument(parseFormDocument(once, id));
      expect(twice).toBe(once);
    });

    it(`${file} keeps its semantic content`, () => {
      const original = fs.readFileSync(path.join(dir, file), "utf8");
      const before = yaml.load(original) as any;
      const after = yaml.load(serializeFormDocument(parseFormDocument(original, id))) as any;

      expect(after.bedrock.type ?? "SIMPLE").toBe(before.bedrock.type ?? "SIMPLE");
      expect(after.bedrock.title).toBe(before.bedrock.title);
      expect(after.bedrock.command).toBe(before.bedrock.command);
      expect(after.bedrock.command_intercept).toBe(before.bedrock.command_intercept);
      expect(after.bedrock.permission).toBe(before.bedrock.permission);

      const beforeContent = before.bedrock.content ?? before.bedrock.description;
      if (beforeContent !== undefined) {
        const flat = (v: unknown) => (Array.isArray(v) ? v.join("\n") : v);
        expect(flat(after.bedrock.content)).toBe(flat(beforeContent));
      }

      expect(Object.keys(after.bedrock.buttons ?? {})).toEqual(Object.keys(before.bedrock.buttons ?? {}));
      expect(Object.keys(after.bedrock.components ?? {})).toEqual(Object.keys(before.bedrock.components ?? {}));

      if (before.java) expect(after.java).toEqual(before.java);
    });

    it(`${file} emits none of the keys the plugin ignores`, () => {
      const original = fs.readFileSync(path.join(dir, file), "utf8");
      const text = serializeFormDocument(parseFormDocument(original, id));
      expect(text).not.toContain("translations");
      expect(text).not.toContain("priority_condition");
      expect(text).not.toContain("configVersion");
      expect(text).not.toContain("description:");
    });
  }
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/tests/golden-roundtrip.spec.ts`
Expected: 22 tests. Every failure is a real defect in `parse/form.ts` or `serialize/form.ts`
— fix the code, never the fixture. The fixtures are the plugin's own files and are the
authority.

- [ ] **Step 3: Commit**

```bash
git add src/tests/golden-roundtrip.spec.ts
git commit -m "test: pin serialization against the seven shipped plugin forms"
```

---

### Task 21: config.yml and legacy conversion

**Files:**
- Create: `src/parse/config.ts`, `src/parse/legacy.ts`, `src/serialize/config.ts`
- Test: `src/tests/config-io.spec.ts`

**Interfaces:**
- Produces:
  - `parseConfigDocument(text: string): { configVersion: number; assets: AssetsConfig; registry: Array<{ id: string; file: string }> }`
  - `serializeConfigDocument(project: Project): string`
  - `parseLegacyInlineConfig(text: string): FormDoc[]`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import yaml from "js-yaml";
import { parseConfigDocument } from "../parse/config";
import { serializeConfigDocument } from "../serialize/config";
import { parseLegacyInlineConfig } from "../parse/legacy";
import { createEmptyProject, createForm } from "../core/project";

const REAL_CONFIG = `config-version: 1

assets:
  enabled: false
  port: 0
  host: ""

forms:
  main_menu:
    file: "main_menu.yml"
  shop:
    file: "shop.yml"
`;

describe("parseConfigDocument", () => {
  it("reads the version, assets and registry", () => {
    const parsed = parseConfigDocument(REAL_CONFIG);
    expect(parsed.configVersion).toBe(1);
    expect(parsed.assets).toEqual({ enabled: false, port: 0, host: "" });
    expect(parsed.registry).toEqual([
      { id: "main_menu", file: "main_menu.yml" },
      { id: "shop", file: "shop.yml" }
    ]);
  });
});

describe("serializeConfigDocument", () => {
  it("writes config-version 1 and every form", () => {
    const project = createEmptyProject();
    project.forms.push(createForm("shop"));
    const loaded = yaml.load(serializeConfigDocument(project)) as any;
    expect(loaded["config-version"]).toBe(1);
    expect(loaded.forms.shop.file).toBe("shop.yml");
    expect(loaded.assets).toEqual({ enabled: false, port: 0, host: "" });
  });

  it("never writes configVersion in camel case", () => {
    expect(serializeConfigDocument(createEmptyProject())).not.toContain("configVersion");
  });
});

describe("parseLegacyInlineConfig", () => {
  it("converts inline forms into form documents", () => {
    const legacy = `forms:
  welcome:
    bedrock:
      type: "SIMPLE"
      title: "Welcome"
      buttons:
        go:
          text: "Go"
`;
    const forms = parseLegacyInlineConfig(legacy);
    expect(forms).toHaveLength(1);
    expect(forms[0].id).toBe("welcome");
    expect(forms[0].fileName).toBe("welcome.yml");
    expect(forms[0].bedrock.title).toBe("Welcome");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/config-io.spec.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write `src/parse/config.ts`**

```ts
import yaml from "js-yaml";
import { AssetsConfig } from "../core/project";

export interface ParsedConfig {
  configVersion: number;
  assets: AssetsConfig;
  registry: Array<{ id: string; file: string }>;
}

export function parseConfigDocument(text: string): ParsedConfig {
  const doc = (yaml.load(text) ?? {}) as Record<string, any>;
  const assets = doc.assets ?? {};
  const forms = doc.forms ?? {};
  return {
    configVersion: Number(doc["config-version"] ?? 1),
    assets: {
      enabled: Boolean(assets.enabled),
      port: Number(assets.port ?? 0),
      host: String(assets.host ?? "")
    },
    registry: Object.entries(forms)
      .filter(([, entry]) => entry && typeof entry === "object" && typeof (entry as any).file === "string")
      .map(([id, entry]) => ({ id, file: (entry as any).file }))
  };
}
```

- [ ] **Step 4: Write `src/serialize/config.ts`**

```ts
import yaml from "js-yaml";
import { Project } from "../core/project";

export function serializeConfigDocument(project: Project): string {
  return yaml.dump(
    {
      "config-version": project.configVersion,
      assets: {
        enabled: project.assets.enabled,
        port: project.assets.port,
        host: project.assets.host
      },
      forms: Object.fromEntries(project.forms.map((f) => [f.id, { file: f.fileName }]))
    },
    { lineWidth: -1, noRefs: true }
  );
}
```

- [ ] **Step 5: Write `src/parse/legacy.ts`**

The old inline shape nests a whole form under `forms.<id>`, which is exactly what
`parseFormDocument` already understands, so re-dump each entry and hand it over.

```ts
import yaml from "js-yaml";
import { FormDoc } from "../core/project";
import { parseFormDocument } from "./form";

export function parseLegacyInlineConfig(text: string): FormDoc[] {
  const doc = (yaml.load(text) ?? {}) as Record<string, any>;
  const forms = doc.forms ?? {};
  return Object.entries(forms)
    .filter(([, entry]) => entry && typeof entry === "object" && (entry as any).bedrock)
    .map(([id, entry]) => parseFormDocument(yaml.dump(entry), id));
}
```

- [ ] **Step 6: Run the test**

Run: `npx vitest run src/tests/config-io.spec.ts`
Expected: PASS, 4 tests.

- [ ] **Step 7: Commit**

```bash
git add src/parse src/serialize src/tests/config-io.spec.ts
git commit -m "feat: read and write config.yml, and convert legacy inline configs"
```

---

### Task 22: js-yaml 5, rewire, and delete the old serializer

**Files:**
- Modify: `package.json`, `src/importers/useImporter.ts`, `src/exporters/useExporter.ts`, `src/panels/YamlEditorPanel.tsx`
- Delete: `src/core/yaml.ts`, `src/actions/registry.ts`
- Test: existing suites, including the golden tests

**Interfaces:**
- Consumes: everything from Phase 4.
- Produces: the app running entirely on the new pipeline.

- [ ] **Step 1: Confirm the golden tests are green on js-yaml 4 first**

Run: `npm test`
Expected: all green. This is the behaviour the bump must not change.

- [ ] **Step 2: Bump js-yaml**

```bash
npm install js-yaml@5.4.1 @types/js-yaml@4.0.9
```

- [ ] **Step 3: Run the golden tests immediately**

Run: `npx vitest run src/tests/golden-roundtrip.spec.ts src/tests/plugin/grammar.spec.ts`
Expected: PASS. If block scalar output or quoting changed, fix `blockScalar.ts` or the dump
options until the golden tests pass again. If js-yaml 5 cannot be made to match, revert to
`js-yaml@4.1.0` and note it — the golden tests are worth more than the bump.

- [ ] **Step 4: Point the importer at the new parser**

`useImporter` reads a file, decides whether it is a `config.yml`, a form document or a legacy
inline config, and calls `parseConfigDocument`, `parseFormDocument` or
`parseLegacyInlineConfig` accordingly, then `loadProject`.

- [ ] **Step 5: Point the exporter at the new serializer**

`useExporter` exports the active form with `serializeFormDocument`. Project ZIP export is the
next plan; keep single-file export working here.

- [ ] **Step 6: Point the YAML panel at the new serializer**

`YamlEditorPanel` renders `serializeFormDocument(activeForm())`.

- [ ] **Step 7: Delete the superseded modules**

```bash
git rm src/core/yaml.ts src/actions/registry.ts
```

Update every importer of those modules. `ActionEditor`, `ActionPicker`, `ActionBlock` and
`VisualActionEditor` import the registry — repoint them at `src/plugin/actions.ts`, whose
`ACTIONS` map carries the label and hint they need. The `url` entry is gone, so any switch
over action ids that mentions it must drop that branch.

- [ ] **Step 8: Update the old round-trip specs**

`src/tests/yaml-roundtrip.spec.tsx` and `src/tests/exporter.spec.ts` import `src/core/yaml.ts`.
Repoint them at `src/serialize/form.ts` and `src/parse/form.ts`. Any assertion that expected
`description:` or `configVersion` in a form file is now asserting the old defect — update it
to assert `content:` and the absence of a config version.

- [ ] **Step 9: Full verification**

Run: `npm run typecheck && npm test && npm run build && npm run check:bundle`
Expected: all four succeed.

- [ ] **Step 10: Confirm the app works by hand**

Run: `npm run dev`
Expected: the designer loads, the YAML panel shows `bedrock:` with `content:`, exporting
writes a file the plugin would accept, and importing
`src/tests/fixtures/plugin-forms/economy_shop.yml` reproduces the shop with its buttons.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: run the designer on the contract-driven serializer"
```

---

## What this plan does not cover

Phases 5 to 9 of the spec — multi-form UI, typed action editors, the addon picker, preview
fidelity and hardening — are a second plan, written once this one lands so it can be built
against the interfaces these tasks actually produce.

At the end of this plan the app is working and correct: it reads and writes real BedrockGUI
2.0.11 configuration, holds a project of many forms in its model, and knows the plugin's
capabilities from one versioned contract. It edits one form at a time, through the existing
UI.
