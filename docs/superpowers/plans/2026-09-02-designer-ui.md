# BedrockGUI Designer UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the multi-form project model in front of the user, replace the ad-hoc action editors with ones driven by the plugin contract, and make the preview show what the plugin will actually render.

**Architecture:** The foundation branch built `src/plugin/` (the contract), a `Project` of many `FormDoc`s, and contract-driven serialization — but the UI still edits one form and several panels still carry their own copies of contract knowledge. This plan wires the UI onto what already exists: a form switcher over the store actions that are already implemented and unused, editors that call `src/plugin/grammar.ts` instead of hand-rolled regexes, and pickers that read the contract's tables instead of duplicating them.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Vitest 4, Tailwind 4, Zustand 5, Zod 4, js-yaml 5, @dnd-kit, fflate (new, for ZIP).

**Spec:** `docs/superpowers/specs/2026-09-01-designer-v2011-parity-design.md` — phases 5 to 9.
**Handoff from the foundation branch:** `docs/superpowers/specs/2026-09-01-designer-v2011-parity-handoff.md` — read its "Open items" section; this plan closes most of it.

## Scope decision — the designer does not own `config.yml`

Taken by the user on 2026-09-02, after Task 4 shipped a `config.yml`-emitting ZIP.

The designer works in the modern one-file-per-form layout and exports **form files only**. It
never writes a `config.yml`. After an export it shows a modal containing the `forms:` registry
entries the user pastes into their server's config to register what they just exported.

Why: `config.yml` holds exactly three things — `config-version`, `assets` and the `forms`
registry. Two of those are server infrastructure, not GUI design. Emitting the file forced the
designer to invent values for `assets`, and anyone overwriting their live config with our export
would silently lose their asset-server settings. Not emitting it removes the whole class of
problem instead of managing it.

Consequences, which override the task text further down where they conflict:

- **No asset-server UI.** `ProjectSettingsPanel` keeps only the platform target, which is genuine
  design input because it gates which actions are offered.
- **No `config.yml` in the export.** The ZIP contains `forms/*.yml` and nothing else.
- **A post-export modal** lists the registry snippet for the exported forms.
- **`Project.assets` stays on the model** but is never edited in the UI. It costs nothing and
  preserves values if a config is ever read.
- **Import still reads a `config.yml` when one is present in an archive, for form IDs only.** The
  plugin keys forms by id and an id may differ from its filename — `shop` can live in `store.yml`
  — so ignoring a registry that is present would import that form under the wrong id. Reading it
  is not the same as owning it, and nothing is ever written back.
- The question of preserving unknown `config.yml` keys is moot, since the file is no longer
  emitted.

## Global Constraints

- Target plugin version is **BedrockGUI 2.0.11**. `PLUGIN_TARGET` in `src/plugin/index.ts`.
- **Java menus are out of scope, permanently.** A `java:` block rides on `FormDoc.javaRaw` and is re-emitted verbatim. Never author, validate, preview or generate one.
- **There is no `url` action.** 14 actions exist. Never reintroduce it.
- **`src/plugin/` is the single source of truth and is data-only.** It imports nothing from the app. When a panel needs to know something about the plugin, it imports from `src/plugin/` — it does not keep its own copy. Adding a second copy of contract knowledge anywhere is the specific failure this whole rewrite exists to prevent.
- **The 23 golden tests in `src/tests/golden-roundtrip.spec.ts` must stay green in every task.** They pin serialization against the seven byte-exact plugin fixtures in `src/tests/fixtures/plugin-forms/`, which must never be edited to make a test pass.
- **`parseProject` enforces structural validity only.** A 3-button MODAL, a 0-component CUSTOM form and an empty button text are authoring states a user passes through — they must remain saveable. `ValidationPanel` is what reports them. Do not re-tighten the schema.
- Every task ends green: `npm run typecheck` clean, `npm test` passing, `npm run build` succeeding, `npm run check:bundle` passing.
- House rule: **no explanatory comments in code.** Write the change only.
- Plugin source for verification lives at `C:\Users\pintu\Desktop\Server\BedrockGUI` and is **read-only**.
- `yaml.load` from **js-yaml** is the safe loader — since v4 it uses the default schema and constructs no arbitrary types. Do not substitute a custom `Loader`, and do not confuse it with PyYAML's unsafe `yaml.load`.
- Assert on CONTENT, not lengths. For anything that produces a user-facing message, assert the message text — a length-only assertion on a diagnostic tests nothing.

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `src/panels/FormSwitcher.tsx` | the left-pane list of forms: select, add, rename, duplicate, delete |
| `src/panels/ProjectSettingsPanel.tsx` | `assets` (enabled/port/host) and `platformTarget` |
| `src/serialize/project.ts` | whole project to a ZIP mirroring `plugins/BedrockGUI/` |
| `src/parse/project.ts` | a ZIP or a set of files back to a `Project` |
| `src/actions/editors/` | one typed editor per action body shape, over `grammar.ts` |
| `src/components/OpenTargetPicker.tsx` | pick an `open` target from project forms or addon ids |
| `src/components/ImagePicker.tsx` | pick a button image by the contract's seven source kinds |
| `src/core/validateProject.ts` | cross-form validation, contract-driven |

**Modified:** `src/store/historySlice.ts` and `projectSlice.ts` (project-level undo), `src/app/DesignerShell.tsx` (left pane), `src/actions/VisualActionEditor.tsx` and `ActionBlock.tsx` (typed editors), `src/components/ConditionBuilder.tsx` and `PlaceholderPicker.tsx` (contract-driven), `src/panels/ValidationPanel.tsx` (cross-form), `src/core/minecraftText.ts` (hex + MiniMessage), `src/canvas/previews/BedrockPreview.tsx` (image resolution), `src/importers/useImporter.ts` and `src/exporters/useExporter.ts` (ZIP), `src/parse/form.ts` and `src/serialize/form.ts` (use `FORM_KEYS`/`BUTTON_KEYS`).

---

# Phase 5 — Multi-form UI

### Task 1: Project-level undo

**Files:**
- Modify: `src/store/historySlice.ts`, `src/store/projectSlice.ts`
- Test: `src/tests/store.spec.ts`

**Interfaces:**
- Consumes: `Project`, `FormDoc` from `src/core/project.ts`.
- Produces on the store:
  - `projectHistory: { undo: ProjectHistoryEntry[]; redo: ProjectHistoryEntry[] }`
  - `interface ProjectHistoryEntry { project: Project; description: string; timestamp: number }`
  - `pushProjectHistory(description: string): void`
  - `undo()` and `redo()` gain project-level awareness (see Step 3)

Per-form history covers content edits and is keyed by form id. It cannot express "a form was
deleted", because that form's history dies with it. Structural changes therefore get their own
shallow whole-project stack, capped at 20 entries so a long session does not accumulate clones of
every revision.

