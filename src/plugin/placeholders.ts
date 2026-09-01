export const BUILTIN_PLACEHOLDERS = [
  { token: "{player}", description: "The player's name", paperOnly: false },
  { token: "{uuid}", description: "The player's UUID", paperOnly: false },
  { token: "{time}", description: "Server time in ticks", paperOnly: false },
  { token: "{hour}", description: "Current hour, 0 to 23", paperOnly: false },
  { token: "{minute}", description: "Current minute", paperOnly: false },
  { token: "{timestamp}", description: "Unix time in milliseconds", paperOnly: false },
  { token: "{x}", description: "Player X, 2dp. Paper only — elsewhere a fixed 0.0", paperOnly: true },
  { token: "{y}", description: "Player Y, 2dp. Paper only — elsewhere a fixed 64.0", paperOnly: true },
  { token: "{z}", description: "Player Z, 2dp. Paper only — elsewhere a fixed 0.0", paperOnly: true },
  { token: "{world}", description: "World name. Paper only — elsewhere the literal \"world\"", paperOnly: true },
  { token: "{health}", description: "Player health, 1dp. Paper only — elsewhere a fixed 20.0", paperOnly: true },
  { token: "{food}", description: "Player food level. Paper only — elsewhere a fixed 20", paperOnly: true }
] as const;

const BUILTIN_TOKENS: Set<string> = new Set(BUILTIN_PLACEHOLDERS.map((p) => p.token));

export function findUnknownBracePlaceholders(text: string): string[] {
  const found = text.match(/\{[a-z_][a-z0-9_]*\}/gi) ?? [];
  return [...new Set(found.filter((token) => !BUILTIN_TOKENS.has(token.toLowerCase())))];
}

export function componentReference(key: string): string {
  return `$${key}`;
}
