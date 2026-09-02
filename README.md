# BedrockGUI Designer

A visual designer for **Minecraft Bedrock GUI forms**, targeting the
[BedrockGUI](https://github.com/pintux98/BedrockGUI) server plugin **2.0.11**.

Design your forms by dragging them together, preview them as a player sees them, and export the
YAML the plugin reads. The app is client-only — nothing leaves your browser.

## The workflow

1. **Start or import.** Open the designer to a new project, or import what you already have:
   a single form `.yml`, a whole `config.yml` (its inline forms are unpacked into the project), or
   a `.zip` of form files.
2. **Design across forms.** The left sidebar lists every form in the project. Add, rename,
   duplicate and delete them there, and switch between them without losing your place — undo
   (`Ctrl+Z`) covers both edits within a form and structural changes to the project.
3. **Wire them together.** A button's `open` action picks from your own forms first, then from the
   form ids the known addons register (Bedwars, PhoenixDuels, Homestead, Essentials). The
   validation panel tells you when a target resolves to nothing, and when one needs an addon
   installed to work.
4. **Export.** One click writes one file per form. A modal then shows the lines to paste into your
   server's `config.yml` so the plugin picks the forms up.

Drop the exported files into `plugins/BedrockGUI/forms/`, paste the snippet into
`plugins/BedrockGUI/config.yml`, and reload.

### Why the designer does not write your `config.yml`

It writes forms, not server configuration. Your `config.yml` holds settings the designer has no
business overwriting — the asset server, database credentials, whatever else you have set. So the
export hands you the registry lines to add and leaves the rest of the file alone.

## What it knows about the plugin

`src/plugin/` is a versioned, data-only model of BedrockGUI 2.0.11 — the 14 action types and their
capability gates, the condition grammar, the built-in placeholders, image-source classification,
the addon catalogues, and the plugin's own limits. Everything else in the app derives from it, so
the designer offers what the plugin actually implements rather than what its documentation
describes. Where the two disagree, the plugin's Java source wins; the differences found so far are
catalogued in `docs/superpowers/specs/`.

The round-trip is pinned by golden tests against byte-exact copies of the seven form files the
plugin ships, so a change to parsing or serialization has to keep reproducing real files.

## Development

```bash
npm install
npm run dev          # Vite dev server on :5173
npm run verify       # the full gate: typecheck + unit tests + build + bundle size + chromium e2e
```

| Command | What it does |
|---|---|
| `npm test` | unit and integration tests (vitest, jsdom) |
| `npm run test:ui` | the same, in watch mode |
| `npm run e2e` | Playwright across chromium, firefox and webkit |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | typecheck, then build (fails on type errors) |
| `npm run deploy` | `wrangler deploy` to Cloudflare |

Run `npm run verify` before merging anything. It is deliberately not part of `npm test` — e2e needs
a dev server and is slow, and keeping the unit suite fast is what makes people actually run it.

See `CLAUDE.md` for the architecture.

## Deploying

The build is static. `npm run deploy` publishes `dist/` as Cloudflare Worker static assets; SPA
fallback and security headers live in `worker.ts`. A `Dockerfile` and `nginx.conf` are included for
self-hosting.

## Scope

Bedrock forms only. Java menus are out of scope — a `java:` block in an imported file is preserved
verbatim and never interpreted, so the designer will not damage a file that has one.
