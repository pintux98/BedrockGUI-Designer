import { findAddonForActionId } from "../plugin/addons";
import { ParsedAction, parseActionBlock } from "../plugin/grammar";
import { FormDoc, Project } from "./project";
import { ActionInstance, BedrockButton } from "./types";

export interface ProjectIssue {
  level: "error" | "warning";
  formId?: string;
  message: string;
}

/**
 * Cross-form checks that a single form cannot see: open targets that do not exist,
 * two forms writing the same file, and forms nothing can navigate to.
 */
export function validateProject(project: Project): ProjectIssue[] {
  const out: ProjectIssue[] = [];
  const formIds = new Set(project.forms.map((f) => f.id));
  /**
   * Only a form of this project can resolve. `open` looks the name up in
   * `FormMenuUtil.hasMenu` (FormMenuUtil.java:1156-1161), which reads `formMenus`,
   * and `loadFormMenus` (FormMenuUtil.java:116-132) fills that map exclusively from
   * `config.getKeys("forms")`. An addon action id is never a key under `forms:`, so
   * it never resolves — installed or not.
   */
  const resolves = (target: string) => formIds.has(target);

  out.push(...duplicateFileNameIssues(project.forms));

  const reached = new Set<string>();
  for (const form of project.forms) {
    const seen = new Set<string>();
    const seenArguments = new Set<string>();
    for (const group of collectOpenGroups(form)) {
      const rejected = malformedArguments(group);
      for (const target of menuTargets(group, resolves)) {
        // A block the plugin refuses to run opens nothing, so it reaches nothing either.
        if (!rejected.length && target !== form.id && formIds.has(target)) reached.add(target);
        if (seen.has(target)) continue;
        seen.add(target);
        const issue = targetIssue(form.id, target, formIds);
        if (issue) out.push(issue);
      }
      for (const argument of rejected) {
        if (seenArguments.has(argument)) continue;
        seenArguments.add(argument);
        out.push(argumentIssue(form.id, group[0], argument));
      }
    }
  }

  out.push(...unreachableIssues(project.forms, reached));
  return out;
}

function duplicateFileNameIssues(forms: FormDoc[]): ProjectIssue[] {
  const byName = new Map<string, string[]>();
  for (const form of forms) {
    const name = form.fileName.trim();
    if (!name) continue;
    byName.set(name, [...(byName.get(name) ?? []), form.id]);
  }
  const out: ProjectIssue[] = [];
  for (const [name, ids] of byName) {
    if (ids.length < 2) continue;
    out.push({
      level: "error",
      message: `Duplicate file name '${name}': forms ${ids.map((i) => `'${i}'`).join(", ")} all export to it, so only the last one written survives.`
    });
  }
  return out;
}

function targetIssue(formId: string, target: string, formIds: Set<string>): ProjectIssue | undefined {
  if (formIds.has(target)) return undefined;

  /**
   * An addon registers action *handlers*, never menus, so this is not a target that
   * merely needs the addon installed — it can never work as an `open` target at all.
   */
  const addon = findAddonForActionId(target);
  if (addon) {
    const base = baseActionId(target);
    // Colon form only. ActionExecutor.parseNewFormat returns null for a `{ }`
    // block with no `- "…"` entry, and the addons' own getUsageExamples() return
    // e.g. "bw_shop_main:" — so advising the brace form would send the user to
    // the one shape the executor refuses.
    const usage = target.includes(":") ? `'${target}'` : `'${base}:'`;
    return {
      level: "error",
      formId,
      message: `Form '${formId}' opens '${target}', but '${base}' is an action type the ${addon.name} (${addon.jar}) registers, not a form. 'open' only finds menus declared under 'forms:', so this fails with ACTION_FORM_NOT_FOUND even when the addon is installed. Write it as its own action instead: ${usage}.`
    };
  }

  /**
   * `OpenFormActionHandler.isValidAction` rejects the whole action before `execute`
   * ever runs when the name is not `^[a-zA-Z0-9_.-]+$` (ValidationUtils.java:12,19-29),
   * which is a different failure from a name that is well-formed but unregistered.
   */
  if (!isValidMenuName(target)) {
    return {
      level: "error",
      formId,
      message: `Form '${formId}' opens '${target}', which is not a usable menu name — only letters, digits, '_', '.' and '-' are allowed, up to 100 characters. The plugin rejects the action outright rather than looking for a menu.`
    };
  }

  return {
    level: "error",
    formId,
    message: `Form '${formId}' opens '${target}', which is not a form in this project. The plugin will fail to open it at runtime.`
  };
}