- [ ] **Step 1: Write the failing test**

```ts
it("undoes a form deletion", () => {
  const s = () => useDesignerStore.getState();
  s().loadProject(createEmptyProject());
  s().addForm("shop");
  expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);
  s().removeForm("shop");
  expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu"]);
  s().undo();
  expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);
});

it("undoes an add, a rename and a duplicate", () => {
  const s = () => useDesignerStore.getState();
  s().loadProject(createEmptyProject());
  s().addForm("shop");
  s().undo();
  expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu"]);
  s().renameForm("main_menu", "hub");
  s().undo();
  expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu"]);
  s().duplicateForm("main_menu");
  s().undo();
  expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu"]);
});

it("keeps content undo working alongside structural undo", () => {
  const s = () => useDesignerStore.getState();
  s().loadProject(createEmptyProject());
  const before = s().activeForm().bedrock.title;
  s().setBedrock({ ...s().activeForm().bedrock, title: "Changed" });
  s().addForm("shop");
  s().undo();
  expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu"]);
  s().undo();
  expect(s().activeForm().bedrock.title).toBe(before);
});

it("caps the project history at 20 entries", () => {
  const s = () => useDesignerStore.getState();
  s().loadProject(createEmptyProject());
  for (let i = 0; i < 30; i++) s().addForm(`form_${i}`);
  expect(s().projectHistory.undo.length).toBe(20);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/store.spec.ts -t "undoes a form deletion"`
Expected: FAIL — `undo` restores nothing structural today.

- [ ] **Step 3: Implement**

In `src/store/historySlice.ts` add the project stack alongside the per-form one:

```ts
export interface ProjectHistoryEntry {
  project: Project;
  description: string;
  timestamp: number;
}

const PROJECT_HISTORY_LIMIT = 20;
```

`pushProjectHistory(description)` clones the whole current project onto `projectHistory.undo`,
trims to the newest `PROJECT_HISTORY_LIMIT`, and clears `projectHistory.redo`.

`undo()` decides which stack to pop by **recency**: compare the newest `timestamp` on the active
form's per-form undo stack against the newest on `projectHistory.undo`, and pop whichever is
later. That is what makes the two stacks read as one history to the user. `redo()` mirrors it.
When the project stack is popped, push the current project onto `projectHistory.redo` first.

In `src/store/projectSlice.ts`, call `get().pushProjectHistory(...)` at the top of `addForm`,
`renameForm`, `duplicateForm`, `removeForm`, `setAssets` and `setPlatformTarget`, before each
writes. Use a description naming the change, e.g. `` `Deleted form ${id}` ``.

Also fix the leak the foundation review recorded: `removeForm` must delete `history[id]`, or a
later form with the same id inherits the deleted form's content undo stack.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/tests/store.spec.ts`
Expected: PASS, including the pre-existing per-form history tests.

- [ ] **Step 5: Commit**

```bash
git add src/store src/tests/store.spec.ts
git commit -m "feat(store): add project-level undo for structural changes"
```

---

### Task 2: Form switcher

**Files:**
- Create: `src/panels/FormSwitcher.tsx`
- Modify: `src/app/DesignerShell.tsx`
- Test: `src/tests/form-switcher.spec.tsx`

**Interfaces:**
- Consumes: `useDesignerStore`'s `project`, `activeForm`, `setActiveForm`, `addForm`,
  `renameForm`, `duplicateForm`, `removeForm` — all already implemented and currently unused by
  any UI.
- Produces: `<FormSwitcher />`, rendered above `FormTypePanel` in the left pane.

The chosen shape is a left-sidebar list. It sits above `FormTypePanel` in the existing
"Components" tab of the left pane, so no new chrome is added to the shell.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { FormSwitcher } from "../panels/FormSwitcher";
import { useDesignerStore } from "../store";
import { createEmptyProject } from "../core/project";

beforeEach(() => useDesignerStore.getState().loadProject(createEmptyProject()));

it("lists every form and marks the active one", () => {
  useDesignerStore.getState().addForm("shop");
  render(<FormSwitcher />);
  expect(screen.getByText("main_menu")).toBeInTheDocument();
  expect(screen.getByText("shop")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /main_menu/ })).toHaveAttribute("aria-current", "true");
});

it("switches the active form on click", () => {
  useDesignerStore.getState().addForm("shop");
  render(<FormSwitcher />);
  fireEvent.click(screen.getByRole("button", { name: /shop/ }));
  expect(useDesignerStore.getState().project.activeFormId).toBe("shop");
});

it("adds a form", () => {
  render(<FormSwitcher />);
  fireEvent.click(screen.getByRole("button", { name: "Add form" }));
  expect(useDesignerStore.getState().project.forms.length).toBe(2);
});

