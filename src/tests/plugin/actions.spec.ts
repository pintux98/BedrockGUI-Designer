import { describe, it, expect } from "vitest";
import {
  ACTION_IDS,
  ACTIONS,
  actionPlatformNote,
  actionsForPlatform,
  type ActionId
} from "../../plugin/actions";
import { capabilityNote } from "../../plugin/platforms";
import { parseActionBlock } from "../../plugin/grammar";
import { validateCondition } from "../../plugin/conditions";

describe("action registry", () => {
  it("ships exactly 14 actions", () => {
    expect(ACTION_IDS).toHaveLength(14);
  });

  it("does not contain url", () => {
    expect(ACTION_IDS).not.toContain("url");
  });

  it("contains every action the plugin registers", () => {
    for (const id of [
      "command", "open", "message", "delay", "server", "broadcast", "inventory",
      "sound", "economy", "title", "actionbar", "conditional", "random", "bungee"
    ]) {
      expect(ACTION_IDS).toContain(id);
    }
  });

  it("offers 12 actions on a proxy, omitting sound and economy", () => {
    const ids = actionsForPlatform("velocity").map((a) => a.id);
    expect(ids).toHaveLength(12);
    expect(ids).not.toContain("sound");
    expect(ids).not.toContain("economy");
  });

  it("offers all 14 on Paper", () => {
    expect(actionsForPlatform("paper")).toHaveLength(14);
  });

  it("gives every action its full UI metadata", () => {
    for (const id of ACTION_IDS) {
      const def = ACTIONS[id];
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
      expect(def.icon.length).toBeGreaterThan(0);
      expect(def.color.length).toBeGreaterThan(0);
      expect(def.placeholder.length).toBeGreaterThan(0);
      expect(def.formatExample).toContain(`${id} {`);
    }
  });

  it("carries every action the old UI table carried, minus url", () => {
    const legacy = ["message", "command", "server", "broadcast", "open", "sound", "economy",
      "title", "actionbar", "inventory", "delay", "random", "bungee", "conditional"];
    for (const id of legacy) expect(ACTION_IDS).toContain(id);
    expect(ACTION_IDS).not.toContain("raw");
  });

  /**
   * The picker no longer filters by platform, so the capability gate is surfaced as a
   * note instead. Which two actions carry it is checked against the plugin: Velocity
   * and Bungee construct BedrockGUIApi with null sound and economy managers
   * (velocity/…/BedrockGUI.java:135, bungeecord/…/BedrockGUI.java:91), and
   * registerDefaultActionHandlers registers those two handlers only when their manager
   * is non-null (FormMenuUtil.java:96-102). It passes a command executor and a title
   * manager, so `server`, `broadcast`, `inventory`, `title` and `actionbar` are not
   * Paper-only and must carry no note.
   */
  it("notes exactly sound and economy as Paper-only", () => {
    const noted = ACTION_IDS.filter((id) => actionPlatformNote(id) !== undefined);
    expect(noted).toEqual(["sound", "economy"]);
  });

  it("writes the Paper-only note naming the manager the proxy lacks", () => {
    expect(actionPlatformNote("sound")).toBe(
      "Paper only — a proxy registers no sound manager, so this action has no handler there."
    );
    expect(actionPlatformNote("economy")).toBe(
      "Paper only — a proxy registers no economy manager, so this action has no handler there."
    );
  });

  it("leaves every action a proxy does register unnoted", () => {
    for (const id of ["command", "open", "message", "delay", "server", "broadcast",
      "inventory", "title", "actionbar", "conditional", "random", "bungee"] as ActionId[]) {
      expect(actionPlatformNote(id), id).toBeUndefined();
    }
  });

  it("derives the note from the capability, not from the action id", () => {
    // Two actions share the "title" capability and both must follow it, whatever it says.
    expect(ACTIONS.title.capability).toBe("title");
    expect(ACTIONS.actionbar.capability).toBe("title");
    expect(actionPlatformNote("title")).toBe(capabilityNote("title"));
    expect(actionPlatformNote("actionbar")).toBe(capabilityNote("title"));
    expect(actionPlatformNote("sound")).toBe(capabilityNote("sound"));
  });

  it("every action's formatExample parses to a non-raw ParsedAction", () => {
    for (const id of ACTION_IDS) {
      const parsed = parseActionBlock(ACTIONS[id].formatExample);
      expect(parsed.kind, `${id}: ${JSON.stringify(parsed)}`).not.toBe("raw");
    }
  });
});

/**
 * The hint strings are copy targets: `placeholder` is the input's placeholder text
 * and `formatExample` is rendered in a <pre>. A hint that does not run is worse than
 * no hint, so each one is pinned against the handler that parses it.
 */
