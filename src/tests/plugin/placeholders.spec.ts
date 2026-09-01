import { describe, it, expect } from "vitest";
import { BUILTIN_PLACEHOLDERS, componentReference, findUnknownBracePlaceholders } from "../../plugin/placeholders";

describe("placeholders", () => {
  it("knows the twelve built-ins, in order", () => {
    expect(BUILTIN_PLACEHOLDERS.map((p) => p.token)).toEqual([
      "{player}",
      "{uuid}",
      "{time}",
      "{hour}",
      "{minute}",
      "{timestamp}",
      "{x}",
      "{y}",
      "{z}",
      "{world}",
      "{health}",
      "{food}"
    ]);
  });

  it("marks exactly the six positional/player-state placeholders as paperOnly", () => {
    const paperOnlyTokens = BUILTIN_PLACEHOLDERS.filter((p) => p.paperOnly).map((p) => p.token);
    expect(paperOnlyTokens).toEqual(["{x}", "{y}", "{z}", "{world}", "{health}", "{food}"]);

    const nonPaperOnlyTokens = BUILTIN_PLACEHOLDERS.filter((p) => !p.paperOnly).map((p) => p.token);
    expect(nonPaperOnlyTokens).toEqual(["{player}", "{uuid}", "{time}", "{hour}", "{minute}", "{timestamp}"]);
  });

  it("accepts a built-in", () => {
    expect(findUnknownBracePlaceholders("Hello {player}!")).toEqual([]);
  });

  it("accepts the paper-only built-ins without flagging them", () => {
    expect(findUnknownBracePlaceholders("HP: {health} in {world}")).toEqual([]);
  });

  it("flags a brace placeholder that is not built in", () => {
    expect(findUnknownBracePlaceholders("Balance {money}")).toEqual(["{money}"]);
  });

  it("ignores PlaceholderAPI syntax", () => {
    expect(findUnknownBracePlaceholders("Balance %vault_eco_balance%")).toEqual([]);
  });

  it("builds a component reference", () => {
    expect(componentReference("render_distance")).toBe("$render_distance");
  });
});