function unreachableIssues(forms: FormDoc[], reached: Set<string>): ProjectIssue[] {
  if (forms.length <= 1) return [];
  const out: ProjectIssue[] = [];
  for (const form of forms) {
    if (reached.has(form.id)) continue;
    // Both `command` and `command_intercept` open the form from chat: BedrockGUI.java:186-199
    // and :232-251 each call api.openMenu(player, key, args) on a match.
    if (hasText(form.bedrock.command) || hasText(form.bedrock.commandIntercept)) continue;
    out.push({
      level: "warning",
      formId: form.id,
      message: `Form '${form.id}' is not opened by any other form and registers no command or command_intercept of its own. Only '/bedrockgui open ${form.id}' can reach it.`
    });
  }
  return out;
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * The lines of every `open` block reachable from a form, each group kept intact
 * because only the group as a whole says which lines are menu names.
 */
function collectOpenGroups(form: FormDoc): string[][] {
  const out: string[][] = [];
  for (const raw of rawActionBlocks(form)) collectFrom(parseActionBlock(raw), out);
  return out;
}

function collectFrom(action: ParsedAction, out: string[][]): void {
  switch (action.kind) {
    case "lines":
      if (action.id === "open" && action.lines.length) out.push(action.lines);
      return;
    case "conditional":
      for (const child of [...action.whenTrue, ...action.whenFalse]) collectFrom(child, out);
      return;
    case "random":
      // Entries are single-line colon-form actions; the @weight suffix is already stripped.
      for (const entry of action.entries) collectFrom(parseActionBlock(entry.text), out);
      return;
    case "raw": {
      /**
       * The colon form carries exactly one target, however many words follow.
       * `ActionExecutor.parseAction` splits on the first colon only, so the whole
       * remainder arrives as `actionData`; `BaseActionHandler.parseActionData`
       * (BaseActionHandler.java:194-230) splits on `-  "…"` inside braces or on commas
       * inside brackets and otherwise adds the string whole. `open: shop diamond_sword`
       * is therefore a single menu named "shop diamond_sword" — never a head plus
       * arguments — and it is rejected as a malformed name, not looked up.
       */
      const match = action.text.trim().match(/^open\s*:\s*(.+)$/i);
      if (match) out.push([unquote(match[1].trim())]);
      return;
    }
    default:
      return;
  }
}

/**
 * Which lines of one `open` block the plugin actually treats as menus.
 *
 * `OpenFormActionHandler.shouldTreatValuesAsMenuChain` only walks the whole list as a
 * chain of menus when *every* entry is a valid, existing menu name. The moment one is
 * not, `execute` falls back to `openMenu(menu, args)`: line[0] is the menu and the rest
 * are arguments. So the tail is only ever a menu target when all of it resolves —
 * flagging an argument as a missing menu would be a false error on a correct config.
 *
 * Whether an argument line is *well-formed* is a separate question, answered by
 * `malformedArguments` below.
 */
function menuTargets(group: string[], resolves: (target: string) => boolean): string[] {
  const head = group[0];
  if (group.length === 1) return isStatic(head) ? [head] : [];
  const chain = group.every((line) => isStatic(line) && isValidMenuName(line) && resolves(line));
  const lines = chain ? group : [head];
  return lines.filter(isStatic);
}

/**
 * The lines of one `open` block that the plugin would pass as arguments but refuses to
 * accept at all.
 *
 * Being an argument rather than a menu buys a line nothing: `ActionExecutor
 * .executeSingleAction` calls `handler.isValidAction(valueStr)` and returns
 * `failure("Invalid action value for type: " + actionType)` *before* it ever reaches
 * `handler.execute` (ActionExecutor.java:106-113), and
 * `OpenFormActionHandler.isValidAction` (OpenFormActionHandler.java:271-303) runs
 * `parseNewFormatValues` over the whole block and returns false the moment any one value
 * fails `isValidMenuName`. Every line is checked, arguments included, so one malformed
 * argument kills the action and the head menu never opens.
 *
 * A line that is a well-formed name yet matches no form is deliberately absent here: the
 * plugin accepts it as an argument, so reporting it would be a false error.
 */
function malformedArguments(group: string[]): string[] {
  return group.slice(1).filter((line) => isStatic(line) && !isValidMenuName(line));
}

function argumentIssue(formId: string, head: string, argument: string): ProjectIssue {
  return {
    level: "error",
    formId,
    message: `Form '${formId}' opens '${head}' and passes '${argument}' to it as an argument, but '${argument}' is not a usable menu name — only letters, digits, '_', '.' and '-' are allowed, up to 100 characters. The plugin checks every line of an 'open' block before running it, argument lines included, so the whole action is rejected and '${head}' never opens.`
  };
}

/**
 * A target carrying a placeholder is only known at runtime, so it is never an issue.
 *
 * `FormMenuUtil.handleOnClick` (FormMenuUtil.java:916-933) substitutes the block's
 * placeholders — `{key}` and `$key` via `PlaceholderUtil.processDynamicPlaceholders`
 * (PlaceholderUtil.java:59-75), `%…%` via `messageData.replaceVariables` — *before*
 * `actionExecutor.executeAction` and therefore before `isValidAction` sees the string.
 * What is validated is the expansion, which the designer cannot know.
 */
function isStatic(target: string): boolean {
  return target.length > 0 && !/[{}%$]/.test(target);
}

/** Mirrors ValidationUtils.isValidMenuName in the plugin. */
function isValidMenuName(target: string): boolean {
  return target.length <= 100 && /^[a-zA-Z0-9_.-]+$/.test(target);
}

/** The registered action type, without the `:value` payload an addon action may carry. */
function baseActionId(target: string): string {
  const colon = target.indexOf(":");
  return colon > 0 ? target.slice(0, colon) : target;
}

function unquote(value: string): string {
  const match = value.match(/^"(.*)"$/) ?? value.match(/^'(.*)'$/);
  return match ? match[1] : value;
}

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

/**
 * `ConditionalButton.getEffectiveOnClick` (ConditionalButton.java:204-224) runs a
 * `conditions` rule whose property is `onClick` in place of the button's own onClick,
 * and `alternative_onClick` in place of it when the show_condition fails. Both are
 * whole action blocks the button can execute, so an `open` inside either is as real as
 * one in `onClick` — for reporting a broken target and for deciding what is reachable.
 */
function conditionOnClickValues(button?: BedrockButton): string[] {
  const out: string[] = [];
  for (const rule of button?.conditions ?? []) {
    if (rule?.property === "onClick") out.push(rule.value);
  }
  return out;
}
