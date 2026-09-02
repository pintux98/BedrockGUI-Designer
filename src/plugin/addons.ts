/**
 * The action types the four BedrockGUI addons register.
 *
 * **These are action types, not menu names.** An addon registers them through
 * `BedrockGUIApi.registerActionHandler` (FormMenuUtil.java:1163), which puts them
 * in the action registry — the same registry that holds `command`, `message` and
 * the rest of the 14 builtins. They never become forms.
 *
 *   bedwars-addon/.../BedrockBedwarsAddonPlugin.java:207
 *     api.registerActionHandler(new OpenShopMainAction(bedrockShopService));
 *   bedwars-addon/.../action/OpenShopMainAction.java:14
 *     @Override public String getActionType() { return "bw_shop_main"; }
 *
 * So an id here is written as its own action block — `bw_shop_main { }`, or with a
 * payload as `bw_shop_main:<args>` — and **never as an `open` target**. `open`
 * resolves against `FormMenuUtil.hasMenu` (FormMenuUtil.java:1156-1161), which only
 * looks in `formMenus`; `formMenus` is populated exclusively from
 * `config.getKeys("forms")` in `loadFormMenus` (FormMenuUtil.java:116-132). An addon
 * action id is never a key under `forms:`, so `open { - "bw_shop_main" }` fails with
 * ACTION_FORM_NOT_FOUND (OpenFormActionHandler.java:106-111) **even with the addon
 * installed**. The addons' own config.yml says the same thing:
 *   "Register the bw_* action handlers so any form (including your own) can open
 *    Bedwars screens / run Bedwars actions."   (bedwars-addon/src/main/resources/config.yml:11-12)
 *   "register-actions: register the action handlers so any form can drive Essentials."
 *                                              (essentials-addon/src/main/resources/config.yml:79)
 *
 * `actionIds` is the complete registered set per addon, verified by reading every
 * `getActionType()` return value in the addon source. `parameterised` is the subset
 * whose `execute` reads the `actionValue` payload — for some of those the payload is
 * optional (a page number, a sort key), so "takes a value", not "requires one".
 *
 * There is deliberately no minimum-plugin-version field: every addon's plugin.yml
 * declares an unversioned `depend: - BedrockGUI` and no addon carries a runtime
 * version check, so there is nothing to report.
 */
export interface AddonDef {
  id: string;
  name: string;
  jar: string;
  /** Every action type the addon registers via `registerActionHandler`. */
  actionIds: readonly string[];
  /** The subset of `actionIds` whose handler reads the `:value` payload. */
  parameterised?: readonly string[];
}

