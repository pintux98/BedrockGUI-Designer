# BedrockGUI Designer — v2.0.11 Parity Rewrite

Date: 2026-09-01
Status: approved
Target plugin: BedrockGUI **2.0.11**

## Context

The designer was authored against an earlier BedrockGUI. The plugin has since moved to a
`config.yml` registry plus one file per form, deleted the `url` action, added an asset
server, and shipped four addons. The designer still exports a shape the plugin no longer
reads in full, and emits three keys the plugin never reads at all.

Every one of those defects has the same cause: knowledge of the plugin is spread across
`src/core/yaml.ts`, `src/actions/registry.ts`, `src/core/schemas.ts`,
`src/panels/ValidationPanel.tsx` and `src/panels/PropertiesPanel.tsx`. Each drifted on its
own. The rewrite's central move is to make that knowledge one versioned, data-only module
that everything else derives from.

## Goals

1. Exported YAML is accepted by BedrockGUI 2.0.11 without hand-editing.
2. The designer holds a **project** (many forms + assets + config settings), not one form.
3. Plugin knowledge lives in exactly one place, versioned against the plugin release.
4. The four addons are first-class: their form IDs are offered and validated.
5. Dependencies modernised in one pass.

## Non-goals

- **Java menus are out of scope.** The plugin's `java:` section will not be authored,
  previewed, or generated. Imported files that carry a `java:` block preserve it verbatim
  on round-trip but expose no editor. This is a standing product decision, not a phase
  deferral.
- No server connection, no live push to a running plugin, no account system.
- No authoring of `messages.yml`.

## Ground truth — BedrockGUI 2.0.11

Verified against local plugin source at `C:\Users\pintu\Desktop\Server\BedrockGUI`
(`projectVersion=2.0.11`) and the published docs at
<https://pintux.gitbook.io/pintux-support>.

### Config layout

```
plugins/BedrockGUI/
  config.yml          config-version: 1, assets{enabled,port,host}, forms:<id>:file:
  messages.yml        out of scope
  forms/<name>.yml    a bare bedrock: root (and optionally java:)
  assets/             local image files served over HTTP when assets.enabled
```

`config.yml` registers forms **by id**, and the id — not the filename — is what `open`
targets and what `/bedrockgui open` takes.

### Form-level keys (under `bedrock:`)

Read by `FormMenuUtil.loadFormMenu`:

| Key | Notes |
|---|---|
| `type` | `SIMPLE` \| `MODAL` \| `CUSTOM`, defaults to `SIMPLE` |
| `title` | defaults to `"Unknown"` |
| `content` | string **or list of strings** (joined with a newline) |
| `description` | fallback, used only when `content` is absent |
| `permission` | |
| `command` | auto-registers, guarded by `bedrockgui.form.<form id>` |
| `command_intercept` | hijacks an existing command for Bedrock players only |
| `buttons` | keyed map, `SIMPLE`/`MODAL` only |
| `components` | keyed map, `CUSTOM` only |
| `global_actions` | list of action blocks |

### Button keys

`text`, `image`, `onClick` (list or single block), `show_condition`, `alternative_text`,
`alternative_image`, `alternative_onClick`, `conditions` (keyed map of
`{condition, property, value}` where property is `text` \| `image` \| `onClick`).

### Component keys (CUSTOM)

| Type | Keys | Submitted value |
|---|---|---|
| `input` | `text`, `placeholder`, `default` | typed text |
| `slider` | `text`, `min`, `max`, `step`, `default` — all integers | number |
| `dropdown` | `text`, `options` (list), `default` (index) | selected option text |
| `toggle` | `text`, `default` (bool) | boolean |

Each component may carry `action`, read as **either** a list **or** a single block scalar.
Inside a component's own `action`, its value is `$1`. Inside `global_actions`, every value
is available as `$<component_key>`.

### Actions — 14, and only 14

Registered in `FormMenuUtil.registerDefaultActionHandlers`:

| Action | Availability |
|---|---|
| `command`, `open`, `message`, `delay` | always |
| `server`, `broadcast`, `inventory` | only when a command executor exists |
| `sound` | only when a sound manager exists |
| `economy` | only when an economy manager exists |
| `title`, `actionbar` | only when a title manager exists **and** `isSupported()` |
| `conditional`, `random`, `bungee` | always |

