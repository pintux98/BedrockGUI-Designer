import { findAddonForFormId } from "../plugin/addons";
import { ParsedAction, parseActionBlock } from "../plugin/grammar";
import { FormDoc, Project } from "./project";
import { ActionInstance } from "./types";

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
  const resolves = (target: string) => formIds.has(target) || findAddonForFormId(target) !== undefined;

  out.push(...duplicateFileNameIssues(project.forms));

  const reached = new Set<string>();
  for (const form of project.forms) {
    const seen = new Set<string>();
    for (const group of collectOpenGroups(form)) {
      for (const target of menuTargets(group, resolves)) {
        if (target !== form.id && formIds.has(target)) reached.add(target);
        if (seen.has(target)) continue;
        seen.add(target);
        const issue = targetIssue(form.id, target, formIds);
        if (issue) out.push(issue);
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
  const addon = findAddonForFormId(target);
  if (addon) {
    return {
      level: "warning",
      formId,
      message: `Form '${formId}' opens '${target}', which is provided by the ${addon.name} (${addon.jar}). It only works on servers where that addon is installed.`
    };
  }
  return {
    level: "error",
    formId,
    message: `Form '${formId}' opens '${target}', which is not a form in this project or a known addon form. The plugin will fail to open it at runtime.`
  };
}

function unreachableIssues(forms: FormDoc[], reached: Set<string>): ProjectIssue[] {
  if (forms.length <= 1) return [];
  const out: ProjectIssue[] = [];
  for (const form of forms) {
    if (reached.has(form.id)) continue;
    if (typeof form.bedrock.command === "string" && form.bedrock.command.trim()) continue;
    out.push({
      level: "warning",
      formId: form.id,
      message: `Form '${form.id}' is not opened by any other form and registers no command of its own. Only '/bedrockgui open ${form.id}' can reach it.`
    });
  }
  return out;
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
 */
function menuTargets(group: string[], resolves: (target: string) => boolean): string[] {
  const head = group[0];
  if (group.length === 1) return isStatic(head) ? [head] : [];
  const chain = group.every((line) => isStatic(line) && isValidMenuName(line) && resolves(line));
  const lines = chain ? group : [head];
  return lines.filter(isStatic);
}

/** A target carrying a placeholder is only known at runtime, so it is never an issue. */
function isStatic(target: string): boolean {
  return target.length > 0 && !/[{}%$]/.test(target);
}

/** Mirrors ValidationUtils.isValidMenuName in the plugin. */
function isValidMenuName(target: string): boolean {
  return target.length <= 100 && /^[a-zA-Z0-9_.-]+$/.test(target);
}

function unquote(value: string): string {
  const match = value.match(/^"(.*)"$/) ?? value.match(/^'(.*)'$/);
  return match ? match[1] : value;
}

function rawActionBlocks(form: FormDoc): string[] {
  const out: string[] = [];
  const push = (actions?: ActionInstance[]) => {
    for (const action of actions ?? []) {
      const raw =
        typeof action?.raw === "string"
          ? action.raw.trim()
          : typeof action?.params === "string"
            ? action.params.trim()
            : "";
      if (raw) out.push(raw);
    }
  };
  const bedrock = form.bedrock;
  if (bedrock.type === "SIMPLE" || bedrock.type === "MODAL") {
    for (const button of bedrock.buttons ?? []) push(button?.onClick);
  } else {
    for (const component of bedrock.components ?? []) push(component?.action);
  }
  push(bedrock.globalActions);
  return out;
}