export const ADDONS: readonly AddonDef[] = [
  {
    id: "essentials",
    name: "Essentials Addon",
    jar: "BedrockGUI-EssentialsAddon.jar",
    // 39 handlers, one class each, under
    // essentials-addon/src/main/java/it/pintux/life/essentialsaddon/action/.
    actionIds: [
      "economyshop_item", "economyshop_main", "economyshop_shop", "economyshop_transaction",
      "essentials_hub", "essentials_hub_home", "essentials_hub_kit", "essentials_hub_tpa",
      "essentials_hub_warp", "essentials_kit_claim", "essentials_kit_main",
      "essentials_pet_buy", "essentials_pet_call", "essentials_pet_hub", "essentials_pet_info",
      "essentials_pet_main", "essentials_pet_sendaway", "essentials_pet_shop",
      "essentials_pet_skilltree_menu", "essentials_pet_skilltree_set",
      "essentials_warp_main", "essentials_warp_teleport",
      "home_delete", "home_delete_confirm", "home_main", "home_make_private", "home_make_public",
      "home_manage", "home_manage_main", "home_rename", "home_set", "home_teleport",
      "public_home_main", "public_home_teleport",
      "shopgui_item", "shopgui_main", "shopgui_shop", "shopgui_transaction",
      "tpa_main"
    ],
    parameterised: [
      // Required payloads: a home/warp/kit name, a pet uuid, a pipe-joined shop tuple.
      "economyshop_item", "economyshop_shop", "economyshop_transaction",
      "essentials_kit_claim", "essentials_pet_buy", "essentials_pet_call",
      "essentials_pet_info", "essentials_pet_sendaway", "essentials_pet_skilltree_set",
      "essentials_warp_teleport", "home_delete_confirm", "home_make_private",
      "home_make_public", "home_manage", "home_rename", "home_teleport",
      "public_home_teleport", "shopgui_item", "shopgui_shop", "shopgui_transaction",
      // Optional payloads: a page number (home_main / public_home_main) or a shop
      // name (essentials_pet_shop). The handler still reads actionValue.
      "essentials_pet_shop", "home_main", "public_home_main"
    ]
  },
  {
    id: "bedwars",
    name: "Bedwars Addon",
    jar: "BedrockGUI-BedwarsAddon.jar",
    // 16 handlers, registered in BedrockBedwarsAddonPlugin.java:207-232.
    // The same block also registers five NoOpAction close handlers
    // (bw_shop_close, bw_upgrade_close, bw_arena_close, bw_spec_close,
    // bw_party_close — BedrockBedwarsAddonPlugin.java:234-238). They exist only so
    // the bundled GUI's close buttons resolve instead of logging "invalid action
    // type" and do nothing at all, so they are not offered here.
    actionIds: [
      "bw_arena_join", "bw_arena_main",
      "bw_party_add", "bw_party_disband", "bw_party_kick", "bw_party_kickdo",
      "bw_party_leave", "bw_party_main",
      "bw_shop_buy", "bw_shop_cat", "bw_shop_main",
      "bw_spec_main", "bw_spec_tp",
      "bw_stats",
      "bw_upgrade_buy", "bw_upgrade_main"
    ],
    parameterised: [
      "bw_arena_join", "bw_party_kickdo", "bw_shop_buy", "bw_shop_cat",
      "bw_spec_tp", "bw_upgrade_buy"
    ]
  },
  {
    id: "homestead",
    name: "Homestead Addon",
    jar: "BedrockGUI-HomesteadAddon.jar",
    // 25 handlers, registered from one table in
    // HomesteadAddonPlugin.registerActions (HomesteadAddonPlugin.java:97-155).
    actionIds: [
      "hs_chunks", "hs_control_flags", "hs_flags", "hs_levels", "hs_logs",
      "hs_map_color", "hs_map_icon", "hs_member_flags", "hs_misc",
      "hs_player_info", "hs_players", "hs_rate", "hs_region_info", "hs_region_menu",
      "hs_regions", "hs_rewards", "hs_subarea_flags", "hs_subarea_member",
      "hs_subarea_member_flags", "hs_subarea_members", "hs_subarea_menu", "hs_subareas",
      "hs_top", "hs_weather_time", "hs_welcome"
    ],
    // Every id but hs_welcome reads the payload: a region id for most,
    // an optional page for hs_regions, an optional sort key for hs_top.
    parameterised: [
      "hs_chunks", "hs_control_flags", "hs_flags", "hs_levels", "hs_logs",
      "hs_map_color", "hs_map_icon", "hs_member_flags", "hs_misc",
      "hs_player_info", "hs_players", "hs_rate", "hs_region_info", "hs_region_menu",
      "hs_regions", "hs_rewards", "hs_subarea_flags", "hs_subarea_member",
      "hs_subarea_member_flags", "hs_subarea_members", "hs_subarea_menu", "hs_subareas",
      "hs_top", "hs_weather_time"
    ]
  },
  {
    id: "phoenixduels",
    name: "PhoenixDuels Addon",
    jar: "BedrockGUI-PhoenixDuelsAddon.jar",
    // 22 handlers, registered from one table in
    // DuelsAddonPlugin.registerActions (DuelsAddonPlugin.java:143-198).
    actionIds: [
      "pd_duel", "pd_duel_targets", "pd_kit_preview", "pd_kits", "pd_leaderboard",
      "pd_lost_items", "pd_matches",
      "pd_party", "pd_party_challenge", "pd_party_ffa", "pd_party_info",
      "pd_party_invite", "pd_party_member", "pd_party_multiteam", "pd_party_teamfight",
      "pd_queue", "pd_queue_join", "pd_queue_modes", "pd_queue_sizes",
      "pd_settings", "pd_spectate", "pd_stats"
    ],
    parameterised: [
      "pd_duel", "pd_kit_preview", "pd_leaderboard", "pd_matches",
      "pd_party_challenge", "pd_party_info", "pd_party_member",
      "pd_queue_join", "pd_queue_modes", "pd_queue_sizes", "pd_spectate", "pd_stats"
    ]
  }
];

/** Every action type any installed addon can register. */
export const ADDON_ACTION_IDS: ReadonlySet<string> = new Set(ADDONS.flatMap((a) => a.actionIds));

/** The addon that registers `id`, which may carry a `:value` payload. */
export function findAddonForActionId(id: string): AddonDef | undefined {
  const base = baseId(id);
  return ADDONS.find((a) => a.actionIds.includes(base));
}

/**
 * Whether `id` names an addon action whose handler reads its `:value` payload.
 * False for an unknown id and for an addon action that ignores the payload.
 */
export function addonActionTakesArgument(id: string): boolean {
  const base = baseId(id);
  return ADDONS.some((a) => (a.parameterised ?? []).includes(base));
}

function baseId(id: string): string {
  const trimmed = id.trim();
  const colon = trimmed.indexOf(":");
  return colon > 0 ? trimmed.slice(0, colon) : trimmed;
}