it("refuses to delete the last remaining form", () => {
  render(<FormSwitcher />);
  expect(screen.queryByRole("button", { name: /Delete main_menu/ })).toBeNull();
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/form-switcher.spec.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/panels/FormSwitcher.tsx`**

Render a `FORMS` section header with an add control, then one row per `project.forms` entry. Each
row is a button carrying the form id, `aria-current={id === project.activeFormId}`, and calls
`setActiveForm(id)`. Give each row a duplicate and a delete control, and hide delete when
`project.forms.length === 1` — `removeForm` already refuses that case, and offering a control that
silently does nothing is worse than not offering it.

Deleting asks first, using the existing imperative confirm singleton:

```ts
import { confirm as confirmDialog } from "../core/confirm";

const ok = await confirmDialog({
  title: "Delete form",
  message: `Delete form '${id}'? You can undo this with Ctrl+Z.`,
  confirmText: "Delete",
  cancelText: "Cancel"
});
if (ok) removeForm(id);
```

The message names undo deliberately — Task 1 made that true, and a confirm that tells the user
their escape hatch is far less frightening than one that does not.

Renaming reuses the existing `BufferedInput` pattern from `PropertiesPanel`, committing on blur via
`renameForm`. `renameForm` already refuses a duplicate id and an empty one; surface that refusal
with a toast rather than letting the field silently snap back:

```ts
import { toast } from "../core/toast";
// after a rename attempt that left the id unchanged
toast.error(`Cannot rename to '${next}' — a form with that id already exists.`);
```

Use the existing `brand-*` Tailwind tokens and the `ui-btn-*` classes so it matches the
surrounding panels. Do not introduce new colour values.

- [ ] **Step 4: Mount it in the shell**

In `src/app/DesignerShell.tsx`, render `<FormSwitcher />` immediately above `<FormTypePanel />` in
both places the left pane's Components tab is composed (there are two — a desktop branch and a
mobile branch; check both).

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/tests/form-switcher.spec.tsx && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/panels/FormSwitcher.tsx src/app/DesignerShell.tsx src/tests/form-switcher.spec.tsx
git commit -m "feat(ui): add the form switcher to the left pane"
```

---

### Task 3: Project settings panel

**Files:**
- Create: `src/panels/ProjectSettingsPanel.tsx`
- Modify: `src/app/DesignerShell.tsx`
- Test: `src/tests/project-settings.spec.tsx`

**Interfaces:**
- Consumes: `project.assets`, `project.platformTarget`, `setAssets`, `setPlatformTarget`,
  and `PLATFORM_CAPABILITIES` / `actionsForPlatform` from `src/plugin`.
- Produces: `<ProjectSettingsPanel />`.

Both store actions exist and have no UI caller today, which means the platform gating already
wired into `ActionPicker` is inert — a Velocity user is offered `sound` and `economy`, which their
proxy cannot execute.

- [ ] **Step 1: Write the failing test**

```tsx
it("edits the asset server settings", () => {
  render(<ProjectSettingsPanel />);
  fireEvent.click(screen.getByRole("checkbox", { name: /Enable asset server/ }));
  expect(useDesignerStore.getState().project.assets.enabled).toBe(true);
});

it("changes the platform target and narrows the available actions", () => {
  render(<ProjectSettingsPanel />);
  fireEvent.change(screen.getByRole("combobox", { name: /Platform/ }), { target: { value: "velocity" } });
  expect(useDesignerStore.getState().project.platformTarget).toBe("velocity");
  expect(actionsForPlatform("velocity").map((a) => a.id)).not.toContain("sound");
});

it("warns that sound and economy are unavailable on a proxy", () => {
  useDesignerStore.getState().setPlatformTarget("bungee");
  render(<ProjectSettingsPanel />);
  expect(screen.getByText(/sound.*economy/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/project-settings.spec.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

A collapsible section with: an `enabled` checkbox, `port` (number) and `host` (text) inputs bound
to `setAssets`, and a `platformTarget` select over `paper | velocity | bungee`.

When the selected platform is not `paper`, list the actions it cannot run, derived from the
contract rather than hardcoded:

```ts
const unavailable = ACTION_IDS.filter((id) => !actionsForPlatform(platform).some((a) => a.id === id));
```

Render that as a note naming them, e.g. "Velocity cannot run: sound, economy". Deriving it means it
stays correct if the contract's capability table ever changes.

- [ ] **Step 4: Mount it** in the right pane's Properties tab, above the form settings section.

- [ ] **Step 5: Run and commit**

```bash
npm test
git add src/panels/ProjectSettingsPanel.tsx src/app/DesignerShell.tsx src/tests/project-settings.spec.tsx
git commit -m "feat(ui): add project settings for assets and platform target"
```

---

### Task 4: ZIP export

**Files:**
- Create: `src/serialize/project.ts`
- Modify: `src/exporters/useExporter.ts`, `package.json`
- Test: `src/tests/project-zip.spec.ts`

**Interfaces:**
- Consumes: `serializeFormDocument`, `serializeConfigDocument` (the latter currently has no
  production caller — this task gives it one).
- Produces: `serializeProjectToZip(project: Project): Uint8Array`.

- [ ] **Step 1: Install fflate**

```bash
npm install fflate
```

Chosen over JSZip for bundle size; `npm run check:bundle` is a gate and JSZip is several times
larger for what is a flat archive of small text files.

- [ ] **Step 2: Write the failing test**

```ts
import { unzipSync, strFromU8 } from "fflate";

it("writes a config.yml and one file per form", () => {
  const project = createEmptyProject();
  project.forms.push(createForm("shop"));
  const files = unzipSync(serializeProjectToZip(project));
  expect(Object.keys(files).sort()).toEqual([
    "config.yml",
    "forms/main_menu.yml",
    "forms/shop.yml"
  ]);
  const config = yaml.load(strFromU8(files["config.yml"])) as any;
  expect(config["config-version"]).toBe(1);
  expect(config.forms.shop.file).toBe("shop.yml");
  const form = yaml.load(strFromU8(files["forms/shop.yml"])) as any;
  expect(form.bedrock.type).toBe("SIMPLE");
});

it("registers a form by id even when its filename differs", () => {
  const project = createEmptyProject();
  const f = createForm("shop");
  f.fileName = "store.yml";
  project.forms.push(f);
  const files = unzipSync(serializeProjectToZip(project));
  expect(files["forms/store.yml"]).toBeDefined();
  const config = yaml.load(strFromU8(files["config.yml"])) as any;
  expect(config.forms.shop.file).toBe("store.yml");
});
```

The second test matters: the plugin keys forms by **id**, not filename, and `open` targets the id.
Conflating them is an easy bug to write.

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run src/tests/project-zip.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/serialize/project.ts`**

```ts
import { zipSync, strToU8 } from "fflate";
import { Project } from "../core/project";
import { serializeFormDocument } from "./form";
import { serializeConfigDocument } from "./config";

export function serializeProjectToZip(project: Project): Uint8Array {
  const files: Record<string, Uint8Array> = {
    "config.yml": strToU8(serializeConfigDocument(project))
  };
  for (const form of project.forms) {
    files[`forms/${form.fileName}`] = strToU8(serializeFormDocument(form));
  }
  return zipSync(files);
}
```

- [ ] **Step 5: Wire the exporter**

`useExporter` gains `exportProjectZip()` downloading `<projectName>.zip`, keeping the existing
single-form `exportYaml()`. Name the download from the active form's project — there is no project
name field, so use `bedrockgui-forms.zip`.

- [ ] **Step 6: Run and commit**

```bash
npm test && npm run check:bundle
git add package.json package-lock.json src/serialize/project.ts src/exporters/useExporter.ts src/tests/project-zip.spec.ts
git commit -m "feat(export): export the whole project as a plugin-shaped ZIP"
```

---

### Task 5: ZIP and multi-file import

**Files:**
- Create: `src/parse/project.ts`
- Modify: `src/importers/useImporter.ts`
- Test: `src/tests/project-zip.spec.ts`

**Interfaces:**
- Consumes: `parseConfigDocument`, `parseFormDocument`, `parseLegacyInlineConfig`, `parseProject`.
- Produces: `parseProjectFromZip(bytes: Uint8Array): { project: Project; notes: string[] }`.

- [ ] **Step 1: Write the failing test**

```ts
it("round-trips a project through the ZIP", () => {
  const project = createEmptyProject();
  project.forms.push(createForm("shop"));
  project.assets = { enabled: true, port: 8123, host: "mc.example.com" };
  const { project: back } = parseProjectFromZip(serializeProjectToZip(project));
  expect(back.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);
  expect(back.assets).toEqual({ enabled: true, port: 8123, host: "mc.example.com" });
});

it("reports a form registered in config.yml whose file is missing", () => {
  const files = unzipSync(serializeProjectToZip((() => {
    const p = createEmptyProject();
    p.forms.push(createForm("shop"));
    return p;
  })()));
  delete files["forms/shop.yml"];
  const { project, notes } = parseProjectFromZip(zipSync(files));
  expect(project.forms.map((f) => f.id)).toEqual(["main_menu"]);
  expect(notes.join(" ")).toContain("shop.yml");
});

it("imports a ZIP holding form files but no config.yml", () => {
  const files = { "forms/a.yml": strToU8(serializeFormDocument(createForm("a"))) };
  const { project, notes } = parseProjectFromZip(zipSync(files));
  expect(project.forms.map((f) => f.id)).toEqual(["a"]);
  expect(notes.join(" ")).toContain("config.yml");
});
```

The missing-file case is the one that matters: a hand-assembled archive is exactly where a
registry entry loses its file, and dropping it silently would leave the user wondering where their
form went.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/project-zip.spec.ts -t "round-trips a project"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/parse/project.ts`**

```ts
import { unzipSync, strFromU8 } from "fflate";
import { Project, FormDoc, createEmptyProject } from "../core/project";
import { parseConfigDocument } from "./config";
import { parseFormDocument } from "./form";
import { parseProject } from "../core/projectSchemas";

export function parseProjectFromZip(bytes: Uint8Array): { project: Project; notes: string[] } {
  const files = unzipSync(bytes);
  const notes: string[] = [];
  const project = createEmptyProject();
  const forms: FormDoc[] = [];

  const configEntry = files["config.yml"];
  if (configEntry) {
    const config = parseConfigDocument(strFromU8(configEntry));
    project.configVersion = 1;
    project.assets = config.assets;
    for (const { id, file } of config.registry) {
      const entry = files[`forms/${file}`];
      if (!entry) {
        notes.push(`config.yml registers '${id}' as forms/${file}, but that file is not in the archive — skipped.`);
        continue;
      }
      const doc = parseFormDocument(strFromU8(entry), id);
      doc.fileName = file;
      forms.push(doc);
    }
  } else {
    notes.push("No config.yml in the archive — every forms/*.yml was imported using its file name as the form id.");
    for (const path of Object.keys(files)) {
      if (!path.startsWith("forms/") || !path.endsWith(".yml")) continue;
      const file = path.slice("forms/".length);
      const id = file.replace(/\.yml$/, "");
      const doc = parseFormDocument(strFromU8(files[path]), id);
      doc.fileName = file;
      forms.push(doc);
    }
  }

  if (forms.length) {
    project.forms = forms;
    project.activeFormId = forms[0].id;
  } else {
    notes.push("No forms were found in the archive — an empty project was created instead.");
  }

  const validated = parseProject(project);
  if (!validated.ok) notes.push(...validated.problems);
  return { project, notes };
}
```

Note the id comes from the REGISTRY KEY, never the filename — the plugin keys forms by id and
`open` targets the id, so a form whose file is `store.yml` may still be registered as `shop`.

- [ ] **Step 4: Wire the importer**

`useImporter` inspects the dropped file: `.zip` goes to `parseProjectFromZip`, `.yml` keeps the
existing single-form and legacy-config handling. Surface every note as a toast, as the legacy
migration already does.

This also closes a handoff item: legacy multi-form import currently strands forms and drops
`assets`. Route the legacy path through the same project assembly so `setAssets` is called
regardless of whether the config had inline forms.

- [ ] **Step 5: Run and commit**

```bash
npm test
git add src/parse/project.ts src/importers/useImporter.ts src/tests/project-zip.spec.ts
git commit -m "feat(import): import a project from a ZIP or a set of form files"
```

---

# Phase 6 — Editors

### Task 6: Typed action editors over the grammar

**Files:**
- Create: `src/actions/editors/LinesEditor.tsx`, `ConditionalEditor.tsx`, `RandomEditor.tsx`, `BungeeEditor.tsx`, `RawEditor.tsx`, `index.ts`
- Modify: `src/actions/ActionBlock.tsx`, `src/actions/VisualActionEditor.tsx`
- Test: `src/tests/action-editors.spec.tsx`

**Interfaces:**
- Consumes: `parseActionBlock`, `serializeActionBlock`, `ParsedAction` from `src/plugin/grammar.ts`;
  `ACTIONS`, `ActionId` from `src/plugin/actions.ts`.
- Produces: `<ActionEditor action={ParsedAction} onChange={(next: ParsedAction) => void} />` from
  `src/actions/editors/index.ts`, dispatching on `action.kind`.

`VisualActionEditor` was partly moved onto `grammar.ts` during the foundation's fix wave. This task
finishes the job: every edit path goes through `ParsedAction`, and no component re-implements
parsing. One editor per `kind` keeps each file small and lets `raw` stay a genuine escape hatch
rather than a fallback that mangles.

- [ ] **Step 1: Write the failing test**

```tsx
it("edits a lines action without touching the others", () => {
  const parsed = parseActionBlock('message {\n  - "a"\n  - "b"\n}');
  const onChange = vi.fn();
  render(<ActionEditor action={parsed} onChange={onChange} />);
  fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "changed" } });
  fireEvent.blur(screen.getAllByRole("textbox")[1]);
  expect(onChange).toHaveBeenCalledWith({ kind: "lines", id: "message", lines: ["a", "changed"] });
});

