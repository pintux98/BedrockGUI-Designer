/**
 * The form-file envelope: the two top-level keys that wrap a single form file.
 *
 * When `forms.<key>.file` names a separate file, `FormMenuUtil.loadFormMenus`
 * rebases its lookups onto exactly these two literals —
 * `bedrockBase = "bedrock"` / `javaBase = "java"` (FormMenuUtil.java:124-125).
 * Every FORM_KEYS entry hangs off the `bedrock` one. The `java` block is
 * carried through parse/serialize verbatim and never interpreted.
 *
 * Consumers: `src/parse/form.ts`, `src/serialize/form.ts`.
 */
export const DOCUMENT_KEYS = {
  bedrock: "bedrock",
  java: "java"
} as const;

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

export const CONDITION_KEYS = {
  condition: "condition",
  property: "property",
  value: "value"
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

/**
 * `config.yml` keys — the server's own config, which the designer reads on
 * import but never writes (it emits one file per form plus a paste-in snippet).
 *
 * - `configVersion` — `ConfigMigrator.DEFAULT_VERSION_KEY` (ConfigMigrator.java:23).
 * - `forms` / `formFile` — the form registry; `FormMenuUtil` iterates
 *   `config.getKeys("forms")` (FormMenuUtil.java:117) and reads
 *   `forms.<key>.file` (FormMenuUtil.java:118) to find each form file.
 * - `assets` + `assetsEnabled` / `assetsHost` / `assetsPort` — the built-in
 *   asset server section, read as `assets.enabled` / `assets.host` /
 *   `assets.port` (AssetServer.java:62-64).
 *
 * DECLARED BUT NOT YET WIRED: the reader `src/parse/config.ts` still spells
 * all of these inline. Pointing it at this table is a follow-up.
 */
export const CONFIG_KEYS = {
  configVersion: "config-version",
  forms: "forms",
  formFile: "file",
  assets: "assets",
  assetsEnabled: "enabled",
  assetsHost: "host",
  assetsPort: "port"
} as const;

export const IGNORED_KEYS = ["translations", "priority", "priority_condition"] as const;
