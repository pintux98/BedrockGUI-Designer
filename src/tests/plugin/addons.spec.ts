import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  ADDONS,
  ADDON_ACTION_IDS,
  addonActionTakesArgument,
  findAddonForActionId
} from "../../plugin/addons";
import { CONDITION_KEYS, IGNORED_KEYS } from "../../plugin/keys";
import { PLUGIN_TARGET } from "../../plugin";

const BY_ID = Object.fromEntries(ADDONS.map((a) => [a.id, a]));

describe("addons", () => {
  it("ships four addons, each with action ids", () => {
    expect(ADDONS).toHaveLength(4);
    for (const addon of ADDONS) expect(addon.actionIds.length).toBeGreaterThan(0);
  });

  it("models addon ids as action types, not as open targets", () => {
    // Addons call registerActionHandler; `open` resolves against formMenus, which is
    // built only from config.getKeys("forms"). An id here is written as its own
    // action block. The doc comment must keep saying so.
    const source = fs.readFileSync(path.resolve(__dirname, "../../plugin/addons.ts"), "utf8");
    expect(source).toMatch(/registerActionHandler/);
    expect(source).toMatch(/never as an `open` target/);
    expect(source).not.toMatch(/\bformIds\b/);
  });

  it("carries no minimum plugin version", () => {
    // Every addon plugin.yml declares an unversioned `depend: - BedrockGUI` and no
    // addon has a runtime version check, so there is nothing to claim.
    for (const addon of ADDONS) {
      expect(addon).not.toHaveProperty("minPluginVersion");
    }
  });

  it("pins each addon's registered action count", () => {
    expect(BY_ID.essentials.actionIds).toHaveLength(39);
    expect(BY_ID.bedwars.actionIds).toHaveLength(16);
    expect(BY_ID.homestead.actionIds).toHaveLength(25);
    expect(BY_ID.phoenixduels.actionIds).toHaveLength(22);
  });

  it("lists every Essentials action type getActionType() returns", () => {
    // Verified one by one against essentials-addon/.../action/*.java.
    expect([...BY_ID.essentials.actionIds].sort()).toEqual(
      [
        "economyshop_item", "economyshop_main", "economyshop_shop", "economyshop_transaction",
        "essentials_hub", "essentials_hub_home", "essentials_hub_kit", "essentials_hub_tpa",
        "essentials_hub_warp", "essentials_kit_claim", "essentials_kit_main",
        "essentials_pet_buy", "essentials_pet_call", "essentials_pet_hub", "essentials_pet_info",
        "essentials_pet_main", "essentials_pet_sendaway", "essentials_pet_shop",
        "essentials_pet_skilltree_menu", "essentials_pet_skilltree_set",
        "essentials_warp_main", "essentials_warp_teleport",
        "home_delete", "home_delete_confirm", "home_main", "home_make_private",
        "home_make_public", "home_manage", "home_manage_main", "home_rename", "home_set",
        "home_teleport", "public_home_main", "public_home_teleport",
        "shopgui_item", "shopgui_main", "shopgui_shop", "shopgui_transaction", "tpa_main"
      ].sort()
    );
  });

  it("never registers the same id in two addons", () => {
    const seen = new Map<string, string>();
    for (const addon of ADDONS) {
      for (const id of addon.actionIds) {
        expect(seen.get(id), `${id} is claimed by both ${seen.get(id)} and ${addon.id}`)
          .toBeUndefined();
        seen.set(id, addon.id);
      }
    }
    expect(seen.size).toBe(39 + 16 + 25 + 22);
    expect(ADDON_ACTION_IDS.size).toBe(seen.size);
  });

  it("keeps every parameterised id inside its own actionIds", () => {
    for (const addon of ADDONS) {
      for (const id of addon.parameterised ?? []) {
        expect(addon.actionIds, `${addon.id}: ${id}`).toContain(id);
      }
    }
  });

  it("resolves an addon action id that takes no payload", () => {
    expect(findAddonForActionId("bw_arena_main")?.id).toBe("bedwars");
    expect(findAddonForActionId("essentials_hub")?.id).toBe("essentials");
    expect(addonActionTakesArgument("essentials_hub")).toBe(false);
  });

  it("resolves a parameterised id bare and with a payload", () => {
    expect(findAddonForActionId("hs_region_menu")?.id).toBe("homestead");
    expect(findAddonForActionId("hs_region_menu:12345")?.id).toBe("homestead");
    expect(addonActionTakesArgument("hs_region_menu:12345")).toBe(true);
  });

  it("returns undefined for an unknown id", () => {
    expect(findAddonForActionId("my_own_menu")).toBeUndefined();
    expect(addonActionTakesArgument("my_own_menu")).toBe(false);
  });

  it("holds the parameterised ids in ADDON_ACTION_IDS too", () => {
    // The old set held only the non-parameterised ids, so a perfectly valid
    // addon action read as unknown. ADDON_ACTION_IDS is now the complete registry.
    for (const id of ["pd_spectate", "pd_queue_join", "bw_party_kickdo", "shopgui_transaction"]) {
      expect(ADDON_ACTION_IDS.has(id), id).toBe(true);
    }
  });

  it("marks the ids whose handler reads actionValue", () => {
    // Required payloads.
    expect(addonActionTakesArgument("home_teleport")).toBe(true);
    expect(addonActionTakesArgument("shopgui_transaction")).toBe(true);
    expect(addonActionTakesArgument("bw_shop_cat")).toBe(true);
    // Optional payloads still count: the handler reads actionValue.
    expect(addonActionTakesArgument("home_main")).toBe(true);
    expect(addonActionTakesArgument("hs_top")).toBe(true);
    expect(addonActionTakesArgument("pd_party_info")).toBe(true);
    // Handlers that ignore actionValue entirely.
    expect(addonActionTakesArgument("home_set")).toBe(false);
    expect(addonActionTakesArgument("hs_welcome")).toBe(false);
    expect(addonActionTakesArgument("pd_kits")).toBe(false);
    expect(addonActionTakesArgument("bw_stats")).toBe(false);
  });

  it("counts the parameterised subset per addon", () => {
    expect(BY_ID.essentials.parameterised).toHaveLength(23);
    expect(BY_ID.bedwars.parameterised).toHaveLength(6);
    expect(BY_ID.homestead.parameterised).toHaveLength(24);
    expect(BY_ID.phoenixduels.parameterised).toHaveLength(12);
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
