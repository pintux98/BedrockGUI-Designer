import { ActionCapability, PlatformTarget, capabilityNote, hasCapability } from "./platforms";

export type ActionId =
  | "command" | "open" | "message" | "delay"
  | "server" | "broadcast" | "inventory"
  | "sound" | "economy"
  | "title" | "actionbar"
  | "conditional" | "random" | "bungee";

export type ActionBodyShape = "lines" | "conditional" | "random";

export interface ActionDef {
  id: ActionId;
  label: string;
  capability: ActionCapability;
  body: ActionBodyShape;
  icon: string;
  color: string;
  description: string;
  placeholder: string;
  formatExample: string;
}

export const ACTIONS: Record<ActionId, ActionDef> = {
  command: {
    id: "command",
    label: "Player Command",
    capability: "always",
    body: "lines",
    icon: "⌨️",
    color: "border-blue-500",
    description: "Execute a command as the player (uses player permissions).",
    placeholder: "e.g. spawn, home, warp shops",
    formatExample: 'command {\n  - "spawn"\n  - "warp {player} shops"\n}'
  },
  open: {
    id: "open",
    label: "Open Form",
    capability: "always",
    body: "lines",
    icon: "📋",
    color: "border-cyan-500",
    description: "Open another BedrockGUI form for the player.",
    placeholder: "e.g. my_other_menu",
    // Both values must be valid, registered menu names for this to open a chain.
    // "warp_menu {player}" held a space, so it was never a menu name: the plugin
    // would have passed it to shop_menu as an argument, leaving the example
    // looking like a chain while actually documenting the argument case.
    formatExample: 'open {\n  - "shop_menu"\n  - "warp_menu"\n}'
  },
  message: {
    id: "message",
    label: "Message",
    capability: "always",
    body: "lines",
    icon: "💬",
    color: "border-brand-accent",
    description: "Send a chat message to the player. Supports &color codes, &#hex, and MiniMessage.",
    placeholder: 'e.g. &aHello, {player}!',
    formatExample: 'message {\n  - "&aHello, {player}!"\n  - "&7Your balance: &a$1000"\n}'
  },
  delay: {
    id: "delay",
    label: "Delay",
    capability: "always",
    body: "lines",
    icon: "⏱️",
    color: "border-gray-400",
    description: "Wait before executing next actions. Max 30000ms.",
    // Milliseconds, as a bare integer. DelayActionHandler.java:129 is
    // `Long.parseLong(delayValue)` on the raw value — "1s" and "500ms" throw
    // NumberFormatException and fail the action, and "20" is 20ms, not 20 ticks.
    placeholder: "e.g. 1000 (milliseconds, max 30000)",
    formatExample: 'delay {\n  - "1000"\n}'
  },
  server: {
    id: "server",
    label: "Server Command",
    capability: "commandExecutor",
    body: "lines",
    icon: "🖥️",
    color: "border-purple-500",
    description: "Execute a command from the console (OP level).",
    placeholder: "e.g. give {player} diamond 1",
    formatExample: 'server {\n  - "give {player} diamond 1"\n  - "say Hello everyone!"\n}'
  },
  broadcast: {
    id: "broadcast",
    label: "Broadcast",
    capability: "commandExecutor",
    body: "lines",
    icon: "📢",
    color: "border-yellow-500",
    description: "Send a message to all players on the server.",
    placeholder: "e.g. &6Server restarting in 5 minutes!",
    formatExample: 'broadcast {\n  - "&6[Server] &eRestarting in 5 minutes!"\n}'
  },
  inventory: {
    id: "inventory",
    label: "Inventory",
    capability: "commandExecutor",
    body: "lines",
    icon: "🎒",
    color: "border-amber-600",
    description: "Modify player inventory. Ops: give, remove, clear, check.",
    // Colon-separated, at least 2 parts. InventoryActionHandler.java:86-92 does
    // `processedData.split(":", 3)` and fails with "Expected: operation:item[:amount]"
    // when parts.length < 2 — so a space-separated "give diamond 1" never runs.
    placeholder: "e.g. give:diamond:1, clear:all",
    formatExample: 'inventory {\n  - "give:diamond:1"\n  - "clear:all"\n}'
  },
  sound: {
    id: "sound",
    label: "Sound",
    capability: "sound",
    body: "lines",
    icon: "🔊",
    color: "border-pink-500",
    description: "Play a sound. Format: soundName:volume:pitch",
    placeholder: "e.g. entity.experience_orb.pickup:0.8:1.2",
    formatExample: 'sound {\n  - "entity.experience_orb.pickup:0.8:1.2"\n}'
  },
  economy: {
    id: "economy",
    label: "Economy",
    capability: "economy",
    body: "lines",
    icon: "💰",
    color: "border-yellow-600",
    description: "Modify player balance. Ops: add, remove, set, check, pay.",
    // Colon-separated, at least 2 parts. EconomyActionHandler.java:121-127 does
    // `processedData.split(":")` and fails with "Expected: operation:amount"
    // when parts.length < 2 — so a space-separated "add 100" never runs.
    placeholder: "e.g. add:100, remove:50, set:1000",
    formatExample: 'economy {\n  - "add:100"\n  - "remove:50"\n  - "set:1000"\n}'
  },
  title: {
    id: "title",
    label: "Title",
    capability: "title",
    body: "lines",
    icon: "📜",
    color: "border-orange-500",
    description: "Show title/subtitle. Format: title:subtitle:fadeIn:stay:fadeOut",
    // Colon-separated only. TitleActionHandler.java:157-164 is
    // `processedData.split(":")` then parts[0..4] — there is no "||" separator
    // anywhere in the handler, so a title written with one lands entirely in
    // parts[0] and the subtitle never appears. Every part after the title is
    // optional (fadeIn/stay/fadeOut default to 10/60/10).
    placeholder: "e.g. &aWelcome!:&7to the server:20:60:20",
    formatExample: 'title {\n  - "&aWelcome!:&7to the server:20:60:20"\n}'
  },
  actionbar: {
    id: "actionbar",
    label: "Action Bar",
    capability: "title",
    body: "lines",
    icon: "📌",
    color: "border-teal-500",
    description: "Show text in the action bar (above hotbar).",
    placeholder: "e.g. &eBalance: $1000",
    formatExample: 'actionbar {\n  - "&eBalance: $1000"\n}'
  },
  conditional: {
    id: "conditional",
    label: "Conditional",
    capability: "always",
    body: "conditional",
    icon: "🔀",
    color: "border-violet-500",
    description: "Check a condition, run different actions based on result.",
    // A check is a condition atom, not a method name: `hasPermission` is not one of
    // the kinds ConditionEvaluator understands. Inside a conditional check only
    // `permission:` and `placeholder:<value> <op> <expected>` are supported — see
    // conditions.ts (validateAtom, "symbol" context).
    placeholder: "e.g. permission:my.permission",
    formatExample: 'conditional {\n  check: "permission:my.perm"\n  true:\n    - "message { - \\"You have permission!\\" }"\n  false:\n    - "message { - \\"No permission!\\" }"\n}'
  },
  random: {
    id: "random",
    label: "Random",
    capability: "always",
    body: "random",
    icon: "🎲",
    color: "border-indigo-500",
    description: "Randomly pick one weighted entry to execute per press.",
    placeholder: "e.g. inventory:give:diamond:1@1.0 (append @weight, default 1.0)",
    formatExample: 'random {\n  - "inventory:give:diamond:1@1.0"\n  - "inventory:give:gold_ingot:4@3.0"\n  - "inventory:give:iron_ingot:8@6.0"\n}'
  },
  bungee: {
    id: "bungee",
    label: "Bungee",
    capability: "always",
    body: "lines",
    icon: "🔗",
    color: "border-red-500",
    description: "Send a BungeeCord plugin message (cross-server).",
    placeholder: "Subchannel and args",
    formatExample: 'bungee {\n  subchannel: "Connect"\n  - "lobby"\n}'
  }
};

export const ACTION_IDS = Object.keys(ACTIONS) as ActionId[];

export function actionsForPlatform(platform: PlatformTarget): ActionDef[] {
  return ACTION_IDS.map((id) => ACTIONS[id]).filter((a) => hasCapability(a.capability, platform));
}

/**
 * The platform warning to show beside an action, or `undefined` when it runs anywhere.
 *
 * The picker offers all 14 actions whatever the project targets — filtering them was
 * silently hiding two real actions from anyone whose project carried a proxy target,
 * and a form file is the same file on every platform. The capability gate is still
 * true, so it is surfaced as a note instead of a gate; `capabilityNote` derives it
 * from `PLATFORM_CAPABILITIES`, so this stays honest if the plugin's registration
 * conditions ever change.
 */
export function actionPlatformNote(id: ActionId): string | undefined {
  return capabilityNote(ACTIONS[id].capability);
}

export function isActionId(value: string): value is ActionId {
  return value in ACTIONS;
}
