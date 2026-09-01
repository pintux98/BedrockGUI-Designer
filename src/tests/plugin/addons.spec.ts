import { describe, it, expect } from "vitest";
import { ADDONS, ADDON_FORM_IDS, findAddonForFormId } from "../../plugin/addons";
import { CONDITION_KEYS, IGNORED_KEYS } from "../../plugin/keys";
import { PLUGIN_TARGET } from "../../plugin";

describe("addons", () => {
  it("ships four addons, each with form ids", () => {
    expect(ADDONS).toHaveLength(4);
    for (const addon of ADDONS) expect(addon.formIds.length).toBeGreaterThan(0);
  });

  it("resolves a plain addon form id", () => {
    expect(findAddonForFormId("bw_arena_main")?.id).toBe("bedwars");
    expect(findAddonForFormId("essentials_hub")?.id).toBe("essentials");
  });

  it("resolves a parameterised Homestead id", () => {
    expect(findAddonForFormId("hs_region_menu:12345")?.id).toBe("homestead");
  });

  it("returns undefined for an unknown id", () => {
    expect(findAddonForFormId("my_own_menu")).toBeUndefined();
  });

  it("lists PhoenixDuels ids that work both bare and with a value in ADDON_FORM_IDS", () => {
    expect(ADDON_FORM_IDS.has("pd_duel")).toBe(true);
    expect(ADDON_FORM_IDS.has("pd_stats")).toBe(true);
    expect(ADDON_FORM_IDS.has("pd_leaderboard")).toBe(true);
    expect(ADDON_FORM_IDS.has("pd_kit_preview")).toBe(true);
  });

  it("resolves pd_duel both bare and with a value", () => {
    expect(findAddonForFormId("pd_duel")?.id).toBe("phoenixduels");
    expect(findAddonForFormId("pd_duel:Steve")?.id).toBe("phoenixduels");
  });
});

describe("keys", () => {
  it("marks the phantom keys as ignored by the plugin", () => {
    expect(IGNORED_KEYS).toContain("translations");
    expect(IGNORED_KEYS).toContain("priority");
    expect(IGNORED_KEYS).toContain("priority_condition");
  });

  it("names the condition leaf keys", () => {
    expect(CONDITION_KEYS.condition).toBe("condition");
    expect(CONDITION_KEYS.property).toBe("property");
    expect(CONDITION_KEYS.value).toBe("value");
  });
});

describe("contract", () => {
  it("targets plugin 2.0.11", () => {
    expect(PLUGIN_TARGET).toBe("2.0.11");
  });
});
