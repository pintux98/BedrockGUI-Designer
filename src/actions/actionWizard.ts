import type { IconName } from "../components/Icon";
import type { ActionKind } from "./actionInfo";

export const ACTION_TITLES: Record<ActionKind, { title: string; hint: string }> = {
  message: { title: "Send a chat message", hint: "Text in the player's chat" },
  title: { title: "Show a big title", hint: "Large text in the middle of the screen" },
  actionbar: { title: "Show text above the hotbar", hint: "A short line in the action bar" },
  sound: { title: "Play a sound", hint: "Only the player hears it" },
  open: { title: "Open another form", hint: "Go to a different menu" },
  bungee: { title: "Send to another server", hint: "Move the player across your network" },
  command: { title: "Run a command as the player", hint: "Uses the player's own permissions" },
  server: { title: "Run a command from the console", hint: "Full permissions, like an admin" },
  broadcast: { title: "Message everyone", hint: "Every online player sees it" },
  economy: { title: "Give or take money", hint: "Needs Vault and an economy plugin" },
  inventory: { title: "Give or take items", hint: "Add, remove or check items" },
  delay: { title: "Wait a moment", hint: "Pause before the next action" },
  conditional: { title: "Do something only if…", hint: "Different actions when a check passes or fails" },
  random: { title: "Pick one at random", hint: "Weighted chances, like a loot roll" },
  raw: { title: "Write it by hand", hint: "Type the action block yourself" }
};

export const ACTION_GROUPS: { title: string; icon: IconName; ids: ActionKind[] }[] = [
  { title: "Talk to the player", icon: "text", ids: ["message", "title", "actionbar", "sound"] },
  { title: "Send them somewhere", icon: "external", ids: ["open", "bungee"] },
  { title: "Run commands", icon: "code", ids: ["command", "server", "broadcast"] },
  { title: "Money and items", icon: "dropdown", ids: ["economy", "inventory"] },
  { title: "Timing and logic", icon: "history", ids: ["delay", "conditional", "random"] }
];
