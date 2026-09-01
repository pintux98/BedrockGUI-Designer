export interface AddonDef {
  id: string;
  name: string;
  jar: string;
  minPluginVersion: string;
  formIds: readonly string[];
  parameterised?: readonly string[];
}

export const ADDONS: readonly AddonDef[] = [
  {
    id: "essentials",
    name: "Essentials Addon",
    jar: "BedrockGUI-EssentialsAddon.jar",
    minPluginVersion: "2.0.8",
    formIds: [
      "essentials_hub", "essentials_warp_main", "essentials_kit_main",
      "home_main", "public_home_main", "tpa_main", "essentials_pet_main"
    ]
  },
  {
    id: "bedwars",
    name: "Bedwars Addon",
    jar: "BedrockGUI-BedwarsAddon.jar",
    minPluginVersion: "2.0.8",
    formIds: [
      "bw_shop_main", "bw_shop_cat", "bw_shop_buy",
      "bw_upgrade_main", "bw_upgrade_buy",
      "bw_arena_main", "bw_arena_join", "bw_stats",
      "bw_spec_main", "bw_spec_tp",
      "bw_party_main", "bw_party_add", "bw_party_kick", "bw_party_leave", "bw_party_disband"
    ],
    parameterised: ["bw_party_kickdo"]
  },
  {
    id: "homestead",
    name: "Homestead Addon",
    jar: "BedrockGUI-HomesteadAddon.jar",
    minPluginVersion: "2.0.8",
    formIds: ["hs_regions", "hs_welcome", "hs_top"],
    parameterised: [
      "hs_region_menu", "hs_region_info",
      "hs_players", "hs_player_info",
      "hs_flags", "hs_member_flags", "hs_control_flags",
      "hs_subareas", "hs_subarea_menu", "hs_subarea_members", "hs_subarea_member",
      "hs_subarea_flags", "hs_subarea_member_flags",
      "hs_levels", "hs_rewards", "hs_logs", "hs_misc", "hs_rate",
      "hs_chunks", "hs_map_color", "hs_map_icon", "hs_weather_time"
    ]
  },
  {
    id: "phoenixduels",
    name: "PhoenixDuels Addon",
    jar: "BedrockGUI-PhoenixDuelsAddon.jar",
    minPluginVersion: "2.0.8",
    formIds: [
      "pd_queue", "pd_queue_sizes",
      "pd_duel_targets", "pd_lost_items",
      "pd_party", "pd_party_info", "pd_party_invite", "pd_party_ffa",
      "pd_party_teamfight", "pd_party_multiteam", "pd_party_challenge",
      "pd_settings", "pd_matches", "pd_kits"
    ],
    parameterised: [
      "pd_queue_modes", "pd_queue_join", "pd_duel", "pd_party_member",
      "pd_stats", "pd_leaderboard", "pd_spectate", "pd_kit_preview"
    ]
  }
];

export const ADDON_FORM_IDS: ReadonlySet<string> = new Set(ADDONS.flatMap((a) => a.formIds));

export function findAddonForFormId(id: string): AddonDef | undefined {
  const base = id.includes(":") ? id.slice(0, id.indexOf(":")) : id;
  return ADDONS.find((a) => a.formIds.includes(id) || (a.parameterised ?? []).includes(base));
}
