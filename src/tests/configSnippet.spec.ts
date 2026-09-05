import { describe, it, expect } from "vitest";
import { addonRequirements, buildConfigSnippet } from "../serialize/configSnippet";
import { createForm, FormDoc } from "../core/project";
import { BedrockForm } from "../core/types";

describe("buildConfigSnippet", () => {
  it("keys each form by its id and points at its fileName", () => {
    const main = createForm("main_menu");
    const shop = createForm("shop");
    shop.fileName = "store.yml";
    expect(buildConfigSnippet([main, shop])).toBe(
      'forms:\n  main_menu:\n    file: "main_menu.yml"\n  shop:\n    file: "store.yml"\n'
    );
  });

  it("uses the id, not the fileName, as the registry key", () => {
    const form = createForm("shop");
    form.fileName = "totally_different.yml";
    const snippet = buildConfigSnippet([form]);
    expect(snippet).toContain("  shop:\n");
    expect(snippet).toContain('file: "totally_different.yml"');
    expect(snippet).not.toContain("totally_different:");
  });

  it("produces an empty registry for no forms", () => {
    expect(buildConfigSnippet([])).toBe("forms: {}\n");
  });

  it("says nothing about addons — nothing here is pasted into config.yml", () => {
    const form = withOnClick(createForm("shop"), "bw_shop_main:");
    expect(buildConfigSnippet([form])).toBe('forms:\n  shop:\n    file: "shop.yml"\n');
  });
});

/** A form whose single button runs the supplied raw action blocks. */
function withOnClick(form: FormDoc, ...raws: string[]): FormDoc {
  return {
    ...form,
    bedrock: {
      ...form.bedrock,
      type: "SIMPLE",
      buttons: [{ id: "b1", text: "B", onClick: raws.map((raw, i) => ({ id: `a${i}`, params: {}, raw })) }]
    } as BedrockForm
  };
}

function withGlobalActions(form: FormDoc, ...raws: string[]): FormDoc {
  return {
    ...form,
    bedrock: {
      ...form.bedrock,
      globalActions: raws.map((raw, i) => ({ id: `g${i}`, params: {}, raw }))
    } as BedrockForm
  };
}

describe("addonRequirements", () => {
  it("lists nothing for a project that uses only builtin actions", () => {
    const form = withOnClick(createForm("main"), 'message {\n  - "hi"\n}', 'open {\n  - "shop"\n}');
    expect(addonRequirements([form])).toEqual([]);
    expect(addonRequirements([])).toEqual([]);
  });

  it("names the addon and its jar for an action the project writes", () => {
    const form = withOnClick(createForm("main"), "bw_shop_main:");
    const [required, ...rest] = addonRequirements([form]);
    expect(rest).toEqual([]);
    expect(required.addon.name).toBe("Bedwars Addon");
    expect(required.addon.jar).toBe("BedrockGUI-BedwarsAddon.jar");
    expect(required.actionIds).toEqual(["bw_shop_main"]);
  });

  it("reads the payload form and the brace form alike", () => {
    const colon = withOnClick(createForm("a"), "hs_region_menu:12345");
    const brace = withOnClick(createForm("b"), 'hs_region_menu {\n  - "12345"\n}');
    for (const form of [colon, brace]) {
      expect(addonRequirements([form]).map((r) => r.addon.id)).toEqual(["homestead"]);
    }
  });

  it("lists one entry per addon, with its used ids sorted and deduplicated", () => {
    const forms = [
      withOnClick(createForm("a"), "pd_kits:", "bw_stats:"),
      withGlobalActions(withOnClick(createForm("b"), "bw_stats:"), "bw_arena_main:")
    ];
    expect(addonRequirements(forms).map((r) => [r.addon.id, r.actionIds])).toEqual([
      ["bedwars", ["bw_arena_main", "bw_stats"]],
      ["phoenixduels", ["pd_kits"]]
    ]);
  });

  it("finds an addon action nested in a conditional branch", () => {
    const form = withOnClick(
      createForm("a"),
      [
        "conditional {",
        '  check: "permission:some.node"',
        "  true:",
        "    - |",
        "      essentials_hub:",
        "}"
      ].join("\n")
    );
    expect(addonRequirements([form]).map((r) => r.addon.id)).toEqual(["essentials"]);
  });

  it("finds an addon action inside a random entry", () => {
    const form = withOnClick(createForm("a"), 'random {\n  - "bw_stats:@2.0"\n}');
    expect(addonRequirements([form]).map((r) => r.addon.id)).toEqual(["bedwars"]);
  });

  /**
   * `open` resolves against formMenus, so an addon id there never reaches the addon's
   * handler — installing the jar would not help, and validateProject already reports
   * it. Listing the addon would tell the user to install something that cannot fix it.
   */
  it("ignores an addon id misused as an open target", () => {
    const form = withOnClick(createForm("a"), 'open {\n  - "bw_shop_main"\n}');
    expect(addonRequirements([form])).toEqual([]);
  });

  it("ignores an unknown action id that is not an addon's", () => {
    const form = withOnClick(createForm("a"), "my_own_thing:1");
    expect(addonRequirements([form])).toEqual([]);
  });
});