`url` **does not exist**. `OpenUrlActionHandler` was deleted on 2026-08-15 and was never
registered before that; `url { }` fails with `Invalid action type 'url' - not registered`.
Bedrock clients cannot open a web address from a form and cannot click chat links at all.
The only URL that works is an `image:` pointing at `http(s)://`, which the client fetches
to draw an icon and nothing more.

Grammar:

```yaml
onClick:
  - |
    message {
      - "First line"
      - "Second line"
    }
```

Compact `type:value` form is legal inside `random` and as a `delay` chain action.
Notable parameter shapes: `title` is `title:subtitle:fadeIn:stay:fadeOut` in ticks;
`sound` is `name[:volume[:pitch]]`; `economy` takes `add|remove|set|check|pay`;
`inventory` takes `give|remove|check|clear`; `random` entries accept `@<weight>`;
`delay` is capped at 30000 ms; `conditional` takes `check:` plus `true:`/`false:` branches
and nests.

### Conditions

Atoms: `permission:<node>`, `placeholder:<value>:<op>:<expected>`, `plugin:<name>`,
`not:<atom>`. Combined with `&&` and `||` and parentheses; `&&` binds tighter.

Two syntaxes, by context:

- `show_condition` and `conditions[].condition` use **colon** form:
  `placeholder:%x%:greater_than:5`
- `conditional` action `check:` uses **space + symbol** form:
  `placeholder:%x% >= 5`

Operators (from `ConditionEvaluator`): `equals`/`==`, `not_equals`/`!=`, `contains`,
`starts_with`, `ends_with`, `greater_than`/`>`, `greater_equal`/`>=`, `less_than`/`<`,
`less_equal`/`<=`, `regex`, `empty`, `not_empty`. The word forms are colon-syntax only.

### Placeholders

Built-ins, brace syntax: `{player}`, `{uuid}`, `{time}`, `{hour}`, `{minute}`,
`{timestamp}`. Everything else must use PlaceholderAPI `%…%` syntax — braces around an
unknown name render literally and break comparisons. Addons register their own identifiers
through `PlaceholderRegistry` rather than a PAPI expansion, because PAPI does not exist on
proxies.

### Images

Seven sources: Bukkit material name; `POTION:EFFECT` / `SPLASH_POTION:` / `TIPPED_ARROW:`
(with `LONG_`/`STRONG_` prefixes ignored); a raw `textures/…` resource-pack path;
`head:<name|uuid|hash>` (renders blank for Floodgate players); an `http(s)://` URL; a local
file in `assets/` (png, jpg, jpeg, gif, webp) served when `assets.enabled`; and materials
that intentionally have no icon — `AIR`, `CAVE_AIR`, `VOID_AIR`, `STRUCTURE_VOID`,
`BARRIER`, `LIGHT`.

### Text formatting

Legacy `&`/`§` codes, hex `&#RRGGBB`, and MiniMessage tags are all accepted. A message
block is capped at 2048 characters.

### Addons

Each requires BedrockGUI 2.0.8+ and Floodgate, and registers form ids usable as `open`
targets.

| Addon | Form ids |
|---|---|
| Essentials | `essentials_hub`, `essentials_warp_main`, `essentials_kit_main`, `home_main`, `public_home_main`, `tpa_main`, `essentials_pet_main` |
| Bedwars | `bw_shop_main`, `bw_shop_cat`, `bw_shop_buy`, `bw_upgrade_main`, `bw_upgrade_buy`, `bw_arena_main`, `bw_arena_join`, `bw_stats`, `bw_spec_main`, `bw_spec_tp`, `bw_party_main`, `bw_party_add`, `bw_party_kick`, `bw_party_leave`, `bw_party_disband` |
| Homestead | `hs_regions`, `hs_region_menu:<id>`, `hs_players:<id>`, `hs_flags:<id>`, and further `hs_*` ids |
| PhoenixDuels | `queue`, `party`, `duel_player`, `stats`, `leaderboard`, `settings`, `ongoing_matches`, `kit_preview` |

## Defects being fixed

