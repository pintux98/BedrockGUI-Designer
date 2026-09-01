import * as yaml from "js-yaml";
import { ActionId, isActionId } from "./actions";

export type ParsedAction =
  | { kind: "lines"; id: ActionId; lines: string[] }
  | { kind: "conditional"; check: string; whenTrue: ParsedAction[]; whenFalse: ParsedAction[] }
  | { kind: "random"; entries: Array<{ text: string; weight?: number }> }
  | { kind: "bungee"; subchannel: string; args: string[] }
  | { kind: "raw"; text: string };

const HEADER = /^\s*([A-Za-z_]+)\s*\{([\s\S]*)\}\s*$/;

export function parseActionBlock(text: string): ParsedAction {
  const raw: ParsedAction = { kind: "raw", text };
  const match = text.match(HEADER);
  if (!match) return raw;

  const id = match[1];
  const body = dedent(match[2]);
  if (!isActionId(id)) return raw;

  try {
    if (id === "conditional") return parseConditional(body, raw);
    if (id === "random") return parseRandom(body, raw);
    if (id === "bungee") return parseBungee(body, raw);
    const loaded = yaml.load(body);
    if (!Array.isArray(loaded) || !loaded.every((v) => typeof v === "string")) return raw;
    return { kind: "lines", id, lines: loaded as string[] };
  } catch {
    return raw;
  }
}

function parseConditional(body: string, raw: ParsedAction): ParsedAction {
  const loaded = yaml.load(body);
  if (!loaded || typeof loaded !== "object" || Array.isArray(loaded)) return raw;
  const map = new Map(Object.entries(loaded as Record<string, unknown>).map(([k, v]) => [String(k), v]));
  const check = map.get("check");
  if (typeof check !== "string") return raw;
  return {
    kind: "conditional",
    check,
    whenTrue: parseBranch(map.get("true")),
    whenFalse: parseBranch(map.get("false"))
  };
}

function parseBranch(value: unknown): ParsedAction[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string").map(parseActionBlock);
}

function parseRandom(body: string, raw: ParsedAction): ParsedAction {
  const loaded = yaml.load(body);
  if (!Array.isArray(loaded) || !loaded.every((v) => typeof v === "string")) return raw;
  return {
    kind: "random",
    entries: (loaded as string[]).map((entry) => {
      const at = entry.lastIndexOf("@");
      if (at === -1) return { text: entry };
      const weight = Number(entry.slice(at + 1));
      if (!Number.isFinite(weight)) return { text: entry };
      return { text: entry.slice(0, at), weight };
    })
  };
}

const SUBCHANNEL_LINE = /^subchannel:\s*(.*)$/;
const LIST_ITEM = /^-\s+(.*)$/;

function parseBungee(body: string, raw: ParsedAction): ParsedAction {
  const lines = body.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  if (!lines.length) return raw;

  const [first, ...rest] = lines;
  const subchannelMatch = first.match(SUBCHANNEL_LINE);
  if (!subchannelMatch) return raw;
  const subchannel = yaml.load(subchannelMatch[1]);
  if (typeof subchannel !== "string") return raw;

  const args: string[] = [];
  for (const line of rest) {
    const item = line.match(LIST_ITEM);
    if (!item) return raw;
    const value = yaml.load(item[1]);
    if (typeof value !== "string") return raw;
    args.push(value);
  }

  return { kind: "bungee", subchannel, args };
}

export function serializeActionBlock(action: ParsedAction): string {
  if (action.kind === "raw") return action.text;
  if (action.kind === "lines") return wrap(action.id, action.lines.map(quoted));
  if (action.kind === "random") {
    return wrap("random", action.entries.map((e) => quoted(e.weight === undefined ? e.text : `${e.text}@${e.weight}`)));
  }
  if (action.kind === "bungee") {
    const lines = [`  subchannel: ${quoted(action.subchannel)}`, ...action.args.map((a) => `  - ${quoted(a)}`)];
    return `bungee {\n${lines.join("\n")}\n}`;
  }
  const lines: string[] = [`  check: ${JSON.stringify(action.check)}`];
  appendBranch(lines, "true", action.whenTrue);
  appendBranch(lines, "false", action.whenFalse);
  return `conditional {\n${lines.join("\n")}\n}`;
}

function appendBranch(out: string[], key: string, branch: ParsedAction[]) {
  if (!branch.length) return;
  out.push(`  ${key}:`);
  for (const child of branch) {
    out.push("    - |");
    for (const line of serializeActionBlock(child).split("\n")) out.push(`      ${line}`);
  }
}

function wrap(id: string, entries: string[]): string {
  return `${id} {\n${entries.map((e) => `  - ${e}`).join("\n")}\n}`;
}

function quoted(value: string): string {
  return JSON.stringify(value);
}

function dedent(body: string): string {
  const lines = body.replace(/^\n/, "").split("\n");
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)![0].length);
  const min = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(min)).join("\n");
}