it("edits a conditional branch without flattening a nested conditional", () => {
  const src = fs.readFileSync(FIXTURE("advanced_flow.yml"), "utf8");
  const nested = findNestedConditional(src);
  const parsed = parseActionBlock(nested);
  const onChange = vi.fn();
  render(<ActionEditor action={parsed} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText(/check/i), { target: { value: "permission:a.b" } });
  fireEvent.blur(screen.getByLabelText(/check/i));
  const next = onChange.mock.calls[0][0];
  expect(next.kind).toBe("conditional");
  expect(next.check).toBe("permission:a.b");
  expect(next.whenTrue.some((a: any) => a.kind === "conditional")).toBe(true);
});

it("keeps an unrecognised block as raw and returns it unchanged", () => {
  const text = 'url {\n  - "https://example.com"\n}';
  const parsed = parseActionBlock(text);
  expect(parsed.kind).toBe("raw");
  const onChange = vi.fn();
  render(<ActionEditor action={parsed} onChange={onChange} />);
  expect(screen.getByRole("textbox")).toHaveValue(text);
});

it("edits weighted random entries", () => {
  const parsed = parseActionBlock('random {\n  - "message:a@3.0"\n  - "message:b@1.0"\n}');
  const onChange = vi.fn();
  render(<ActionEditor action={parsed} onChange={onChange} />);
  fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "5" } });
  fireEvent.blur(screen.getAllByRole("spinbutton")[0]);
  expect(onChange.mock.calls[0][0].entries[0]).toEqual({ text: "message:a", weight: 5 });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/action-editors.spec.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the editors**