| Current designer behaviour | Correct behaviour |
|---|---|
| `url` offered in the action registry | removed; 14 actions only |
| exports `configVersion: "1.0.0"` into the form file | `config-version: 1` belongs in `config.yml`, never in a form file |
| writes `content` out as `description:` | write `content:`; treat `description:` as an import-only fallback |
| `content` is a plain string | accept and preserve a list |
| emits `translations:` | removed — the plugin never reads it |
| emits `priority` / `priority_condition` | removed — the field exists on `ConditionalButton` but is not parsed from YAML |
| one form per document | project of many forms |
| no assets concept | `assets.enabled/port/host` plus a local asset list |
| every action always offered | actions filtered by platform target |
| `open` target is free text | picker over project forms + addon ids, validated |
| component `action` written as a list only | accept both shapes on import, emit the canonical one |

## Architecture

### `src/plugin/` — the contract

Data only. No React, no store imports. One module per concern, all re-exported through
`src/plugin/index.ts` behind a `PLUGIN_TARGET` version constant.

| File | Contents |
|---|---|
| `actions.ts` | the 14 action definitions: id, label, availability tag, parameter schema, block grammar, canonical serializer, parser |
| `keys.ts` | camelCase to snake_case map, and the set of keys the plugin actually parses |
| `conditions.ts` | atoms, the operator table split by syntax context, boolean grammar and precedence |
| `placeholders.ts` | the six built-ins, PAPI rules, `$1` and `$<key>` component references |
| `images.ts` | the seven image source kinds, their patterns, and the no-icon material list |
| `addons.ts` | the four addons, their form ids, required plugin and minimum version |
| `limits.ts` | 2048-character message cap, 30000 ms delay cap, MODAL exactly two buttons, integer slider fields |
| `platforms.ts` | Paper / Velocity / Bungee, and which action availability tags each satisfies |

Adding support for a future plugin release is then an edit to data, not a hunt through the
UI layer.

### Domain model

```ts
type Project = {
  pluginTarget: "2.0.11";
  configVersion: 1;
  assets: { enabled: boolean; port: number; host: string };
  forms: FormDoc[];
  activeFormId: string;
  platformTarget: "paper" | "velocity" | "bungee";
};

type FormDoc = {
  id: string;          // the config.yml registry key; what `open` targets
  fileName: string;    // forms/<fileName>
  bedrock: BedrockForm;
  javaRaw?: unknown;   // preserved verbatim, never edited
};
```

`BedrockForm` stays a discriminated union on `type`, with `SIMPLE`/`MODAL` carrying
`buttons` and `CUSTOM` carrying `components`, as today. `content` becomes
`string | string[]`. `translations`, `priority` and `priorityCondition` are deleted from
the model.

`ActionInstance` becomes a discriminated union over the 14 action ids, each with typed
params, plus a `{ kind: "raw", text }` member that carries anything the parser cannot
understand. Raw actions survive round-trip untouched and are surfaced in validation as
"not understood — will be exported as written".

### Store

The single Zustand store splits into slices — `projectSlice`, `selectionSlice`,
`historySlice`, `uiSlice` — composed into one store so existing call sites keep working.
The invariant stands: every model mutation goes through a store action, and each action
records history. History moves from whole-state snapshots to per-form entries, so undo in
one form does not disturb another.

### Serialization

`src/core/yaml.ts` is replaced by `src/serialize/` and `src/parse/`, both driven by the
contract rather than by inline literals.

- `serialize/form.ts` — one `FormDoc` to a `forms/<name>.yml` document
- `serialize/config.ts` — the project to `config.yml`
- `serialize/project.ts` — the whole project to a ZIP mirroring `plugins/BedrockGUI/`
- `parse/form.ts`, `parse/config.ts`, `parse/legacy.ts` — the inverse, plus the old inline
  `forms:` shape, mirroring what `/bedrockgui convert` does server-side

Block-scalar post-processing survives, because the action grammar depends on `- |` output.
It moves behind a tested helper rather than a regex pass over rendered YAML.

Export modes: full project ZIP; a single `forms/<name>.yml`; and a clipboard snippet.

### Validation

Rules read the contract. Per form: MODAL must have exactly two buttons; `CUSTOM` must have
at least one component and no buttons; unknown material or malformed image reference;
condition uses the wrong syntax for its context; unknown operator; message over 2048
characters; delay over 30000 ms; slider bounds and non-integer fields; brace placeholder
that is not one of the six built-ins; an action unavailable on the selected platform
target. Across the project: duplicate form ids, duplicate file names, an `open` target that
matches neither a project form nor a known addon id, and forms no other form reaches.

### UI

