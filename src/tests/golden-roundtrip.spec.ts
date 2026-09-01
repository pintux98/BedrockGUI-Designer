import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import { parseFormDocument } from "../parse/form";
import { serializeFormDocument } from "../serialize/form";

const dir = path.resolve(__dirname, "fixtures/plugin-forms");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yml"));

function normalizeActions(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map((v) => String(v).trim());
}

function normalizeEntry(entry: any, actionKey: "onClick" | "action") {
  if (!entry) return entry;
  const { [actionKey]: actionValue, ...rest } = entry;
  return { ...rest, [actionKey]: normalizeActions(actionValue) };
}

describe("golden round-trip against the shipped plugin forms", () => {
  it("has all seven fixtures", () => {
    expect(files).toHaveLength(7);
  });

  for (const file of files) {
    const id = file.replace(/\.yml$/, "");

    it(`${file} survives parse then serialize`, () => {
      const original = fs.readFileSync(path.join(dir, file), "utf8");
      const once = serializeFormDocument(parseFormDocument(original, id));
      const twice = serializeFormDocument(parseFormDocument(once, id));
      expect(twice).toBe(once);
    });

    it(`${file} keeps its semantic content`, () => {
      const original = fs.readFileSync(path.join(dir, file), "utf8");
      const before = yaml.load(original) as any;
      const after = yaml.load(serializeFormDocument(parseFormDocument(original, id))) as any;

      expect(after.bedrock.type ?? "SIMPLE").toBe(before.bedrock.type ?? "SIMPLE");
      expect(after.bedrock.title).toBe(before.bedrock.title);
      expect(after.bedrock.command).toBe(before.bedrock.command);
      expect(after.bedrock.command_intercept).toBe(before.bedrock.command_intercept);
      expect(after.bedrock.permission).toBe(before.bedrock.permission);

      const beforeContent = before.bedrock.content ?? before.bedrock.description;
      if (beforeContent !== undefined) {
        const flat = (v: unknown) => (Array.isArray(v) ? v.join("\n") : v);
        expect(flat(after.bedrock.content)).toBe(flat(beforeContent));
      }

      const beforeButtons = before.bedrock.buttons ?? {};
      const afterButtons = after.bedrock.buttons ?? {};
      expect(Object.keys(afterButtons)).toEqual(Object.keys(beforeButtons));
      for (const buttonId of Object.keys(beforeButtons)) {
        expect(normalizeEntry(afterButtons[buttonId], "onClick")).toEqual(
          normalizeEntry(beforeButtons[buttonId], "onClick")
        );
      }

      const beforeComponents = before.bedrock.components ?? {};
      const afterComponents = after.bedrock.components ?? {};
      expect(Object.keys(afterComponents)).toEqual(Object.keys(beforeComponents));
      for (const componentId of Object.keys(beforeComponents)) {
        expect(normalizeEntry(afterComponents[componentId], "action")).toEqual(
          normalizeEntry(beforeComponents[componentId], "action")
        );
      }

      if (before.java) expect(after.java).toEqual(before.java);
    });

    it(`${file} emits none of the keys the plugin ignores`, () => {
      const original = fs.readFileSync(path.join(dir, file), "utf8");
      const text = serializeFormDocument(parseFormDocument(original, id));
      expect(text).not.toContain("translations");
      expect(text).not.toContain("priority_condition");
      expect(text).not.toContain("configVersion");
      expect(text).not.toContain("description:");
    });
  }

  it("player_settings.yml serializes single component actions as bare block scalars, not lists", () => {
    const file = "player_settings.yml";
    const id = file.replace(/\.yml$/, "");
    const original = fs.readFileSync(path.join(dir, file), "utf8");
    const after = yaml.load(serializeFormDocument(parseFormDocument(original, id))) as any;

    const components = after.bedrock.components;
    for (const name of ["nickname", "render_distance", "language", "notifications"]) {
      expect(Array.isArray(components[name].action)).toBe(false);
      expect(typeof components[name].action).toBe("string");
    }
  });
});