`LinesEditor` renders one text input per line with add/remove, plus the action's
`placeholder` and `formatExample` from `ACTIONS[id]` as guidance. `ConditionalEditor` renders the
`check` field and recursively renders `<ActionEditor>` for each entry of `whenTrue` and
`whenFalse` — recursion is what makes nesting work, and it is why this must not be line-based.
`RandomEditor` renders text plus an optional numeric weight per entry. `BungeeEditor` renders
`subchannel` plus its args. `RawEditor` is a single textarea bound to `text`, and its `onChange`
emits `{ kind: "raw", text }` unchanged.

`index.ts` dispatches on `kind` and is the only export other components use.

- [ ] **Step 4: Repoint `ActionBlock` and `VisualActionEditor`** at `<ActionEditor>`, deleting any
remaining ad-hoc splitting or joining. If either file still holds a regex that parses action text,
it goes.

- [ ] **Step 5: Run and commit**

```bash
npm test
git add src/actions src/tests/action-editors.spec.tsx
git commit -m "feat(actions): typed editors driven by the plugin grammar"
```

---

### Task 7: Condition builder on the contract

**Files:**
- Modify: `src/components/ConditionBuilder.tsx`
- Test: `src/tests/condition-builder.spec.tsx`

**Interfaces:**
- Consumes: `OPERATORS`, `operatorsFor`, `ATOM_KINDS`, `validateCondition`, `ConditionContext`
  from `src/plugin/conditions.ts`.

The builder currently emits conditions the app's own validator rejects — `bedrock_player` with no
value, and a symbol-operator placeholder in a colon context. It also mis-parses `not:permission:x`
because it splits the type on the first colon.

- [ ] **Step 1: Write the failing test**

```tsx
it("emits only conditions its own validator accepts", () => {
  for (const kind of ATOM_KINDS) {
    const onChange = vi.fn();
    render(<ConditionBuilder value="" context="colon" onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox", { name: /type/i }), { target: { value: kind } });
    const emitted = onChange.mock.calls.at(-1)![0];
    expect(validateCondition(emitted, "colon")).toEqual([]);
  }
});

it("round-trips a negated permission", () => {
  render(<ConditionBuilder value="not:permission:my.perm" context="colon" onChange={vi.fn()} />);
  expect(screen.getByRole("combobox", { name: /type/i })).toHaveValue("not:permission");
  expect(screen.getByRole("textbox", { name: /value/i })).toHaveValue("my.perm");
});

it("offers only the operators legal in the current context", () => {
  const { rerender } = render(<ConditionBuilder value="" context="colon" onChange={vi.fn()} />);
  expect(screen.getByRole("option", { name: /greater_than/ })).toBeInTheDocument();
  rerender(<ConditionBuilder value="" context="symbol" onChange={vi.fn()} />);
  expect(screen.queryByRole("option", { name: /greater_than/ })).toBeNull();
});

it("offers only the atoms a conditional check supports", () => {
  render(<ConditionBuilder value="" context="symbol" onChange={vi.fn()} />);
  expect(screen.queryByRole("option", { name: /bedrock_player/ })).toBeNull();
  expect(screen.getByRole("option", { name: /permission/ })).toBeInTheDocument();
});
```

That last test encodes a fact from the plugin source that is not in its docs: a `conditional`
action's `check:` is evaluated by `ConditionalActionHandler.evaluateSingleCondition`, which
supports only `placeholder:` and `permission:` — `plugin:`, `bedrock_player:`, `java_player:` and
`not:` always evaluate false there.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/condition-builder.spec.tsx`
Expected: FAIL — the builder emits `bedrock_player` with no value and offers atoms the symbol
context rejects.

- [ ] **Step 3: Implement**

Take the atom list from `ATOM_KINDS`, filtered by context. Take operators from
`operatorsFor(context)`. Parse the incoming value by longest-prefix match against the atom kinds
rather than `split(":")[0]`, so `not:permission` resolves correctly. Emit `bedrock_player:true` and
`java_player:true`, never the bare form. Seed the placeholder example in the syntax the context
actually uses.

Before emitting, run `validateCondition(next, context)` and show any problem inline — the builder
should never hand the user a value its own panel will flag.

- [ ] **Step 4: Fix the duplicated hint** at `src/panels/PropertiesPanel.tsx` around line 191,
which shows the same wrong syntax example. Derive it from the contract instead.

- [ ] **Step 5: Run and commit**

```bash
npm test
git add src/components/ConditionBuilder.tsx src/panels/PropertiesPanel.tsx src/tests/condition-builder.spec.tsx
git commit -m "feat(ui): drive the condition builder from the contract"
```

---

### Task 8: Placeholder and image pickers on the contract

**Files:**
- Modify: `src/components/PlaceholderPicker.tsx`
- Create: `src/components/ImagePicker.tsx`
- Modify: `src/panels/PropertiesPanel.tsx`
- Test: `src/tests/pickers.spec.tsx`

**Interfaces:**
- Consumes: `BUILTIN_PLACEHOLDERS`, `componentReference` from `src/plugin/placeholders.ts`;
  `classifyImage`, `ImageKind`, `NO_ICON_MATERIALS`, `ASSET_EXTENSIONS` from `src/plugin/images.ts`.
- Produces: `<ImagePicker value={string} onChange={(next: string) => void} />`.

`PlaceholderPicker` keeps its own `PLACEHOLDERS` table. It happens to be correct — it lists all
twelve, including the six the documentation omits — but it is a second source of truth and must
import from the contract instead.

- [ ] **Step 1: Write the failing test**

```tsx
it("offers exactly the contract's built-in placeholders", () => {
  render(<PlaceholderPicker onSelect={vi.fn()} />);
  for (const p of BUILTIN_PLACEHOLDERS) {
    expect(screen.getByText(p.token)).toBeInTheDocument();
  }
  expect(screen.queryByText("{money}")).toBeNull();
});

it("marks the Paper-only placeholders", () => {
  render(<PlaceholderPicker onSelect={vi.fn()} />);
  const health = screen.getByText("{health}").closest("[data-placeholder]")!;
  expect(health).toHaveAttribute("data-paper-only", "true");
  const player = screen.getByText("{player}").closest("[data-placeholder]")!;
  expect(player).toHaveAttribute("data-paper-only", "false");
});

it("reports the kind of an image value as the contract classifies it", () => {
  render(<ImagePicker value="head:Notch" onChange={vi.fn()} />);
  expect(screen.getByText(/player head/i)).toBeInTheDocument();
});

it("warns only on an unclassifiable image", () => {
  const { rerender } = render(<ImagePicker value="DIAMOND_SWORD" onChange={vi.fn()} />);
  expect(screen.queryByRole("alert")).toBeNull();
  rerender(<ImagePicker value="not a real thing" onChange={vi.fn()} />);
  expect(screen.getByRole("alert")).toBeInTheDocument();
});
```

The `paperOnly` marking matters: off Paper those six fall back to fixed values like `health` 20.0
rather than failing, so a user gets a plausible wrong number with no warning unless the UI says so.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/pickers.spec.tsx`
Expected: FAIL — `PlaceholderPicker` renders its own table; `ImagePicker` does not exist.

