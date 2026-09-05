import * as yaml from "js-yaml";
import { ADDONS, AddonDef, findAddonForActionId } from "../plugin/addons";
import { ParsedAction, parseActionBlock } from "../plugin/grammar";
import { FormDoc } from "../core/project";
import { ActionInstance, BedrockButton } from "../core/types";

export function buildConfigSnippet(forms: FormDoc[]): string {
  return yaml.dump(
    { forms: Object.fromEntries(forms.map((f) => [f.id, { file: f.fileName }])) },
    { lineWidth: -1, noRefs: true, forceQuotes: true, quoteStyle: "double" }
  );
}

/** One addon the exported project cannot run without, and the ids that need it. */
export interface AddonRequirement {
  addon: AddonDef;
  /** The addon action types this project actually writes, sorted, deduplicated. */
  actionIds: string[];
}

/**
 * The addons an exported project needs installed.
 *
 * Nothing else in the export says so: an addon action is just an action type in the
 * registry, so a form using one parses, validates and exports exactly like any other —
 * and then fails at runtime with "Unknown action type" if the jar is missing. This is
 * *not* part of the config snippet: nothing here is pasted into `config.yml`, because
 * an addon registers action handlers, never forms.
 *
 * Only addons the project genuinely uses are returned, in `ADDONS` order.
 */
export function addonRequirements(forms: FormDoc[]): AddonRequirement[] {
  const used = new Map<string, Set<string>>();
  for (const form of forms) {
    for (const raw of rawActionBlocks(form)) collectAddonIds(parseActionBlock(raw), used);
  }
  return ADDONS.filter((addon) => used.has(addon.id)).map((addon) => ({
    addon,
    actionIds: [...used.get(addon.id)!].sort()
  }));
}

/**
 * The head of a raw action block: the action type, however it is written.
 *
 * `parseActionBlock` structures the 14 types the plugin itself registers and leaves
 * everything else `raw` — `isActionId` is false for an addon id — so the head of a raw
 * block is where an addon action shows up. Both shapes the executor accepts start the
 * same way: `bw_shop_main:…` (ActionExecutor.java:225-235) and the brace form
 * `bw_shop_main { … }` (:219-222, NEW_FORMAT_PATTERN).
 */
const ACTION_HEAD = /^([A-Za-z_][A-Za-z0-9_]*)\s*[:{]/;

function collectAddonIds(action: ParsedAction, out: Map<string, Set<string>>): void {
  switch (action.kind) {
    case "raw": {
      const head = action.text.trim().match(ACTION_HEAD);
      if (!head) return;
      const addon = findAddonForActionId(head[1]);
      if (!addon) return;
      const ids = out.get(addon.id) ?? new Set<string>();
      ids.add(head[1]);
      out.set(addon.id, ids);
      return;
    }
    case "conditional":
      for (const child of [...action.whenTrue, ...action.whenFalse]) collectAddonIds(child, out);
      return;
    case "random":
      // Entries are single-line colon-form actions with the @weight already stripped.
      for (const entry of action.entries) collectAddonIds(parseActionBlock(entry.text), out);
      return;
    default:
      /**
       * A `lines` block is one of the 14 builtins. An addon id inside an `open` block
       * is deliberately not counted: `open` resolves against `formMenus`, so it can
       * never reach an addon handler — installing the jar would not save it, and
       * `validateProject` already reports it as the error it is.
       */
      return;
  }
}

/**
 * Every action block a form can execute. Mirrors the traversal in
 * `core/validateProject.ts`, which walks the same places for the same reason.
 */
function rawActionBlocks(form: FormDoc): string[] {
  const out: string[] = [];
  const pushRaw = (raw: unknown) => {
    if (typeof raw === "string" && raw.trim()) out.push(raw.trim());
  };
  const push = (actions?: ActionInstance[]) => {
    for (const action of actions ?? []) {
      pushRaw(typeof action?.raw === "string" ? action.raw : action?.params);
    }
  };
  const bedrock = form.bedrock;
  if (bedrock.type === "SIMPLE" || bedrock.type === "MODAL") {
    for (const button of bedrock.buttons ?? []) {
      push(button?.onClick);
      pushRaw(button?.alternativeOnClick);
      for (const value of conditionOnClickValues(button)) pushRaw(value);
    }
  } else {
    for (const component of bedrock.components ?? []) push(component?.action);
  }
  push(bedrock.globalActions);
  return out;
}

function conditionOnClickValues(button?: BedrockButton): string[] {
  const out: string[] = [];
  for (const rule of button?.conditions ?? []) {
    if (rule?.property === "onClick") out.push(rule.value);
  }
  return out;
}
