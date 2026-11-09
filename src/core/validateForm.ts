import type { FormDoc } from "./project";
import type { ActionInstance } from "./types";
import { choiceList } from "./componentMeta";
import { isActionId, classifyImage, validateCondition, findAddonForActionId, LIMITS } from "../plugin";
import { parseActionBlock, type ParsedAction } from "../plugin/grammar";
import { validateActionLine, validateRandomEntry, type LineContext, type LineProblem } from "../plugin/lines";

export type IssueTarget = { kind: "button" | "component"; id: string };

export interface FormIssue {
  level: "error" | "warning";
  message: string;
  target?: IssueTarget;
}

export function validateForm(doc: FormDoc, ctx: LineContext = {}): FormIssue[] {
  const out: FormIssue[] = [];
  const b = doc.bedrock;
  if (!b) return out;

  if (b.type === "MODAL" && Array.isArray(b.buttons) && b.buttons.length !== LIMITS.modalButtonCount) {
    out.push({ level: "error", message: `A yes / no form must have exactly ${LIMITS.modalButtonCount} buttons.` });
  }
  if (b.commandIntercept && b.commandIntercept.trim().length < 2) {
    out.push({ level: "warning", message: "The replaced command looks too short." });
  }
  if (b.openCondition && validateCondition(b.openCondition, "colon").length) {
    out.push({ level: "warning", message: "Open condition looks invalid." });
  }
  if (!isCooldown(b.cooldown)) {
    out.push({ level: "warning", message: `Form cooldown '${b.cooldown}' is not like 30, 30s, 2m or 1h. The plugin reads it as no cooldown.` });
  }

  if (b.type === "SIMPLE" || b.type === "MODAL") {
    for (const btn of b.buttons ?? []) {
      const target: IssueTarget = { kind: "button", id: btn.id };
      const label = `Button '${btn.id}'`;
      if (!btn.text?.trim()) out.push({ level: "error", message: `${label}: text is required.`, target });
      if (btn.image && classifyImage(btn.image).kind === "unknown") {
        out.push({ level: "warning", message: `${label}: icon '${btn.image}' is not something the plugin can show.`, target });
      }
      if (btn.showCondition && validateCondition(btn.showCondition, "colon").length) {
        out.push({ level: "warning", message: `${label}: show condition looks invalid.`, target });
      }
      for (const rule of btn.conditions ?? []) {
        if (rule.condition && validateCondition(rule.condition, "colon").length) {
          out.push({ level: "warning", message: `${label}: override '${rule.id}' has an invalid condition.`, target });
        }
      }
      if (!isCooldown(btn.cooldown)) {
        out.push({ level: "warning", message: `${label}: cooldown '${btn.cooldown}' is not like 30, 30s, 2m or 1h. The plugin reads it as no cooldown.`, target });
      }
      out.push(...validateActions(label, btn.onClick, ctx, target));
    }
  }

  if (b.type === "CUSTOM") {
    for (const comp of b.components ?? []) {
      const target: IssueTarget = { kind: "component", id: comp.id };
      const label = `Field '${comp.id}'`;
      if (comp.type === "label") {
        if (comp.action?.length) out.push({ level: "warning", message: `${label}: labels return nothing, so this action never runs.`, target });
        continue;
      }
      if (comp.type === "dropdown" || comp.type === "step_slider") {
        const key = comp.type === "dropdown" ? "options" : "steps";
        const list = choiceList(comp.props?.[key]);
        if (!list.length) out.push({ level: "warning", message: `${label}: ${key} is empty.`, target });
        const def = comp.props?.default;
        if (def !== undefined && list.length && Array.isArray(comp.props?.[key]) && (Number(def) < 0 || Number(def) >= list.length)) {
          out.push({ level: "warning", message: `${label}: the starting choice is outside ${key}, so the plugin picks the first one.`, target });
        }
      }
      if (comp.type === "slider") {
        const min = Number(comp.props?.min ?? 0);
        const max = Number(comp.props?.max ?? 10);
        if (!(max > min)) out.push({ level: "error", message: `${label}: max must be bigger than min.`, target });
      }
      out.push(...validateActions(label, comp.action, ctx, target));
    }
  }

  out.push(...validateActions("On close", b.onClose, ctx));
  out.push(...validateActions(b.type === "CUSTOM" ? "On submit" : "Global actions", b.globalActions, ctx));
  return out;
}