- [ ] **Step 3: Implement**

`PlaceholderPicker` maps over `BUILTIN_PLACEHOLDERS`, rendering `token`, `description` and a
`data-paper-only` attribute. Delete the local `PLACEHOLDERS` array and its `PlaceholderItem` type.
Keep a section for PlaceholderAPI `%…%` explaining that anything not built in must use that syntax.

`ImagePicker` shows the current value, its classified kind from `classifyImage`, and a grouped
chooser for the seven source kinds. Show `role="alert"` only when the kind is `unknown`.

- [ ] **Step 4: Use `ImagePicker`** for the button image field in `PropertiesPanel`.

- [ ] **Step 5: Run and commit**

```bash
npm test
git add src/components src/panels/PropertiesPanel.tsx src/tests/pickers.spec.tsx
git commit -m "feat(ui): drive the placeholder and image pickers from the contract"
```

---

# Phase 7 — Addons and cross-form validation

### Task 9: Open-target picker

**Files:**
- Create: `src/components/OpenTargetPicker.tsx`
- Modify: `src/actions/editors/LinesEditor.tsx`
- Test: `src/tests/open-target-picker.spec.tsx`

**Interfaces:**
- Consumes: `ADDONS`, `ADDON_FORM_IDS`, `findAddonForFormId` from `src/plugin/addons.ts`;
  `project.forms`.
- Produces: `<OpenTargetPicker value={string} onChange={(next: string) => void} />`.

- [ ] **Step 1: Write the failing test**

```tsx
it("offers this project's forms first, then addon targets grouped by addon", () => {
  useDesignerStore.getState().addForm("shop");
  render(<OpenTargetPicker value="" onChange={vi.fn()} />);
  expect(screen.getByRole("group", { name: /this project/i })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "shop" })).toBeInTheDocument();
  expect(screen.getByRole("group", { name: /bedwars/i })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "bw_arena_main" })).toBeInTheDocument();
});

it("names the addon a chosen target needs", () => {
  render(<OpenTargetPicker value="pd_duel" onChange={vi.fn()} />);
  expect(screen.getByText(/PhoenixDuels Addon/)).toBeInTheDocument();
});

it("accepts a free-text id that matches nothing", () => {
  const onChange = vi.fn();
  render(<OpenTargetPicker value="" onChange={onChange} />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "my_own_menu" } });
  expect(onChange).toHaveBeenCalledWith("my_own_menu");
});
```

Free text must stay possible — a user may be targeting a form they have not created yet, and a
picker that refuses unknown ids would block legitimate work.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/open-target-picker.spec.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** a combobox with an editable text input plus grouped suggestions: this
project's form ids first, then one group per addon from `ADDONS`. When the current value resolves
via `findAddonForFormId`, show which addon supplies it and its `minPluginVersion`.

- [ ] **Step 4: Use it** in `LinesEditor` when the action id is `open`.

- [ ] **Step 5: Run and commit**

```bash
npm test
git add src/components/OpenTargetPicker.tsx src/actions/editors src/tests/open-target-picker.spec.tsx
git commit -m "feat(ui): pick open targets from project forms and addon catalogues"
```

---

### Task 10: Cross-form validation

**Files:**
- Create: `src/core/validateProject.ts`
- Modify: `src/panels/ValidationPanel.tsx`
- Test: `src/tests/validate-project.spec.ts`

**Interfaces:**
- Consumes: `findAddonForFormId`, `ADDON_FORM_IDS`, `parseActionBlock`, `LIMITS`.
- Produces: `validateProject(project: Project): ProjectIssue[]` where
  `interface ProjectIssue { level: "error" | "warning"; formId?: string; message: string }`.

- [ ] **Step 1: Write the failing test**

```ts
it("reports an open target that is neither a project form nor an addon id", () => {
  const p = createEmptyProject();
  setOnClick(p.forms[0], 'open {\n  - "ghost_menu"\n}');
  const issues = validateProject(p);
  expect(issues.some((i) => i.message.includes("ghost_menu"))).toBe(true);
});

it("accepts an addon target and names the addon", () => {
  const p = createEmptyProject();
  setOnClick(p.forms[0], 'open {\n  - "bw_arena_main"\n}');
  const issues = validateProject(p);
  const note = issues.find((i) => i.message.includes("bw_arena_main"));
  expect(note?.level).toBe("warning");
  expect(note?.message).toContain("Bedwars");
});

it("reports duplicate file names across forms", () => {
  const p = createEmptyProject();
  const dup = createForm("shop");
  dup.fileName = "main_menu.yml";
  p.forms.push(dup);
  expect(validateProject(p).some((i) => i.message.includes("main_menu.yml"))).toBe(true);
});

it("reports a form no other form can reach", () => {
  const p = createEmptyProject();
  p.forms.push(createForm("orphan"));
  const issues = validateProject(p);
  expect(issues.some((i) => i.formId === "orphan" && i.level === "warning")).toBe(true);
});
```

An unknown `open` target is an ERROR (the plugin will fail at runtime); an addon target is a
WARNING naming the addon required (it works, but only with that addon installed); an unreachable
form is a WARNING (it may be opened by command).

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/validate-project.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/core/validateProject.ts`**

```ts
import { Project, FormDoc } from "./project";
import { findAddonForFormId, parseActionBlock, ParsedAction } from "../plugin";
import { ActionInstance } from "./types";

export interface ProjectIssue {
  level: "error" | "warning";
  formId?: string;
  message: string;
}

function openTargets(actions: ActionInstance[] | undefined, out: string[]) {
  for (const a of actions ?? []) {
    const parsed = parseActionBlock(a.raw ?? String(a.params ?? ""));
    collect(parsed, out);
  }
}

function collect(parsed: ParsedAction, out: string[]) {
  if (parsed.kind === "lines" && parsed.id === "open") out.push(...parsed.lines);
  if (parsed.kind === "conditional") {
    parsed.whenTrue.forEach((p) => collect(p, out));
    parsed.whenFalse.forEach((p) => collect(p, out));
  }
}

function formTargets(form: FormDoc): string[] {
  const out: string[] = [];
  const b = form.bedrock as any;
  openTargets(b.globalActions, out);
  for (const btn of b.buttons ?? []) openTargets(btn.onClick, out);
  for (const comp of b.components ?? []) openTargets(comp.action, out);
  return out;
}

