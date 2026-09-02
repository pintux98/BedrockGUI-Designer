# Multi-form Designer UI — Handoff

Companion to `2026-09-01-designer-v2011-parity-design.md` (the spec) and
`../plans/2026-09-02-designer-ui.md` (Plan B). Written at the close of the UI branch, in the same
shape as the foundation handoff, so the open items outlive the scratch workspace.

## What shipped

Spec phases 5 to 9, as 15 planned tasks plus six out-of-plan fixes. 365 unit tests across 37
files, 13 chromium e2e tests, `npm run verify` green.

- **Multi-form workspace** — `FormSwitcher`, project-level undo alongside per-form history, ZIP
  import and export, a config-snippet modal in place of writing `config.yml`.
- **Typed action editors** — `VisualActionEditor` dispatches on `grammar.ts`'s parsed
  `ParsedAction.kind` to `LinesEditor` / `ConditionalEditor` / `RandomEditor` / `BungeeEditor` /
  `RawEditor`. `grammar.ts` is no longer unwired.
- **Pickers on the contract** — placeholders, images, conditions and open targets all read
  `src/plugin/` instead of keeping private tables.
- **Cross-form validation** — `validateProject` reports unreachable forms, unknown `open` targets
  and addon-supplied targets.
- **Preview fidelity** — hex and MiniMessage rendering; button images resolved the way the plugin
  resolves them.
- **`keys.ts` wired** — `parse/form.ts` and `serialize/form.ts` read every plugin key name from
  the contract, proven by mutation against the golden suite.

## Scope decisions taken during the branch

Both came from the user mid-flight and are settled, not open.

1. **The designer does not own `config.yml`.** It exports one file per form and then shows the
   registry lines to paste. This resolves the foundation handoff's "`serializeConfigDocument` is
   unreachable, needs the multi-form UI" as **won't-do** rather than pending — see below.
2. **One adaptive Export button**, not separate single-file and ZIP buttons.

## Further defects in the plugin's own documentation

Continuing the foundation handoff's table. Each verified in Java source, not inferred.

| Area | What the docs say | What the code does |
|---|---|---|
| `open` with several values | implied a menu chain | `shouldTreatValuesAsMenuChain` opens a chain only if EVERY value is a valid, registered menu name; otherwise value 1 is the menu and the rest are **arguments** |
| `url` action, second look | removed | `ConfigConverter` still lists `url` in `knownTypes`, so the legacy converter rewrites it into modern block form; `FormMenuUtil` registers 14 handlers and none is `url`, so it fails later and less legibly |
| `$value` | undocumented | real — `handleCustomAction` puts `value` and `1` in the placeholder map, so inside a component's action `$value` and `$1` both mean the submitted value |
| `$1` | "first command argument" | overloaded: the submitted value inside a component action, the first command argument at form level |
| Base64 skin images | undocumented | `mapImageSource` decodes a Minecraft-Heads.com base64 blob and renders the hash as a head |
| `textures.minecraft.net` URLs | undocumented | rewritten to a `mc-heads.net` head render, not served as the raw skin sheet |

The designer's own `open` example was wrong in the same way and is fixed: its second value held a
space, so it was never a valid menu name — the example demonstrated the argument case while
reading as a chain.

## The recurring failure: built, tested, unreachable

Three instances now, and it is worth treating as a standing check rather than three coincidences.

| What | How it was found |
|---|---|
| `grammar.ts` | foundation review — tested, no production importer. Fixed this branch. |
| `serializeConfigDocument` | foundation review — still unreachable, now permanently (see below). |
| Project-level undo | Task 14's e2e. Built in Task 1, covered by a store test, reachable from **nowhere** in the running app. |

The undo case is the sharpest. `src/tests/store.spec.ts` proved `undo()` restores a deleted form,
and it did. But no global keydown handler existed anywhere in `src/`, while `FormSwitcher` told
users "You can undo this with Ctrl+Z"; `TopBar` gated its Undo button on per-form history, so it
greyed out at exactly the moment after a delete; and `HistoryPanel` rendered only
`history[active.id]`, so structural entries never appeared. A green store test says nothing about
whether a user can reach the behaviour.

**The check to apply:** when a task adds a capability, grep for a caller before calling it done. A
test that constructs the unit itself is not evidence of reachability. The regression suite for the
undo fix includes a test that renders `DesignerShell` alone and fires the chord, precisely because
the first version of that suite called the hook directly and passed with the shell not mounting it.

## Open items

### Dead by design, not pending

`serializeConfigDocument` in `src/serialize/config.ts` has no caller and is not meant to acquire
one — scope decision 1 above. `parse/config.ts` **is** live: users import an existing `config.yml`.
Left in place and documented in `CLAUDE.md`; delete it if the asymmetry bothers you, git has it.

### Genuinely open

- **`keys.ts` does not cover the document envelope.** `bedrock` and `java`, the two top-level keys
  `parseFormDocument` reads and `serializeFormDocument` writes, are still hardcoded. The contract
  covers everything inside a form and nothing about the file wrapping it.
- **`StyleGuidePanel.tsx` has no production importer** — only `src/tests/ui.spec.tsx` renders it.
  Dev-only by intent or an orphan; needs a human call, so it was left alone.
- **Zod messages still reach users verbatim**, unchanged from the foundation handoff.
- **Form fields lacking accessible names.** The foundation handoff counted 18. One — the form
  title input — was labelled this branch because the e2e needed it. The rest stand.
- **Legacy multi-form import** now has a switcher to reach every imported form, so that half of
  the foundation's item is resolved; the `assets` drop on inline-form configs is not.
- **Pre-existing and untouched:** `index.html` references a `favicon.ico` the repo does not ship;
  `javaAssets/` holds an orphaned `_redirects`, `_headers` and roughly a thousand unused icon PNGs.

## Verification debt

Much lower than the foundation branch, but not zero.

- **e2e runs chromium only in `npm run verify`.** `npm run e2e` covers firefox and webkit and was
  not run for this branch. The multi-form spec uses a `download` event and `fflate` decoding, which
  are the likeliest cross-browser differences.
- **The four foundation drag-and-drop interactions still have no manual pass.** Unchanged.
- **`resolveImageForPreview` is not exercised against a live network.** Head URLs are asserted as
  strings; nobody has confirmed mc-heads serves them.
- **Nothing tests the ZIP export against the real plugin.** The e2e asserts entry names and
  contents; it has never been dropped into a server and loaded.

## Behaviour changes a user will notice

- **Ctrl+Z works, and now covers structural changes.** Deleting a form is undoable; so are add,
  rename, duplicate, and platform-target changes. Text fields keep their own undo — the handler
  deliberately skips inputs, textareas, selects and contenteditable.
- **Typing no longer floods the undo stack.** Consecutive edits sharing a description inside 700ms
  collapse into one step. Per-form undo is capped at 100 entries, project history at 20.
- **Export produces forms plus a snippet**, never a `config.yml` that would overwrite server
  settings.
- **The validation panel reports across forms** — unreachable forms, unknown `open` targets, and
  targets that need an addon installed.
- **Hex and MiniMessage render in the preview** instead of showing as raw markup.
- **Base64 skin blobs and Mojang texture URLs preview as heads** rather than being called
  unrecognised.