describe("action hints match the handlers that parse them", () => {
  /**
   * Minimum colon-separated parts each handler accepts on one action line.
   * The value is what the Java rejects below, not what reads nicely.
   */
  const MIN_COLON_PARTS: Partial<Record<ActionId, number>> = {
    // InventoryActionHandler.java:86-92 — split(":", 3), then
    // `if (parts.length < 2) ... "Expected: operation:item[:amount]"`.
    inventory: 2,
    // EconomyActionHandler.java:121-127 — split(":"), then
    // `if (parts.length < 2) ... "Expected: operation:amount"`.
    economy: 2,
    // SoundActionHandler.java:243-249 — split(":"), fails only when parts[0] is
    // blank; volume and pitch are optional.
    sound: 1,
    // TitleActionHandler.java:157-164 — split(":"), parts[1..4] all optional.
    title: 1
  };

  /** The colon-form samples a `placeholder` offers, e.g. "e.g. add:100, remove:50". */
  function placeholderSamples(placeholder: string): string[] {
    return placeholder
      .replace(/^e\.g\.\s*/, "")
      .split(", ")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /** The quoted lines a `formatExample` block holds. */
  function exampleLines(formatExample: string): string[] {
    return [...formatExample.matchAll(/-\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  }

  it("uses no '||' separator anywhere — no handler splits on one", () => {
    // TitleActionHandler.java:158 is `processedData.split(":")`. "||" was invented.
    for (const id of ACTION_IDS) {
      expect(ACTIONS[id].placeholder, `${id} placeholder`).not.toContain("||");
      expect(ACTIONS[id].formatExample, `${id} formatExample`).not.toContain("||");
      expect(ACTIONS[id].description, `${id} description`).not.toContain("||");
    }
  });

  it("gives every colon-form example the arity its handler requires", () => {
    for (const [id, min] of Object.entries(MIN_COLON_PARTS) as [ActionId, number][]) {
      for (const line of exampleLines(ACTIONS[id].formatExample)) {
        expect(line.split(":").length, `${id} formatExample line "${line}"`)
          .toBeGreaterThanOrEqual(min);
      }
      for (const sample of placeholderSamples(ACTIONS[id].placeholder)) {
        expect(sample.split(":").length, `${id} placeholder sample "${sample}"`)
          .toBeGreaterThanOrEqual(min);
      }
    }
  });

  it("makes the inventory and economy placeholders agree with their examples", () => {
    expect(placeholderSamples(ACTIONS.inventory.placeholder)).toEqual(["give:diamond:1", "clear:all"]);
    expect(exampleLines(ACTIONS.inventory.formatExample)).toEqual(["give:diamond:1", "clear:all"]);
    expect(placeholderSamples(ACTIONS.economy.placeholder)).toEqual(["add:100", "remove:50", "set:1000"]);
    expect(exampleLines(ACTIONS.economy.formatExample)).toEqual(["add:100", "remove:50", "set:1000"]);
  });

  it("writes the title example as title:subtitle:fadeIn:stay:fadeOut", () => {
    const [line] = exampleLines(ACTIONS.title.formatExample);
    const parts = line.split(":");
    expect(parts).toHaveLength(5);
    expect(parts.slice(2)).toEqual(["20", "60", "20"]);
    expect(ACTIONS.title.placeholder.replace(/^e\.g\.\s*/, "")).toBe(line);
  });

  it("writes the delay example as bare milliseconds", () => {
    // DelayActionHandler.java:129 is Long.parseLong(delayValue): "1s" and "500ms"
    // throw, and a bare number is milliseconds, never ticks.
    for (const line of exampleLines(ACTIONS.delay.formatExample)) {
      expect(line).toMatch(/^\d+$/);
      expect(Number(line)).toBeLessThanOrEqual(30000);
    }
    expect(ACTIONS.delay.placeholder).not.toMatch(/\btick/i);
    expect(ACTIONS.delay.placeholder).not.toMatch(/\d+\s*m?s\b/);
    expect(ACTIONS.delay.placeholder).toMatch(/millisecond/i);
  });

  it("writes the conditional hint as a real condition atom", () => {
    // "hasPermission" is not a condition kind. A check accepts permission: and
    // placeholder:<value> <op> <expected> — validated here the same way the UI does.
    const check = ACTIONS.conditional.placeholder.replace(/^e\.g\.\s*/, "");
    expect(validateCondition(check, "symbol")).toEqual([]);
    const parsed = parseActionBlock(ACTIONS.conditional.formatExample);
    expect(parsed.kind).toBe("conditional");
    if (parsed.kind === "conditional") {
      expect(validateCondition(parsed.check, "symbol")).toEqual([]);
    }
  });
});
