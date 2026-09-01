import { describe, it, expect } from "vitest";
import { BUILTIN_PLACEHOLDERS, componentReference, findUnknownBracePlaceholders } from "../../plugin/placeholders";

describe("placeholders", () => {
  it("knows the six built-ins", () => {
    expect(BUILTIN_PLACEHOLDERS.map((p) => p.token)).toEqual(
      ["{player}", "{uuid}", "{time}", "{hour}", "{minute}", "{timestamp}"]
    );
  });

  it("accepts a built-in", () => {
    expect(findUnknownBracePlaceholders("Hello {player}!")).toEqual([]);
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