export function isCooldown(value: unknown): boolean {
  return value === undefined || value === "" || /^\s*\d+\s*[smh]?\s*$/i.test(String(value));
}

function rawOf(a: ActionInstance): string {
  return typeof a?.raw === "string" ? a.raw.trim() : typeof a?.params === "string" ? a.params.trim() : "";
}

function validateActions(label: string, actions: ActionInstance[] | undefined, ctx: LineContext, target?: IssueTarget): FormIssue[] {
  const out: FormIssue[] = [];
  for (const a of actions ?? []) {
    const raw = rawOf(a);
    if (!raw) continue;
    for (const p of validateBlock(raw, ctx)) out.push({ level: p.level, message: `${label}: ${p.message}`, target });
  }
  return out;
}

const err = (message: string): LineProblem => ({ level: "error", message });
const warn = (message: string): LineProblem => ({ level: "warning", message });
const prefix = (text: string) => (p: LineProblem): LineProblem => ({ ...p, message: `${text}: ${p.message}` });

export function validateBlock(raw: string, ctx: LineContext): LineProblem[] {
  const type = extractActionType(raw);
  if (!type) return [err(`could not tell which action '${shorten(raw)}' is.`)];
  if (!isActionId(type)) {
    const addon = findAddonForActionId(type);
    return addon
      ? [warn(`'${type}' comes from ${addon.name} (${addon.jar}) and only runs on servers with that addon.`)]
      : [err(`'${type}' is not an action the plugin knows, so it fails and stops the steps after it.`)];
  }
  const opens = (raw.match(/\{/g) ?? []).length;
  const closes = (raw.match(/\}/g) ?? []).length;
  if (opens !== closes) return [err(`the braces of '${type}' do not match up.`)];
  if (!raw.includes("{")) return [warn(`'${shorten(raw)}' uses the old one-line format. Re-add it with Add action.`)];
  const header = raw.slice(0, raw.indexOf("{")).trim();
  if (header !== header.toLowerCase()) {
    return [err(`write "${header.toLowerCase()}" in lowercase. "${header}" is not read as an action and its text is sent as-is.`)];
  }
  return validateParsed(parseActionBlock(raw), ctx);
}

function validateParsed(action: ParsedAction, ctx: LineContext): LineProblem[] {
  switch (action.kind) {
    case "lines": {
      const lines = action.lines.filter((l) => l.trim());
      if (!lines.length) return [warn(`${action.id} has no lines, so it does nothing.`)];
      return lines.flatMap((line) => validateActionLine(action.id, line, ctx).map(prefix(`${action.id} "${shorten(line)}"`)));
    }
    case "random": {
      if (!action.entries.length) return [err("random has no entries.")];
      return action.entries.flatMap((e) => validateRandomEntry(e.text, e.weight, ctx).map(prefix(`random entry "${shorten(e.text)}"`)));
    }
    case "conditional": {
      const out: LineProblem[] = [];
      if (!action.check.trim()) out.push(err("conditional has no check."));
      else out.push(...validateCondition(action.check, "symbol").map((p) => warn(`conditional check: ${p}`)));
      if (!action.whenTrue.length && !action.whenFalse.length) out.push(err("conditional needs actions in If true or If false."));
      for (const child of [...action.whenTrue, ...action.whenFalse]) out.push(...validateParsed(child, ctx));
      return out;
    }
    case "bungee":
      return action.subchannel.trim() ? [] : [err("bungee has no subchannel.")];
    case "raw":
      return [];
  }
}

function extractActionType(raw: string): string | undefined {
  const s = raw.trim();
  const brace = s.indexOf("{");
  if (brace > 0) return s.slice(0, brace).trim().toLowerCase();
  const colon = s.indexOf(":");
  if (colon > 0) return s.slice(0, colon).trim().toLowerCase();
  return undefined;
}

function shorten(s: string) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > 48 ? `${t.slice(0, 45)}...` : t;
}
