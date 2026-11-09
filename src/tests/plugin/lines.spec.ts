import { describe, it, expect } from "vitest";
import {
  formatInventoryLine,
  formatSoundLine,
  formatTitleLine,
  parseSoundLine,
  parseTitleLine,
  validateActionLine,
  validateRandomEntry
} from "../../plugin/lines";
import { parseActionBlock } from "../../plugin/grammar";
import { validateBlock } from "../../core/validateForm";
import type { ActionId } from "../../plugin/actions";

const ctx = {
  sounds: new Set(["entity.experience_orb.pickup", "ui.button.click", "entity.player.levelup"]),
  items: new Set(["diamond", "gold_ingot"])
};

const levels = (id: ActionId, line: string) => validateActionLine(id, line, ctx).map((p) => p.level);

describe("lines that break on the server are errors", () => {
  const broken: [ActionId, string][] = [
    ["delay", "45000"],
    ["delay", "1.5"],
    ["delay", "2s"],
    ["delay", "-1"],
    ["delay", "%some_papi%"],
    ["sound", "not.a.sound"],
    ["sound", "ui.button.click:loud"],
    ["inventory", "give:minecraft:diamond:5"],
    ["inventory", "give:diamond:1.5"],
    ["inventory", "clear"],
    ["inventory", "take:stone:1"],
    ["economy", "add:1,000"],
    ["economy", "add: 100"],
    ["economy", "add:0"],
    ["economy", "pay:Steve"],
    ["economy", "withdraw:5"],
    ["open", "two words"],
    ["server", "kill @e[type=item]"]
  ];
  for (const [id, line] of broken) {
    it(`${id} "${line}"`, () => expect(levels(id, line)).toContain("error"));
  }
});

describe("lines that work are clean", () => {
  const fine: [ActionId, string][] = [
    ["delay", "1500"],
    ["delay", "$wait"],
    ["sound", "entity.experience_orb.pickup:0.8:1.2"],
    ["sound", "minecraft:entity.player.levelup"],
    ["sound", "ENTITY_EXPERIENCE_ORB_PICKUP"],
    ["sound", "experience_orb.pickup"],
    ["inventory", "give:diamond:3"],
    ["inventory", "check:gold_ingot"],
    ["inventory", "clear:all"],
    ["economy", "pay:$target:$amount"],
    ["economy", "add:12.5"],
    ["economy", "set:0"],
    ["open", "shop_menu"],
    ["server", "give {player} diamond 1"],
    ["title", "Hi::10:60:10"]
  ];
  for (const [id, line] of fine) {
    it(`${id} "${line}"`, () => expect(validateActionLine(id, line, ctx)).toEqual([]));
  }
});

describe("lines that run but not as intended are warnings", () => {
  it("title timings with no subtitle become the subtitle", () => expect(levels("title", "Hi:10:60:10")).toEqual(["warning"]));
  it("uppercase give item gives nothing", () => expect(levels("inventory", "give:DIAMOND:5")).toContain("warning"));
  it("clear:ALL does nothing", () => expect(levels("inventory", "clear:ALL")).toEqual(["warning"]));
  it("a bad pitch falls back to 1", () => expect(levels("sound", "ui.button.click:1:abc")).toEqual(["warning"]));
});

describe("random entries", () => {
  it("accepts the shipped loot roll entry", () => expect(validateRandomEntry("inventory:give:diamond:1", 1, ctx)).toEqual([]));
  it("checks the action inside an entry", () => {
    expect(validateRandomEntry("economy:add:1,000", undefined, ctx).map((p) => p.level)).toEqual(["error"]);
  });
  it("warns that an entry with no type runs as a command", () => {
    expect(validateRandomEntry("hello", undefined, ctx)[0].message).toContain("/hello");
  });
  it("rejects a nested random and a block-form entry", () => {
    expect(validateRandomEntry("random:message:a", undefined, ctx)[0].level).toBe("error");
    expect(validateRandomEntry('message { - "x" }', undefined, ctx)[0].level).toBe("error");
  });
  it("reads weights exactly like the plugin: @0 and @-1 are text, not weights", () => {
    const parsed = parseActionBlock('random {\n  - "message:a@0"\n  - "message:b@2.5"\n  - "message:c@-1"\n}');
    expect(parsed).toEqual({
      kind: "random",
      entries: [{ text: "message:a@0" }, { text: "message:b", weight: 2.5 }, { text: "message:c@-1" }]
    });
    expect(validateRandomEntry("message:a@0", undefined, ctx)[0].level).toBe("warning");
  });
});

describe("blocks", () => {
  it("flags a capitalised action keyword, which the plugin sends as plain text", () => {
    expect(validateBlock('Message {\n  - "hi"\n}', ctx)[0].level).toBe("error");
  });
  it("flags a conditional with no branches", () => {
    expect(validateBlock('conditional {\n  check: "permission:a"\n}', ctx).map((p) => p.level)).toContain("error");
  });
});

describe("line builders produce what the plugin parses", () => {
  it("sound keeps defaults short and round-trips", () => {
    expect(formatSoundLine({ name: "ui.button.click", volume: "1", pitch: "1" })).toBe("ui.button.click");
    expect(parseSoundLine(formatSoundLine({ name: "ui.button.click", volume: "0.5", pitch: "2" }))).toEqual({ name: "ui.button.click", volume: "0.5", pitch: "2" });
    expect(parseSoundLine("minecraft:entity.player.levelup:1:1.2").name).toBe("minecraft:entity.player.levelup");
  });
  it("inventory strips the namespace and lowercases", () => {
    expect(formatInventoryLine({ op: "give", item: "minecraft:DIAMOND", amount: "3" })).toBe("give:diamond:3");
    expect(formatInventoryLine({ op: "clear", item: "", amount: "" })).toBe("clear:all");
  });
  it("title escapes colons in text but not in placeholders, and writes timings correctly", () => {
    const line = formatTitleLine({ title: "Time: 5pm", subtitle: "%server_time:hh%", fadeIn: "10", stay: "60", fadeOut: "10" });
    expect(line).toBe("Time\\: 5pm:%server_time:hh%");
    expect(parseTitleLine(line)).toMatchObject({ title: "Time: 5pm", subtitle: "%server_time:hh%" });
    expect(formatTitleLine({ title: "Hi", subtitle: "", fadeIn: "20", stay: "40", fadeOut: "20" })).toBe("Hi::20:40:20");
  });
});

describe("the plugin's own shipped forms", () => {
  it("raise no errors, so the checks do not cry wolf", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { parseFormDocument } = await import("../../parse/form");
    const { validateForm } = await import("../../core/validateForm");
    const { SOUNDS, ITEMS } = await import("../../data/minecraft");
    const full = { sounds: new Set(SOUNDS), items: new Set(ITEMS) };
    const dir = path.resolve(__dirname, "../fixtures/plugin-forms");
    const errors = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".yml"))
      .flatMap((f) => validateForm(parseFormDocument(fs.readFileSync(path.join(dir, f), "utf8"), f.replace(".yml", "")), full).map((i) => ({ f, ...i })))
      .filter((i) => i.level === "error");
    expect(errors).toEqual([]);
  });
});
