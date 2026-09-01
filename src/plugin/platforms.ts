export type PlatformTarget = "paper" | "velocity" | "bungee";

export type ActionCapability = "always" | "commandExecutor" | "sound" | "economy" | "title";

export const PLATFORM_CAPABILITIES: Record<PlatformTarget, readonly ActionCapability[]> = {
  paper: ["always", "commandExecutor", "sound", "economy", "title"],
  velocity: ["always", "commandExecutor", "title"],
  bungee: ["always", "commandExecutor", "title"]
};

export function hasCapability(cap: ActionCapability, platform: PlatformTarget): boolean {
  return PLATFORM_CAPABILITIES[platform].includes(cap);
}