export function validateProject(project: Project): ProjectIssue[] {
  const issues: ProjectIssue[] = [];
  const ids = new Set(project.forms.map((f) => f.id));

  const seenFiles = new Map<string, string>();
  for (const form of project.forms) {
    const prior = seenFiles.get(form.fileName);
    if (prior) {
      issues.push({
        level: "error",
        formId: form.id,
        message: `Forms '${prior}' and '${form.id}' both write to ${form.fileName}.`
      });
    }
    seenFiles.set(form.fileName, form.id);
  }

  const reached = new Set<string>();
  for (const form of project.forms) {
    for (const target of formTargets(form)) {
      if (ids.has(target)) {
        reached.add(target);
        continue;
      }
      const addon = findAddonForFormId(target);
      if (addon) {
        issues.push({
          level: "warning",
          formId: form.id,
          message: `'${target}' is provided by the ${addon.name} — it only works where that addon is installed.`
        });
        continue;
      }
      issues.push({
        level: "error",
        formId: form.id,
        message: `open target '${target}' is not a form in this project and not a known addon id.`
      });
    }
  }

  for (const form of project.forms) {
    const hasCommand = Boolean((form.bedrock as any).command);
    if (!hasCommand && !reached.has(form.id) && project.forms.length > 1) {
      issues.push({
        level: "warning",
        formId: form.id,
        message: `Nothing opens '${form.id}' and it registers no command — players may not be able to reach it.`
      });
    }
  }

  return issues;
}
```

An unknown target is an ERROR because the plugin fails at runtime; an addon target is a WARNING
naming the addon because it works wherever that addon is installed; an unreachable form is a
WARNING because `/bedrockgui open` can still reach it.

- [ ] **Step 4: Surface it** in `ValidationPanel` as a "Project" section above the per-form issues,
so a user sees cross-form problems without switching forms.

- [ ] **Step 5: Run and commit**

```bash
npm test
git add src/core/validateProject.ts src/panels/ValidationPanel.tsx src/tests/validate-project.spec.ts
git commit -m "feat(validation): report cross-form and addon issues"
```

---

# Phase 8 — Preview fidelity

### Task 11: Hex and MiniMessage in the text renderer

**Files:**
- Modify: `src/core/minecraftText.ts`
- Test: `src/tests/minecraftText.spec.ts`

**Interfaces:**
- Produces: `parseMinecraftText` handling `&#RRGGBB` hex and the MiniMessage tags the plugin
  accepts, in addition to the existing legacy `&`/`§` codes.

The plugin accepts legacy codes, hex `&#RRGGBB` and MiniMessage. The preview currently renders only
legacy codes, so a form using hex shows raw markup where the player would see colour.

- [ ] **Step 1: Write the failing test**

```ts
it("renders a hex colour", () => {
  const segs = parseMinecraftText("&#FF8800warm");
  expect(segs).toEqual([{ text: "warm", style: { color: "#FF8800" } }]);
});

it("renders MiniMessage colour and decoration tags", () => {
  expect(parseMinecraftText("<red>stop</red>")[0]).toEqual({ text: "stop", style: { color: "#FF5555" } });
  expect(parseMinecraftText("<bold>b</bold>")[0].style.bold).toBe(true);
});

it("renders a MiniMessage hex tag", () => {
  expect(parseMinecraftText("<#00FF00>go")[0].style.color).toBe("#00FF00");
});

it("still renders legacy codes and resets", () => {
  const segs = parseMinecraftText("§aok§rplain");
  expect(segs[0].style.color).toBe("#55FF55");
  expect(segs[1].style.color).toBeUndefined();
});

it("leaves an unknown tag as literal text", () => {
  expect(parseMinecraftText("<notatag>x")[0].text).toBe("<notatag>x");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/minecraftText.spec.ts`
Expected: FAIL — hex and tags render as literal text.

- [ ] **Step 3: Implement**

Extend the tokeniser in `src/core/minecraftText.ts`. Reuse the existing `LEGACY_COLORS` table for
the sixteen named MiniMessage colours so the two syntaxes cannot drift apart:

```ts
const MINI_COLORS: Record<string, string> = {
  black: LEGACY_COLORS["0"], dark_blue: LEGACY_COLORS["1"], dark_green: LEGACY_COLORS["2"],
  dark_aqua: LEGACY_COLORS["3"], dark_red: LEGACY_COLORS["4"], dark_purple: LEGACY_COLORS["5"],
  gold: LEGACY_COLORS["6"], gray: LEGACY_COLORS["7"], dark_gray: LEGACY_COLORS["8"],
  blue: LEGACY_COLORS["9"], green: LEGACY_COLORS.a, aqua: LEGACY_COLORS.b,
  red: LEGACY_COLORS.c, light_purple: LEGACY_COLORS.d, yellow: LEGACY_COLORS.e,
  white: LEGACY_COLORS.f
};

const MINI_DECORATIONS: Record<string, keyof MinecraftTextStyle> = {
  bold: "bold", italic: "italic", underlined: "underline", strikethrough: "strikethrough"
};

const HEX_AMP = /^&#([0-9a-fA-F]{6})/;
const MINI_TAG = /^<\/?([a-z_]+|#[0-9a-fA-F]{6})>/;
```

Walk the string one token at a time. On `&#RRGGBB` set `style.color` and advance 8. On a
`<…>` match, resolve it against `MINI_COLORS`, a `#RRGGBB` literal, or `MINI_DECORATIONS`; a
closing tag clears what its opener set. Keep the existing `&`/`§` handling untouched.

An unrecognised tag must fall through as literal text rather than being swallowed — a user who
mistypes `<bild>` needs to see it, not lose it silently.

- [ ] **Step 4: Run and commit**

```bash
npm test
git add src/core/minecraftText.ts src/tests/minecraftText.spec.ts
git commit -m "feat(preview): render hex and MiniMessage colours"
```

---

### Task 12: Image resolution in the preview

**Files:**
- Modify: `src/canvas/previews/BedrockPreview.tsx`
- Create: `src/core/resolveImage.ts`
- Test: `src/tests/resolve-image.spec.ts`

**Interfaces:**
- Consumes: `classifyImage` from `src/plugin/images.ts`, `project.assets`.
- Produces: `resolveImageForPreview(value: string, assets: AssetsConfig): { src?: string; label: string }`.

- [ ] **Step 1: Write the failing test**

```ts
const OFF: AssetsConfig = { enabled: false, port: 0, host: "" };

it("resolves a URL to itself", () => {
  expect(resolveImageForPreview("https://e.com/a.png", OFF).src).toBe("https://e.com/a.png");
});

it("resolves a player head through mc-heads", () => {
  expect(resolveImageForPreview("head:Notch", OFF).src).toContain("mc-heads.net");
});

it("resolves a local asset against the configured host when the server is on", () => {
  const on = { enabled: true, port: 8123, host: "mc.example.com" };
  expect(resolveImageForPreview("logo.png", on).src).toBe("http://mc.example.com:8123/logo.png");
});

it("explains why a local asset cannot render when the server is off", () => {
  const r = resolveImageForPreview("logo.png", OFF);
  expect(r.src).toBeUndefined();
  expect(r.label).toContain("asset server");
});

it("renders nothing for a no-icon material", () => {
  expect(resolveImageForPreview("BARRIER", OFF).src).toBeUndefined();
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/tests/resolve-image.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/core/resolveImage.ts`**

