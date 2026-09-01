import { describe, it, expect } from "vitest";
import yaml from "js-yaml";
import { parseConfigDocument } from "../parse/config";
import { serializeConfigDocument } from "../serialize/config";
import { parseLegacyInlineConfig } from "../parse/legacy";
import { createEmptyProject, createForm } from "../core/project";

const REAL_CONFIG = `config-version: 1

assets:
  enabled: false
  port: 0
  host: ""

forms:
  main_menu:
    file: "main_menu.yml"
  shop:
    file: "shop.yml"
`;

const SHIPPED_PLUGIN_CONFIG = `config-version: 1

assets:
  enabled: false
  port: 0
  host: ""

forms:
  main_menu:
    file: "main_menu.yml"
  button_images:
    file: "button_images.yml"
  basic_actions:
    file: "basic_actions.yml"
  economy_shop:
    file: "economy_shop.yml"
  player_settings:
    file: "player_settings.yml"
  confirm_reset:
    file: "confirm_reset.yml"
  advanced_flow:
    file: "advanced_flow.yml"
`;

describe("parseConfigDocument", () => {
  it("reads the version, assets and registry", () => {
    const parsed = parseConfigDocument(REAL_CONFIG);
    expect(parsed.configVersion).toBe(1);
    expect(parsed.assets).toEqual({ enabled: false, port: 0, host: "" });
    expect(parsed.registry).toEqual([
      { id: "main_menu", file: "main_menu.yml" },
      { id: "shop", file: "shop.yml" }
    ]);
  });

  it("reads the real shipped plugin config.yml", () => {
    const parsed = parseConfigDocument(SHIPPED_PLUGIN_CONFIG);
    expect(parsed.configVersion).toBe(1);
    expect(parsed.assets).toEqual({ enabled: false, port: 0, host: "" });
    expect(parsed.registry).toEqual([
      { id: "main_menu", file: "main_menu.yml" },
      { id: "button_images", file: "button_images.yml" },
      { id: "basic_actions", file: "basic_actions.yml" },
      { id: "economy_shop", file: "economy_shop.yml" },
      { id: "player_settings", file: "player_settings.yml" },
      { id: "confirm_reset", file: "confirm_reset.yml" },
      { id: "advanced_flow", file: "advanced_flow.yml" }
    ]);
  });
});

describe("serializeConfigDocument", () => {
  it("writes config-version 1 and every form", () => {
    const project = createEmptyProject();
    project.forms.push(createForm("shop"));
    const loaded = yaml.load(serializeConfigDocument(project)) as any;
    expect(loaded["config-version"]).toBe(1);
    expect(loaded.forms.shop.file).toBe("shop.yml");
    expect(loaded.assets).toEqual({ enabled: false, port: 0, host: "" });
  });

  it("never writes configVersion in camel case", () => {
    expect(serializeConfigDocument(createEmptyProject())).not.toContain("configVersion");
  });
});

describe("parseLegacyInlineConfig", () => {
  it("converts a bedrock:-wrapped inline form into a form document", () => {
    const legacy = `forms:
  welcome:
    bedrock:
      type: "SIMPLE"
      title: "Welcome"
      buttons:
        go:
          text: "Go"
`;
    const forms = parseLegacyInlineConfig(legacy);
    expect(forms).toHaveLength(1);
    expect(forms[0].id).toBe("welcome");
    expect(forms[0].fileName).toBe("welcome.yml");
    expect(forms[0].bedrock.title).toBe("Welcome");
  });

  it("converts a flat inline SIMPLE form (no bedrock: wrapper)", () => {
    const legacy = `forms:
  main_hub:
    type: "SIMPLE"
    title: "Main Hub"
    buttons:
      shop:
        text: "Shop"
      settings:
        text: "Settings"
`;
    const forms = parseLegacyInlineConfig(legacy);
    expect(forms).toHaveLength(1);
    expect(forms[0].id).toBe("main_hub");
    expect(forms[0].fileName).toBe("main_hub.yml");
    expect(forms[0].bedrock.title).toBe("Main Hub");
    expect(forms[0].bedrock.type).toBe("SIMPLE");
    const buttons = (forms[0].bedrock as any).buttons;
    expect(buttons.map((b: any) => b.id)).toEqual(["shop", "settings"]);
  });

  it("converts a flat inline CUSTOM form with components", () => {
    const legacy = `forms:
  survey:
    type: "CUSTOM"
    title: "Survey"
    components:
      name:
        type: "input"
        text: "Your name"
`;
    const forms = parseLegacyInlineConfig(legacy);
    expect(forms).toHaveLength(1);
    expect(forms[0].id).toBe("survey");
    expect(forms[0].bedrock.type).toBe("CUSTOM");
    const components = (forms[0].bedrock as any).components;
    expect(components.map((c: any) => c.id)).toEqual(["name"]);
    expect(components[0].type).toBe("input");
  });

  it("captures a sibling java: section on javaRaw without leaking it into the bedrock model", () => {
    const legacy = `forms:
  dual:
    type: "SIMPLE"
    title: "Dual Platform"
    buttons:
      go:
        text: "Go"
    java:
      title: "Java Title"
      slots: 27
`;
    const forms = parseLegacyInlineConfig(legacy);
    expect(forms).toHaveLength(1);
    expect(forms[0].javaRaw).toEqual({ title: "Java Title", slots: 27 });
    expect((forms[0].bedrock as any).java).toBeUndefined();
    expect(Object.keys(forms[0].bedrock)).not.toContain("java");
  });

  it("does not treat a modern file: registry entry as inline", () => {
    const legacy = `forms:
  shop:
    file: "shop.yml"
`;
    const forms = parseLegacyInlineConfig(legacy);
    expect(forms).toHaveLength(0);
  });

  it("returns only the inline entry from a mixed config", () => {
    const legacy = `forms:
  welcome:
    type: "SIMPLE"
    title: "Welcome"
    buttons:
      go:
        text: "Go"
  shop:
    file: "shop.yml"
`;
    const forms = parseLegacyInlineConfig(legacy);
    expect(forms).toHaveLength(1);
    expect(forms[0].id).toBe("welcome");
  });
});
