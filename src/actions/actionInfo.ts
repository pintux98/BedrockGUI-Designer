import { ACTIONS, ActionId } from "../plugin/actions";
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
  if (kind === "conditional") return { kind: "conditional", check: "", whenTrue: [], whenFalse: [] };
  if (kind === "random") return { kind: "random", entries: [{ text: "" }] };
  if (kind === "bungee") return { kind: "bungee", subchannel: "Connect", args: [""] };
  return { kind: "lines", id: kind, lines: [""] };
}
