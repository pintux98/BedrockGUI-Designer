import { ActionCapability, PlatformTarget, hasCapability } from "./platforms";

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
  hasNestedBlocks: boolean;
  nestedBlockLabels?: string[];
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
    formatExample: 'command {\n  - "spawn"\n  - "warp {player} shops"\n}',
    hasNestedBlocks: false
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
    formatExample: 'open {\n  - "shop_menu"\n  - "warp_menu {player}"\n}',
    hasNestedBlocks: false
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
    formatExample: 'message {\n  - "&aHello, {player}!"\n  - "&7Your balance: &a$1000"\n}',
    hasNestedBlocks: false
  },
  delay: {
    id: "delay",
    label: "Delay",
    capability: "always",
    body: "lines",
    icon: "⏱️",
    color: "border-gray-400",
    description: "Wait before executing next actions. Max 30000ms.",
    placeholder: "e.g. 20 (ticks), 1s, 500ms",
    formatExample: 'delay {\n  - "1000"\n}',
    hasNestedBlocks: false
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
    formatExample: 'server {\n  - "give {player} diamond 1"\n  - "say Hello everyone!"\n}',
    hasNestedBlocks: false
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
    formatExample: 'broadcast {\n  - "&6[Server] &eRestarting in 5 minutes!"\n}',
    hasNestedBlocks: false
  },
  inventory: {
    id: "inventory",
    label: "Inventory",
    capability: "commandExecutor",
    body: "lines",
    icon: "🎒",
    color: "border-amber-600",
    description: "Modify player inventory. Ops: give, remove, clear, check.",
    placeholder: "e.g. clear, give diamond 1",
    formatExample: 'inventory {\n  - "give:diamond:1"\n  - "clear:all"\n}',
    hasNestedBlocks: false
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
    formatExample: 'sound {\n  - "entity.experience_orb.pickup:0.8:1.2"\n}',
    hasNestedBlocks: false
  },
  economy: {
    id: "economy",
    label: "Economy",
    capability: "economy",
    body: "lines",
    icon: "💰",
    color: "border-yellow-600",
    description: "Modify player balance. Ops: add, remove, set, check, pay.",
    placeholder: "e.g. add 100, remove 50, set 1000",
    formatExample: 'economy {\n  - "add:100"\n  - "remove:50"\n  - "set:1000"\n}',
    hasNestedBlocks: false
  },
  title: {
    id: "title",
    label: "Title",
    capability: "title",
    body: "lines",
    icon: "📜",
    color: "border-orange-500",
    description: "Show title/subtitle. Format: title:subtitle:fadeIn:stay:fadeOut",
    placeholder: "e.g. &aWelcome!&r||&7to the server",
    formatExample: 'title {\n  - "&aWelcome!||&7to the server:20:60:20"\n}',
    hasNestedBlocks: false
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
    formatExample: 'actionbar {\n  - "&eBalance: $1000"\n}',
    hasNestedBlocks: false
  },
  conditional: {
    id: "conditional",
    label: "Conditional",
    capability: "always",
    body: "conditional",
    icon: "🔀",
    color: "border-violet-500",
    description: "Check a condition, run different actions based on result.",
    placeholder: "e.g. hasPermission: my.permission",
    formatExample: 'conditional {\n  check: "permission:my.perm"\n  true:\n    - "message { - \\"You have permission!\\" }"\n  false:\n    - "message { - \\"No permission!\\" }"\n}',
    hasNestedBlocks: true,
    nestedBlockLabels: ["If true", "If false"]
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
    formatExample: 'random {\n  - "inventory:give:diamond:1@1.0"\n  - "inventory:give:gold_ingot:4@3.0"\n  - "inventory:give:iron_ingot:8@6.0"\n}',
    hasNestedBlocks: false
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
    formatExample: 'bungee {\n  subchannel: "Connect"\n  - "lobby"\n}',
    hasNestedBlocks: false
  }
};

export const ACTION_IDS = Object.keys(ACTIONS) as ActionId[];

export function actionsForPlatform(platform: PlatformTarget): ActionDef[] {
  return ACTION_IDS.map((id) => ACTIONS[id]).filter((a) => hasCapability(a.capability, platform));
}

export function isActionId(value: string): value is ActionId {
  return value in ACTIONS;
}
