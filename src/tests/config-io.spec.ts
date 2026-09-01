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
  it("converts inline forms into form documents", () => {
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
});
