export type PlatformTarget = "paper" | "velocity" | "bungee";

export type ActionCapability = "always" | "commandExecutor" | "sound" | "economy" | "title";

export const PLATFORM_CAPABILITIES: Record<PlatformTarget, readonly ActionCapability[]> = {
  paper: ["always", "commandExecutor", "sound", "economy", "title"],
  velocity: ["always", "commandExecutor", "title"],
  bungee: ["always", "commandExecutor", "title"]
};

export const PLATFORM_TARGETS = Object.keys(PLATFORM_CAPABILITIES) as PlatformTarget[];

export function hasCapability(cap: ActionCapability, platform: PlatformTarget): boolean {
  return PLATFORM_CAPABILITIES[platform].includes(cap);
}

/**
 * The platform service each capability's handlers need.
 *
 * `FormMenuUtil.registerDefaultActionHandlers` (FormMenuUtil.java:82-113) wraps every
 * gated `registerHandler` call in `if (<manager> != null)` — `soundManager` at :96,
 * `economyManager` at :100, `titleManager` at :104, `commandExecutor` at :90 — so a
 * capability whose manager is null on a platform has no handler registered there at
 * all, and the action fails with "Unknown action type" (ActionExecutor.java:95-99).
 * `always` names no manager because its four handlers are registered unconditionally.
 */
const CAPABILITY_MANAGERS: Record<ActionCapability, string | null> = {
  always: null,
  commandExecutor: "command executor",
  sound: "sound manager",
  economy: "economy manager",
  title: "title manager"
};

/** The platform targets that register this capability's handlers. */
export function platformsWithCapability(cap: ActionCapability): PlatformTarget[] {
  return PLATFORM_TARGETS.filter((p) => hasCapability(cap, p));
}

/**
 * A one-line warning for a capability that some platform target does not register,
 * or `undefined` when every target does.
 *
 * Derived from `PLATFORM_CAPABILITIES`, never from a hand-kept list of actions: today
 * only `sound` and `economy` are missing anywhere, because the Velocity and Bungee
 * entrypoints both construct the API with `null` sound and economy managers
 * (velocity/…/BedrockGUI.java:135, bungeecord/…/BedrockGUI.java:91) while still
 * passing a command executor and a title manager. The wording says "a proxy" because
 * Paper is the only non-proxy target, so anything Paper alone grants is Paper-only.
 */
export function capabilityNote(cap: ActionCapability): string | undefined {
  const manager = CAPABILITY_MANAGERS[cap];
  if (!manager) return undefined;
  if (platformsWithCapability(cap).length === PLATFORM_TARGETS.length) return undefined;
  return `Paper only — a proxy registers no ${manager}, so this action has no handler there.`;
}
