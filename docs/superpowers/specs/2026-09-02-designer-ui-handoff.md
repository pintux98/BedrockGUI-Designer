# Multi-form Designer UI — Handoff

Companion to `2026-09-01-designer-v2011-parity-design.md` (the spec) and
`../plans/2026-09-02-designer-ui.md` (Plan B). Written at the close of the UI branch, in the same
shape as the foundation handoff, so the open items outlive the scratch workspace.

## What shipped

Spec phases 5 to 9, as 15 planned tasks, six out-of-plan fixes, and a five-part fix wave answering
the whole-branch review. **467 unit tests across 38 files, 13 chromium e2e tests**, `npm run verify`
green.

- **Multi-form workspace** — `FormSwitcher`, project-level undo alongside per-form history, ZIP
  import and export, a config-snippet modal in place of writing `config.yml`.
- **Typed action editors** — `VisualActionEditor` dispatches on `grammar.ts`'s parsed
  `ParsedAction.kind` to `LinesEditor` / `ConditionalEditor` / `RandomEditor` / `BungeeEditor` /
  `RawEditor`. `grammar.ts` is no longer unwired.
- **Pickers on the contract** — placeholders, images, conditions and open targets all read
  `src/plugin/` instead of keeping private tables.
- **Cross-form validation** — `validateProject` reports unreachable forms, unknown `open` targets,
  and addon action ids misused as `open` targets.
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

Four instances now, and it is worth treating as a standing check rather than a run of coincidences.

| What | How it was found |
|---|---|
| `grammar.ts` | foundation review — tested, no production importer. Fixed this branch. |
| `serializeConfigDocument` | foundation review — still unreachable, now permanently (see below). |
| Project-level undo | Task 14's e2e. Built in Task 1, covered by a store test, reachable from **nowhere** in the running app. |
| `resolveImageForPreview` | the pre-merge review. 12 green tests, and nothing rendered a preview with an image — stubbing the call left all 365 unit and 13 e2e tests passing. The unreachable thing was the coverage, not the code. |

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

## The whole-branch review, and what it changed

Four parallel read-only reviewers ran before merge: core logic, contract-vs-Java, UI/React/a11y,
and test integrity (~60 mutations). Every dimension found real defects. The fixes are commits
`8e7…`-onward on this branch; what follows is what is worth remembering rather than a changelog.

**Addon ids were modelled as menu names.** The contract called the field `formIds`. The data was
correct and the noun was wrong, and every consumer inherited it: the designer offered addon ids as
`open` targets, which fail at runtime even with the addon installed, and warned "unknown action
type" on the one spelling that works. Both directions wrong, from one word. Naming is contract.

**Three data-loss bugs in the history coalescing added mid-branch.** Refreshing a coalesced entry's
timestamp reordered it past interleaved structural changes, so a second Ctrl+Z re-applied the edit
the first reverted; a description is not an identity, so two "Add" clicks collapsed into one step;
and the window was a gap rather than a total. The mechanism existed to paper over one performance
annoyance — a combobox writing per keystroke — and manufactured three correctness bugs doing it.
Deleted, and the write buffered at its source instead. *The wrong layer turns one small problem
into several larger ones.*

**Green tests that could not fail.** The sharpest: stubbing out `BedrockPreview`'s call to
`resolveImageForPreview`, so every button icon degrades to a grey box, left all 365 unit tests and
all 13 e2e tests passing. The resolver's own 12 tests were green throughout, because nothing called
it. Also: `ConditionBuilder`'s tests re-ran the same validator the component filters its options
with; `VisualActionEditor` could `return null`; `project-zip`'s "byte-identical" test compared
`f(x)` to `f(x)`; several assertions used `getByText(...)` with `toBeDefined()`, which cannot fail.

Two rules came out of this and are worth keeping:

1. **A test that re-derives its expectation from the implementation's own source is not a test.**
   Assert against literals.
2. **Mutation-check anything load-bearing.** Every fix in this round shipped with a mutation table
   showing the test going red. That is the only evidence a test is real.

**Reviews are evidence, not verdicts.** One reviewer finding (the colon-form `open:` split) was
wrong in both halves, and two more were "untested, not broken" — caught because the implementers
checked the Java rather than complying. Same standard that caught the `$value` deletion earlier.

## Open items

### Dead by design, not pending

`serializeConfigDocument` in `src/serialize/config.ts` has no caller and is not meant to acquire
one — scope decision 1 above. `parse/config.ts` **is** live: users import an existing `config.yml`.
Left in place and documented in `CLAUDE.md`; delete it if the asymmetry bothers you, git has it.

### Genuinely open

- **A malformed tail line in a curly `open` block is reported by nobody.** `open { - "shop" -
  "diamond sword" }` is rejected wholesale by `isValidAction` before `execute`, but `menuTargets`
  deliberately ignores a non-resolving tail, so the designer says nothing. Only tail lines that fail
  `isValidMenuName` are affected — a `diamond_sword` payload is still a legitimate argument. The
  check needs to distinguish "not a valid menu *name*" from "a valid name that does not resolve".
- **`pushProjectHistory` snapshots `history` before clearing redo stacks**, so undoing a structural
  change can resurrect a redo entry that change should have invalidated. Latent: the matching
  project redo entry currently always sorts newer and restores the cleared history first.
- **Project history is expensive.** Each structural change `structuredClone`s the whole per-form
  history; measured at 8 ms per "Add form" click on a 40-button form with a full undo stack, and
  ~36 MB retained across the 20-entry project stack. Scales with forms × depth.
- **`minecraftText` eats plain text** (pre-existing, confirmed against `main`, widened here by the
  routing change): `"Ticket #123456 confirmed"` renders as `"Ticket  confirmed"`, and `"R&D budget"`
  loses the `&D`. Bare `#RRGGBB` and `&`+hex are treated as colours.
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
