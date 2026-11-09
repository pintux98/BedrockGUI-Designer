import { ACTION_IDS, type ActionId } from "./actions";
import { LIMITS } from "./limits";

export interface LineContext {
  sounds?: Set<string>;
  items?: Set<string>;
}

export interface LineProblem {
  level: "error" | "warning";
  message: string;
}

const error = (message: string): LineProblem => ({ level: "error", message });
const warning = (message: string): LineProblem => ({ level: "warning", message });

export function isDynamic(value: string): boolean {
  return /[$%{]/.test(value);
}

export const INVENTORY_OPS = ["give", "remove", "check", "clear"] as const;
export const ECONOMY_OPS = ["add", "remove", "set", "check", "pay"] as const;
export const SERVER_BLOCKED_PREFIXES = ["rm ", "del ", "format", "shutdown", "reboot", "kill", "sudo", "chmod", "chown", "passwd"];
const MENU_NAME = /^[a-zA-Z0-9_.-]{1,100}$/;
const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const NUMERIC = /^-?[0-9.]+$/;
const TICKS = /^\d{1,6}$/;

export interface SoundLine {
  name: string;
  volume: string;
  pitch: string;
}

export function parseSoundLine(line: string): SoundLine {
  const parts = line.split(":");
  if (parts.length > 1 && !NUMERIC.test(parts[1])) parts.splice(0, 2, `${parts[0]}:${parts[1]}`);
  return { name: parts[0] ?? "", volume: parts[1] ?? "", pitch: parts[2] ?? "" };
}

export function formatSoundLine(s: SoundLine): string {
  const volume = s.volume.trim() || "1";
  const pitch = s.pitch.trim() || "1";
  return volume === "1" && pitch === "1" ? s.name.trim() : `${s.name.trim()}:${volume}:${pitch}`;
}

export interface InventoryLine {
  op: string;
  item: string;
  amount: string;
}

export function parseInventoryLine(line: string): InventoryLine {
  const [op = "", item = "", amount = ""] = splitLimit(line, ":", 3);
  return { op: op.toLowerCase(), item, amount };
}

export function formatInventoryLine(l: InventoryLine): string {
  if (l.op === "clear") return `clear:${l.item.trim() || "all"}`;
  const item = l.item.trim().replace(/^minecraft:/i, "").toLowerCase();
  const amount = l.amount.trim();
  return amount && amount !== "1" ? `${l.op}:${item}:${amount}` : `${l.op}:${item}`;
}

export interface EconomyLine {
  op: string;
  target: string;
  amount: string;
}

export function parseEconomyLine(line: string): EconomyLine {
  const parts = line.split(":");
  const op = (parts[0] ?? "").toLowerCase();
  return op === "pay" ? { op, target: parts[1] ?? "", amount: parts[2] ?? "" } : { op, target: "", amount: parts[1] ?? "" };
}

export function formatEconomyLine(l: EconomyLine): string {
  const amount = l.amount.trim();
  return l.op === "pay" ? `pay:${l.target.trim()}:${amount}` : `${l.op}:${amount}`;
}

export interface TitleLine {
  title: string;
  subtitle: string;
  fadeIn: string;
  stay: string;
  fadeOut: string;
}

export const TITLE_DEFAULTS = { fadeIn: "10", stay: "60", fadeOut: "10" };

export function splitTitle(line: string): string[] {
  const parts: string[] = [];
  let current = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\\" && line[i + 1] === ":") {
      current += ":";
      i++;
      continue;
    }
    if (ch === "%") {
      const close = line.indexOf("%", i + 1);
      if (close > i + 1 && !/\s/.test(line.slice(i + 1, close))) {
        current += line.slice(i, close + 1);
        i = close;
        continue;
      }
    }
    if (ch === ":") {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

export function parseTitleLine(line: string): TitleLine {
  const parts = splitTitle(line);
  const last = parts.slice(-3);
  if (parts.length >= 5 && last.every((p) => TICKS.test(p.trim()))) {
    return { title: parts[0], subtitle: parts.slice(1, -3).join(":"), fadeIn: last[0], stay: last[1], fadeOut: last[2] };
  }
  return { title: parts[0] ?? "", subtitle: parts.slice(1).join(":"), ...TITLE_DEFAULTS };
}

function escapeTitle(text: string): string {
  return text.replace(/(%[^%\s]+%)|:/g, (m, ph) => (ph ? ph : "\\:"));
}

export function formatTitleLine(t: TitleLine): string {
  const timing = [t.fadeIn, t.stay, t.fadeOut].map((x) => x.trim() || "0");
  const defaultTiming = timing.join(":") === "10:60:10";
  const parts = [escapeTitle(t.title.trim())];
  if (t.subtitle.trim() || !defaultTiming) parts.push(escapeTitle(t.subtitle.trim()));
  if (!defaultTiming) parts.push(...timing);
  return parts.join(":");
}

function splitLimit(text: string, sep: string, limit: number): string[] {
  const parts = text.split(sep);
  return parts.length <= limit ? parts : [...parts.slice(0, limit - 1), parts.slice(limit - 1).join(sep)];
}

const enumForms = new WeakMap<Set<string>, Set<string>>();

function soundKnown(name: string, sounds: Set<string>): boolean {
  const key = name.trim().toLowerCase().replace(/^minecraft:/, "");
  if (sounds.has(key)) return true;
  let forms = enumForms.get(sounds);
  if (!forms) {
    forms = new Set([...sounds].map((s) => s.replace(/\./g, "_").toUpperCase()));
    enumForms.set(sounds, forms);
  }
  const e = key.replace(/\./g, "_").toUpperCase();
  return ["", "ENTITY_", "BLOCK_", "UI_"].some((p) => forms!.has(p + e));
}

export function validateActionLine(id: ActionId, line: string, ctx: LineContext = {}): LineProblem[] {
  const value = line.trim();
  if (!value) return [];
  switch (id) {
    case "server": {
      const lower = value.toLowerCase().replace(/^\//, "");
      const blocked = SERVER_BLOCKED_PREFIXES.find((p) => lower.startsWith(p));
      return blocked ? [error(`the plugin refuses console commands starting with "${blocked.trim()}", so nothing in this action runs.`)] : [];
    }
    case "open":
      return isDynamic(value) || MENU_NAME.test(value)
        ? []
        : [error("form names may only use letters, numbers, _ . and -, so this action is rejected.")];
    case "message":
      return value.length > LIMITS.messageMaxChars ? [error(`longer than ${LIMITS.messageMaxChars} characters, so it is rejected.`)] : [];
    case "broadcast": {
      const m = value.match(/^radius:([^:]*):/i);
      return m && !isDynamic(m[1]) && !DECIMAL.test(m[1]) ? [error(`radius "${m[1]}" is not a number.`)] : [];
    }
    case "delay": {
      if (value.includes("%")) return [error("delay cannot use %placeholders%; the plugin checks the number before filling them in.")];
      if (isDynamic(value)) return [];
      if (!/^\d+$/.test(value)) return [error("delay must be whole milliseconds, like 1500. No decimals or units.")];
      if (Number(value) > LIMITS.delayMaxMs) return [error(`delay is over ${LIMITS.delayMaxMs} ms (30 seconds), so it is rejected.`)];
      return [];
    }
    case "inventory": {
      const l = parseInventoryLine(value);
      if (!INVENTORY_OPS.includes(l.op as never)) return [error(`"${l.op}" is not an inventory operation. Use give, remove, check or clear.`)];
      if (!l.item.trim()) return [error(l.op === "clear" ? 'clear needs "all" or an item, like clear:all.' : "an item is missing.")];
      if (l.op === "clear") return l.item.trim() === "ALL" ? [warning('write "all" in lowercase; "ALL" does nothing.')] : [];
      const out: LineProblem[] = [];
      if (/^minecraft$/i.test(l.item.trim())) return [error('write the item without "minecraft:", like diamond.')];
      if (l.amount && !isDynamic(l.amount) && !/^-?\d+$/.test(l.amount)) out.push(error(`amount "${l.amount}" must be a whole number.`));
      else if (l.amount && !isDynamic(l.amount) && Number(l.amount) <= 0) out.push(error("amount must be at least 1."));
      if (!isDynamic(l.item)) {
        if (l.op === "give" && l.item !== l.item.toLowerCase()) out.push(warning("item names must be lowercase for give, or nothing is given."));
        if (ctx.items && !ctx.items.has(l.item.toLowerCase())) out.push(warning(`"${l.item}" is not a Minecraft item id.`));
      }
      return out;
    }
    case "economy": {
      const l = parseEconomyLine(value);
      if (!ECONOMY_OPS.includes(l.op as never)) return [error(`"${l.op}" is not an economy operation. Use add, remove, set, check or pay.`)];
      if (l.op === "pay" && value.split(":").length < 3) return [error("pay needs a player and an amount, like pay:Steve:100.")];
      if (!l.amount) return [error("the amount is missing.")];
      if (isDynamic(l.amount)) return [];
      if (!DECIMAL.test(l.amount)) return [error(`amount "${l.amount}" is not a number. No commas, spaces or $ signs.`)];
      const n = Number(l.amount);
      if (l.op === "set" ? n < 0 : n <= 0) return [error(l.op === "set" ? "balance cannot be negative." : "amount must be more than 0.")];
      return [];
    }
    case "sound": {
      const s = parseSoundLine(value);
      const out: LineProblem[] = [];
      if (s.pitch && !NUMERIC.test(s.pitch)) out.push(warning(`pitch "${s.pitch}" is not a number, so 1 is used.`));
      if (!isDynamic(s.name) && ctx.sounds && !soundKnown(s.name, ctx.sounds)) {
        out.push(error(`"${s.name}" is not a Minecraft sound. On Paper the action fails and stops the steps after it.`));
      }
      return out;
    }
    case "title": {
      const parts = splitTitle(value);
      if (parts.length === 4 && parts.slice(1).every((p) => TICKS.test(p.trim()))) {
        return [warning(`this shows "${parts.slice(1).join(":")}" as the subtitle. For timing without a subtitle write ${parts[0]}::${parts.slice(1).join(":")}.`)];
      }
      return [];
    }
    default:
      return [];
  }
}

export function validateRandomEntry(text: string, weight: number | undefined, ctx: LineContext = {}): LineProblem[] {
  const value = text.trim();
  if (!value) return [error("this entry is empty.")];
  if (weight !== undefined && !(weight > 0)) return [error("weight must be more than 0.")];
  if (/@\S*$/.test(value) && weight === undefined) {
    return [warning("the @ at the end is not read as a weight (use a positive number like @2), so it stays in the text.")];
  }
  if (/\{/.test(value) && /^\s*[a-z_]+\s*\{/i.test(value)) return [error("entries use the short type:value form, not a { } block.")];
  const colon = value.indexOf(":");
  if (colon === -1) return [warning(`no type given, so this runs as the command /${value}.`)];
  const type = value.slice(0, colon).trim().toLowerCase();
  const rest = value.slice(colon + 1);
  if (type === "random") return [error("a random inside random is removed by the plugin.")];
  if (type === "delay") return [warning("a delay inside random does nothing.")];
  if (!(ACTION_IDS as readonly string[]).includes(type)) return [];
  return validateActionLine(type as ActionId, rest, ctx);
}
