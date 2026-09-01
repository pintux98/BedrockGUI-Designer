export const BUILTIN_PLACEHOLDERS = [
  { token: "{player}", description: "The player's name" },
  { token: "{uuid}", description: "The player's UUID" },
  { token: "{time}", description: "Server time in ticks" },
  { token: "{hour}", description: "Current hour, 0 to 23" },
  { token: "{minute}", description: "Current minute" },
  { token: "{timestamp}", description: "Unix time in milliseconds" }
] as const;

const BUILTIN_TOKENS: Set<string> = new Set(BUILTIN_PLACEHOLDERS.map((p) => p.token));

export function findUnknownBracePlaceholders(text: string): string[] {
  const found = text.match(/\{[a-z_][a-z0-9_]*\}/gi) ?? [];
  return [...new Set(found.filter((token) => !BUILTIN_TOKENS.has(token.toLowerCase())))];
}

export function componentReference(key: string): string {
  return `$${key}`;
}
