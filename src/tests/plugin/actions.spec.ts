import { describe, it, expect } from "vitest";
import { ACTION_IDS, ACTIONS, actionsForPlatform } from "../../plugin/actions";

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
});
