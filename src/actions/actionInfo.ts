import { ACTIONS, ActionId } from "../plugin/actions";
import { ADDON_ACTION_IDS, addonActionSnippet } from "../plugin/addons";
import { ParsedAction } from "../plugin/grammar";

export type ActionKind = ActionId | "raw";

export const RAW_ACTION_INFO = {
  label: "Raw",
  icon: "📝",
  color: "border-gray-500",
  description: "Write raw action block YAML. Use for advanced configurations.",
  placeholder: "type {\n  - line1\n  - line2\n}",
  formatExample: 'message {\n  - "&aHello!"\n}'
};

export function infoForAction(action: ParsedAction) {
  if (action.kind === "raw") return RAW_ACTION_INFO;
  if (action.kind === "lines") return ACTIONS[action.id];
  return ACTIONS[action.kind];
}

export function createDefaultAction(kind: ActionKind): ParsedAction {
  if (kind === "raw") return { kind: "raw", text: "" };
  /**
   * An addon action is not one of the 14 the grammar structures — `isActionId` is
   * false for it, so `parseActionBlock` keeps it raw — and it must not become a
   * `lines` block either: `infoForAction` would look it up in `ACTIONS`, find nothing,
   * and `ActionBlock` would render `undefined.color`. It goes in as the raw colon form
   * the addon's own handler documents, which is also how it comes back on reload.
   */
  if (ADDON_ACTION_IDS.has(kind)) return { kind: "raw", text: addonActionSnippet(kind) };
  if (kind === "conditional") return { kind: "conditional", check: "", whenTrue: [], whenFalse: [] };
  if (kind === "random") return { kind: "random", entries: [{ text: "" }] };
  if (kind === "bungee") return { kind: "bungee", subchannel: "Connect", args: [""] };
  return { kind: "lines", id: kind, lines: [""] };
}
