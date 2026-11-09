import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseFormDocument } from "../parse/form";
import { serializeFormDocument } from "../serialize/form";

const fixture = (name: string) =>
  fs.readFileSync(path.resolve(__dirname, "fixtures/plugin-forms", name), "utf8");

describe("parseFormDocument", () => {
  it("parses a SIMPLE form with keyed buttons", () => {
    const doc = parseFormDocument(fixture("main_menu.yml"), "main_menu");
    expect(doc.bedrock.type).toBe("SIMPLE");
    expect(doc.bedrock.title).toContain("BedrockGUI Demo");
    const buttons = (doc.bedrock as any).buttons;
    expect(buttons.map((b: any) => b.id)).toContain("economy_shop");
    expect(buttons[0].onClick[0].raw).toContain("open {");
  });

  it("keeps a multi-line content block", () => {
    const doc = parseFormDocument(fixture("main_menu.yml"), "main_menu");
    expect(String(doc.bedrock.content)).toContain("guided tour");
  });

  it("parses CUSTOM components with their props and action", () => {
    const doc = parseFormDocument(fixture("player_settings.yml"), "player_settings");
    expect(doc.bedrock.type).toBe("CUSTOM");
    const components = (doc.bedrock as any).components;
    const slider = components.find((c: any) => c.id === "render_distance");
    expect(slider.type).toBe("slider");
    expect(slider.props.min).toBe(2);
    expect(slider.props.max).toBe(32);
    expect(slider.action[0].raw).toContain("message {");
  });

  it("parses a MODAL with exactly two buttons", () => {
    const doc = parseFormDocument(fixture("confirm_reset.yml"), "confirm_reset");
    expect(doc.bedrock.type).toBe("MODAL");
    expect((doc.bedrock as any).buttons).toHaveLength(2);
  });

  it("keeps show_condition and alternative text", () => {
    const doc = parseFormDocument(fixture("economy_shop.yml"), "economy_shop");
    const admin = (doc.bedrock as any).buttons.find((b: any) => b.id === "admin_restock");
    expect(admin.showCondition).toBe("permission:bedrockgui.admin");
    expect(admin.alternativeText).toContain("requires bedrockgui.admin");
  });

  it("drops a leftover java section, which the plugin no longer reads", () => {
    const doc = parseFormDocument('bedrock:\n  type: "SIMPLE"\njava:\n  type: "CHEST"\n', "shop");
    expect(Object.keys(doc)).not.toContain("javaRaw");
    expect(serializeFormDocument(doc)).not.toContain("java:");
  });
});

/**
 * The read side of the same gap. See src/tests/plugin/keys.spec.ts for the Java
 * line citations; these assertions feed the parser literal YAML so a renamed
 * constant in src/plugin/keys.ts fails here instead of round-tripping quietly.
 */
describe("parseFormDocument accepts the keys no fixture exercises", () => {
  it("takes the form body from the top-level `bedrock:` key", () => {
    const doc = parseFormDocument(
      ["bedrock:", "  type: SIMPLE", "  title: Wrapped", "  buttons:", "    b1:", "      text: Go"].join("\n"),
      "wrapped"
    );
    expect(doc.bedrock.title).toBe("Wrapped");
    expect((doc.bedrock as any).buttons[0].id).toBe("b1");
  });

  it("reads the form permission from `permission`", () => {
    const doc = parseFormDocument(
      ["bedrock:", "  title: Gated", "  permission: bedrockgui.menu.gated"].join("\n"),
      "gated"
    );
    expect(doc.bedrock.permission).toBe("bedrockgui.menu.gated");
  });

  it("falls back to the legacy `description` key when a file has no `content`", () => {
    const doc = parseFormDocument(
      ["bedrock:", "  title: Old", "  description: Written before content existed"].join("\n"),
      "old"
    );
    expect(doc.bedrock.content).toBe("Written before content existed");
  });

  it("prefers `content` over `description` when a file carries both, as the plugin does", () => {
    const doc = parseFormDocument(
      ["bedrock:", "  title: Both", "  content: Current", "  description: Legacy"].join("\n"),
      "both"
    );
    expect(doc.bedrock.content).toBe("Current");
  });

  it("reads a button's alternative click actions from `alternative_onClick`", () => {
    const doc = parseFormDocument(
      [
        "bedrock:",
        "  title: Gated",
        "  buttons:",
        "    admin:",
        "      text: Admin",
        "      show_condition: permission:bedrockgui.admin",
        "      alternative_text: Locked",
        "      alternative_image: textures/ui/lock",
        '      alternative_onClick: message { - "no" }'
      ].join("\n"),
      "gated"
    );
    const button = (doc.bedrock as any).buttons[0];
    expect(button.alternativeOnClick).toBe('message { - "no" }');
    expect(button.showCondition).toBe("permission:bedrockgui.admin");
    expect(button.alternativeText).toBe("Locked");
    expect(button.alternativeImage).toBe("textures/ui/lock");
  });
});

describe("2.0.12 keys", () => {
  it("reads pay_player.yml's open gate, cooldown, on_close and new components", () => {
    const form = parseFormDocument(fixture("pay_player.yml"), "pay_player").bedrock;
    expect(form.openCondition).toBe("plugin:Vault");
    expect(form.openConditionMessage).toContain("Vault");
    expect(form.cooldown).toBe("3s");
    expect(form.onClose?.[0].raw).toContain('"main_menu"');
    if (form.type !== "CUSTOM") throw new Error("expected CUSTOM");
    expect(form.components.map((c) => c.type)).toEqual(["label", "dropdown", "step_slider"]);
    expect(form.components[2].props.steps).toEqual(["10", "50", "100", "500", "1000"]);
  });

  it("reads a button cooldown and a numeric cooldown", () => {
    const form = parseFormDocument(
      'bedrock:\n  type: "SIMPLE"\n  cooldown: 5\n  buttons:\n    a:\n      text: "A"\n      cooldown: "2s"\n',
      "x"
    ).bedrock;
    expect(form.cooldown).toBe("5");
    if (form.type !== "SIMPLE") throw new Error("expected SIMPLE");
    expect(form.buttons[0].cooldown).toBe("2s");
  });

  it("falls back to an empty title like the plugin", () => {
    expect(parseFormDocument('bedrock:\n  type: "CUSTOM"\n', "x").bedrock.title).toBe("");
  });
});