```ts
import { classifyImage } from "../plugin";
import { AssetsConfig } from "./project";

export function resolveImageForPreview(
  value: string,
  assets: AssetsConfig
): { src?: string; label: string } {
  const { kind, detail } = classifyImage(value);
  switch (kind) {
    case "url":
      return { src: value, label: value };
    case "head":
      return { src: `https://mc-heads.net/head/${value.slice(5)}/64`, label: `Head of ${value.slice(5)}` };
    case "implicitHead":
      return { src: `https://mc-heads.net/head/${value}/64`, label: `Head of ${value}` };
    case "assetFile":
      if (assets.enabled && assets.host.trim()) {
        return { src: `http://${assets.host}:${assets.port}/${value}`, label: value };
      }
      return { label: `${value} — enable the asset server and set a host to preview this` };
    case "none":
      return { label: `${value} draws no icon` };
    case "potion":
      return { label: `Potion texture: ${detail ?? value}` };
    case "texturePath":
      return { label: `Resource pack path: ${value}` };
    case "material":
      return { label: `Material: ${value}` };
    default:
      return { label: `Unrecognised image source: ${value}` };
  }
}
```

`material`, `potion` and `texturePath` return no `src` on purpose — the designer ships no Bedrock
texture atlas, and inventing one is out of scope. The label is what the preview shows instead.

- [ ] **Step 4: Use it** in `BedrockPreview` for button icons, showing the label as a tooltip when
there is no src.

- [ ] **Step 5: Run and commit**

```bash
npm test
git add src/core/resolveImage.ts src/canvas/previews/BedrockPreview.tsx src/tests/resolve-image.spec.ts
git commit -m "feat(preview): resolve button images the way the plugin does"
```

---

# Phase 9 — Hardening

### Task 13: Wire the last contract modules and remove the leftovers

**Files:**
- Modify: `src/parse/form.ts`, `src/serialize/form.ts`
- Delete: `src/data/icons.ts`, `src/panels/DocumentationPanel.tsx` if still unimported
- Test: existing suites

**Interfaces:**
- Consumes: `FORM_KEYS`, `BUTTON_KEYS`, `COMPONENT_KEYS`, `CONDITION_KEYS` from `src/plugin/keys.ts`.

`keys.ts` has no production importer: `parse/form.ts` and `serialize/form.ts` hardcode the
snake_case strings. That is exactly the drift this rewrite exists to prevent — the key names live
in two places and only one of them is the declared contract.

- [ ] **Step 1: Replace the hardcoded key strings** in both files with the constants. The golden
tests are the check: they must stay green throughout, because the emitted YAML must not change by
one byte.

- [ ] **Step 2: Prove it with a mutation.** Change `FORM_KEYS.commandIntercept` to
`"command-intercept"`, run the golden suite, and confirm it FAILS. Revert and confirm it passes.
Report the failure message. If the golden tests do NOT fail, the constants are not actually being
used and the task is not done.

- [ ] **Step 3: Sweep for orphans.** `grep` for importers of `src/data/icons.ts` and
`src/panels/DocumentationPanel.tsx`; delete whichever has none. Do not delete
`src/panels/StyleGuidePanel.tsx` without checking — it may be intentionally dev-only.

- [ ] **Step 4: Run and commit**

```bash
npm test && npm run build
git add -A
git commit -m "refactor: read YAML key names from the contract"
```

---

### Task 14: End-to-end coverage of the multi-form flow

**Files:**
- Create: `e2e/multi-form.spec.ts`
- Test: `npx playwright test --project=chromium`

The unit suite cannot see the seam between the switcher, the store and the exporter. Playwright
chromium is already installed.

- [ ] **Step 1: Write the spec**

```ts
test("create, switch, link and export a two-form project", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1400 });
  await page.goto("http://localhost:5173/");
  await page.getByRole("button", { name: "Add form" }).click();
  await expect(page.getByRole("button", { name: /form_1|new_form/ })).toBeVisible();
  await page.getByRole("button", { name: "main_menu" }).click();
  await expect(page.getByRole("button", { name: "main_menu" })).toHaveAttribute("aria-current", "true");
});

test("deleting a form can be undone", async ({ page }) => {
  await page.goto("http://localhost:5173/");
  await page.getByRole("button", { name: "Add form" }).click();
  const before = await page.getByRole("button", { name: /^form_/ }).count();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /^Delete / }).first().click();
  await page.keyboard.press("Control+z");
  await expect(page.getByRole("button", { name: /^form_/ })).toHaveCount(before);
});
```

Adjust the selectors to whatever Task 2 actually rendered — write the spec against the real DOM,
not against this sketch.

- [ ] **Step 2: Run it**

Run: `npx playwright test e2e/multi-form.spec.ts --project=chromium`
Expected: PASS. Run it three times to confirm it is not flaky before committing; the existing
`e2e/dnd-reorder.spec.ts` needed a bounded retry loop for exactly that reason.

- [ ] **Step 3: Commit**

```bash
git add e2e/multi-form.spec.ts
git commit -m "test(e2e): cover the multi-form flow"
```

---

### Task 15: Documentation

**Files:**
- Modify: `CLAUDE.md`, `README.md`
- Create: `docs/superpowers/specs/2026-09-02-designer-ui-handoff.md`

- [ ] **Step 1: Update `CLAUDE.md`** for what now exists: the form switcher and project settings,
project-level undo alongside per-form history, ZIP import and export, editors driven by
`grammar.ts`, pickers driven by the contract, and cross-form validation. Remove the "multi-form UI
is a later plan" note and the statement that only `setBedrock` records history — both become false
in this plan. Verify every claim against the code before writing it; the foundation branch shipped
four false statements in this file and they were caught only at final review.

- [ ] **Step 2: Update `README.md`** with the multi-form workflow: import a ZIP or a `config.yml`,
edit across forms, export a ZIP that drops into `plugins/BedrockGUI/`.

- [ ] **Step 3: Write the handoff** recording what remains, in the same shape as the foundation's
handoff: anything deferred, any verification debt, and any behaviour change a user would notice.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md docs/superpowers/specs
git commit -m "docs: describe the multi-form designer"
```

---

## What this plan does not cover

- **A Bedrock texture atlas.** `material`, `potion` and `texturePath` images show a label rather
  than artwork. Shipping thousands of texture files to render an icon is a separate decision.
- **`messages.yml`.** Out of scope per the spec.
- **Java menus.** Permanently out of scope; `javaRaw` is preserved and never interpreted.