The three-pane shell, drag and drop, the Minecraft text renderer, and the imperative toast
and confirm singletons are kept. Added: a form switcher listing the project's forms with
add / duplicate / rename / delete; a project settings panel for `assets` and the platform
target; an `open`-target picker grouped by project forms and by addon; an image picker
organised by the seven source kinds; a condition builder that offers only the operators
legal in the current context; and a placeholder picker split into built-ins and PAPI.

Tailwind moves to 4's CSS-first configuration; the `brand-*` tokens are redefined under
`@theme` and their names are kept.

## Migration

A saved design from the current app loads as a project containing one form, with the form
id taken from `menuName`. `url` actions convert to a raw action carrying their former text
and are flagged. `translations`, `priority` and `priority_condition` are dropped. The user
is shown a one-time report of exactly what changed rather than a silent rewrite.

## Dependencies

Verified latest as of 2026-09-01.

| Package | From | To |
|---|---|---|
| react, react-dom | 18.3.1 | 19.2.8 |
| @types/react | 18.2 | 19.2 |
| vite | 6.4.2 | 8.2.2 |
| @vitejs/plugin-react | 4.3.4 | 6.1.1 |
| vitest | 3.0 | 4.1.11 |
| jsdom | 26 | 30.0.1 |
| @testing-library/react | 14.3.1 | 16.3.3 |
| tailwindcss | 3.4.10 | 4.3.3 |
| zod | 3.23.8 | 4.5.4 |
| zustand | 4.5.2 | 5.0.15 |
| @dnd-kit/sortable | 7.0.0 | 10.0.0 |
| @dnd-kit/core | 6.1.0 | 6.3.1 |
| react-markdown | 9.0.1 | 10.1.0 |
| @hookform/resolvers | 3.10.0 | 5.9.1 |
| js-yaml | 4.1.0 | 5.4.1 |
| typescript | 5.6.3 | 7.0.2 |
| @playwright/test | 1.45 | 1.62.1 |
| wrangler | 4.84.1 | 4.127.1 |

New: a ZIP library for project export and import (JSZip or fflate; fflate preferred for
bundle size, decided in phase 5 against the bundle guard).

## Testing

- **Golden tests are the centrepiece.** The plugin ships seven real form files in
  `common/src/main/resources/forms/` — `main_menu`, `button_images`, `basic_actions`,
  `economy_shop`, `player_settings`, `confirm_reset`, `advanced_flow`. They are copied into
  `src/tests/fixtures/plugin-forms/` and each must parse, survive a round-trip byte-stable
  modulo key order, and produce zero validation errors. `economy_shop.yml` additionally
  proves a `java:` block is preserved untouched.
- Contract tests: every action serializes and reparses; every operator is reachable; the
  addon id list is non-empty per addon.
- Migration tests: a current-format design converts and reports correctly.
- Unit tests for conditions, placeholders, images, limits.
- E2E: create a project, add two forms, link them with `open`, export the ZIP, reimport it,
  confirm the project matches.
- `npm run check:bundle` stays a gate.

## Phases

1. **Toolchain.** All dependency bumps, Tailwind 4 migration, TS 7. Existing tests green
   before any feature work. Fall back to TypeScript 5.9 if the plugin ecosystem misbehaves.
2. **Contract.** Build `src/plugin/`, with fixtures copied in and contract tests written.
3. **Model and store.** Project model, store slices, migration path.
4. **Serialization.** `serialize/` and `parse/` on the contract; golden tests must pass here
   and stay passing.
5. **Multi-form UI.** Form switcher, project settings, ZIP import and export.
6. **Editors.** Typed action editors with a raw escape hatch, condition builder, placeholder
   picker, image picker.
7. **Addons.** Catalogue, `open` picker, cross-form and addon validation.
8. **Preview fidelity.** `&`/`§`/hex/MiniMessage rendering, image source resolution.
9. **Hardening.** E2E, bundle guard, README and in-app documentation panel.

## Risks

- **TypeScript 7** is the native port. Landed first, behind a documented fallback to 5.9.
- **js-yaml 5** is a major release and block-scalar output is load-bearing for the action
  grammar. Phase 4 pins behaviour with golden tests before the bump is trusted.
- **Tailwind 4** rewrites the configuration model. Token names are preserved so component
  markup does not churn.
- **Addon form ids** are read from documentation. They are data in one file, cheap to
  correct, and validation treats an unknown target as a warning rather than an error.
