# v2.0.11 Parity Rewrite — Handoff

Companion to `2026-09-01-designer-v2011-parity-design.md` (the spec) and
`../plans/2026-09-01-designer-foundation.md` (the plan). Written at the close of the
foundation branch so the open items outlive the scratch workspace they were recorded in.

## What shipped

Spec phases 1 to 4, as 22 planned tasks plus one out-of-plan bug fix and one fix wave from the
whole-branch review. Every task was implemented, reviewed against the plugin's own source, and
its findings either fixed or recorded below.

- **Toolchain** — React 19, Vite 8, Vitest 4, jsdom 30, Tailwind 4 (CSS-first), Zod 4,
  Zustand 5, dnd-kit current, TypeScript 7, js-yaml 5.
- **`src/plugin/`** — one versioned, data-only contract for BedrockGUI 2.0.11. Zero imports
  from the app.
- **Model** — a `Project` of many `FormDoc`s, Zod-validated, with the store split into slices
  and per-form history.
- **Serialization** — `src/parse/` and `src/serialize/`, pinned by 23 golden tests against the
  seven form files the plugin ships.

## Defects found in the plugin's own documentation

Each was verified in the plugin's Java source, not inferred. These are worth correcting in the
published GitBook independently of this repo.

| Area | What the docs say | What the code does |
|---|---|---|
| `url` action | documented and offered | deleted from the plugin; `url {}` fails at runtime |
| PhoenixDuels addon | 8 bare ids (`queue`, `duel_player`, …) | 22 ids, all `pd_`-prefixed; not one documented id is registered |
| Homestead addon | 4 ids | 25 ids |
| Bedwars addon | 15 ids | 16 — `bw_party_kickdo` is undocumented |
| Built-in placeholders | 6 | 12 — `{x} {y} {z} {world} {health} {food}` also substitute, Paper-only, silently falling back to fixed values elsewhere |
| Condition atoms | one set | two — a `conditional` check supports only `placeholder:` and `permission:`; `plugin:`, `bedrock_player:`, `java_player:` and `not:` always evaluate false there |
| `bedrock_player` | not documented | exists, and a bare `bedrock_player` silently fails — it needs `bedrock_player:true` |
| `bungee` action body | implied YAML | not YAML at all; a `subchannel:` line beside sequence items |
| Component `action` | implied same as `onClick` | `handleCustomAction` calls `parseAction` directly with no bracket unwrap, so a list silently never runs — and only ONE action per component can ever execute |
| Inline `config.yml` forms | implied `bedrock:` wrapper | flat: fields sit directly on `forms.<id>` |
| `url` action, second look | removed | `ConfigConverter` still lists `url` in its knownTypes, so the legacy converter rewrites it into modern block form; `FormMenuUtil` registers 14 handlers and none is url, so it fails later and less legibly |
| `open` with several values | implied a menu chain | first value is the menu and the rest are ARGUMENTS, unless every value is a valid, registered menu name |

## Open items

### Needs a decision before the multi-form UI ships

**Structural changes are not undoable.** Only `setBedrock` and `setGlobalActions` record
history. `addForm`, `duplicateForm`, `removeForm`, `setAssets` and `setPlatformTarget` do not,
so `removeForm` destroys a form irrecoverably. No UI reaches it today. Per-form history cannot
express this — a deleted form's history dies with it — so it needs a project-level history
design, and that decision belongs with the form-switcher UI that first exposes it. This is the
first thing the next plan's UI task must resolve.

### Deferred, with reasons

- **`serializeConfigDocument` is unreachable.** Config parsing is wired into import; there is no
  config export. Needs the multi-form UI, since exporting one `config.yml` only makes sense
  alongside exporting all its forms.
- **`setPlatformTarget` has no UI caller.** `ActionPicker` already filters by
  `project.platformTarget`, so a Velocity or Bungee user is offered `sound` and `economy`, which
  their proxy cannot run. Needs a platform selector in project settings.
- **Legacy multi-form import strands forms and drops `assets`.** Importing a legacy config with
  three inline forms puts all three in the store, but with no form switcher two are invisible;
  and `setAssets` is only called when the config has no inline forms.
- **`grammar.ts` ships tested but unwired.** Its fixture test — every action block in the seven
  shipped forms must parse — is real value now; the typed action editors that consume it are
  Phase 6.
- **Zod messages reach users verbatim.** `parseProject` problems are toasted as written, e.g.
  "forms.0.bedrock.components: Too small: expected array to have >=1 items". Fine for a
  developer, poor for a form author.
- **Pre-existing and untouched:** `index.html` references a `favicon.ico` the repo does not ship;
  18 form fields lack `id`/`name` attributes; `javaAssets/` holds an orphaned `_redirects`,
  `_headers` and roughly a thousand unused icon PNGs that nothing copies into `dist`.

### Verification debt

Drag-and-drop was fixed on this branch (`collisionDetection` was never set, so `over` was always
undefined and neither reordering nor palette drop-to-add worked — broken since the first
release). `e2e/dnd-reorder.spec.ts` covers it and was proven to fail without the fix. But the e2e
suite is not in the standard gate set and these four interactions have not been exercised by
hand:

1. reorder buttons by dragging the handle
2. reorder components on a CUSTOM form
3. drag **Button** from the palette onto the canvas
4. press **Tab** midway through a keyboard drag — dnd-kit 6.3.1 added Tab to the keys that end a
   drag, the one provable behaviour change in that upgrade

## Behaviour changes a user may notice

- A **MODAL with the wrong number of buttons is no longer silently padded to two.** The parser
  keeps what the file says and the validation panel reports it, so a real config error surfaces
  instead of being hidden.
- **Saving is now refused for a project the schema rejects**, rather than writing a file that
  could never be reopened.
- **Switching form type preserves** `command`, `command_intercept`, `permission` and
  `globalActions`, which an earlier revision dropped.
