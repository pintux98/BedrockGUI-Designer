import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { serializeFormDocument } from "../serialize/form";
import { createForm } from "../core/project";
import { parseFormDocument } from "../parse/form";

const fixture = (name: string) =>
  fs.readFileSync(path.resolve(__dirname, "fixtures/plugin-forms", name), "utf8");

describe("serializeFormDocument", () => {
  it("writes content, never description", () => {
    const doc = createForm("welcome");
    doc.bedrock.content = "Hello";
    const text = serializeFormDocument(doc);
    expect(text).toContain("content:");
    expect(text).not.toContain("description:");
  });

  it("never writes a config version into a form file", () => {
    expect(serializeFormDocument(createForm("welcome"))).not.toContain("configVersion");
    expect(serializeFormDocument(createForm("welcome"))).not.toContain("config-version");
  });

  it("writes buttons as a keyed map", () => {
    const text = serializeFormDocument(createForm("welcome"));
    const loaded = yaml.load(text) as any;
    expect(Object.keys(loaded.bedrock.buttons)).toEqual(["button_1"]);
  });

  it("emits action blocks as block scalars", () => {
    const doc = createForm("welcome");
    (doc.bedrock as any).buttons[0].onClick = [
      { id: "raw", params: 'message {\n  - "Hi"\n}', raw: 'message {\n  - "Hi"\n}' }
    ];
    expect(serializeFormDocument(doc)).toContain("- |-");
  });

  it("round-trips a preserved java section", () => {
    const doc = createForm("shop");
    doc.javaRaw = { type: "CHEST", size: "27" };
    const loaded = yaml.load(serializeFormDocument(doc)) as any;
    expect(loaded.java).toEqual({ type: "CHEST", size: "27" });
  });

  it("emits a single component action as a bare block scalar string, not a list", () => {
    const source = fixture("player_settings.yml");
    const doc = parseFormDocument(source, "player_settings");
    const output = serializeFormDocument(doc);

    const sourceLoaded = yaml.load(source) as any;
    const outputLoaded = yaml.load(output) as any;

    for (const key of Object.keys(sourceLoaded.bedrock.components)) {
      const sourceAction = sourceLoaded.bedrock.components[key].action;
      const outputAction = outputLoaded.bedrock.components[key].action;
      expect(typeof outputAction).toBe("string");
      expect(outputAction).toBe(sourceAction.trim());
    }
  });

  it("keeps a component action list intact when a component holds two actions", () => {
    const doc = createForm("settings");
    doc.bedrock = {
      type: "CUSTOM",
      title: "Settings",
      components: [
        {
          id: "nickname",
          type: "input",
          props: { text: "Name" },
          action: [
            { id: "raw", params: 'message {\n  - "One"\n}', raw: 'message {\n  - "One"\n}' },
            { id: "raw", params: 'sound {\n  - "click"\n}', raw: 'sound {\n  - "click"\n}' }
          ]
        }
      ]
    };
    const loaded = yaml.load(serializeFormDocument(doc)) as any;
    expect(Array.isArray(loaded.bedrock.components.nickname.action)).toBe(true);
    expect(loaded.bedrock.components.nickname.action).toHaveLength(2);
  });

  it("keeps a button's onClick as a list", () => {
    const source = fixture("main_menu.yml");
    const doc = parseFormDocument(source, "main_menu");
    const output = serializeFormDocument(doc);
    const loaded = yaml.load(output) as any;
    const firstButtonKey = Object.keys(loaded.bedrock.buttons)[0];
    expect(Array.isArray(loaded.bedrock.buttons[firstButtonKey].onClick)).toBe(true);
  });
});
