import { describe, it, expect } from "vitest";
import { hasCapability, PLATFORM_CAPABILITIES } from "../../plugin/platforms";

describe("platform capabilities", () => {
  it("gives Paper every capability", () => {
    expect(hasCapability("sound", "paper")).toBe(true);
    expect(hasCapability("economy", "paper")).toBe(true);
    expect(hasCapability("title", "paper")).toBe(true);
    expect(hasCapability("commandExecutor", "paper")).toBe(true);
  });

  it("denies sound and economy on proxies", () => {
    for (const proxy of ["velocity", "bungee"] as const) {
      expect(hasCapability("sound", proxy)).toBe(false);
      expect(hasCapability("economy", proxy)).toBe(false);
      expect(hasCapability("title", proxy)).toBe(true);
      expect(hasCapability("commandExecutor", proxy)).toBe(true);
    }
  });

  it("always grants the always capability", () => {
    for (const p of Object.keys(PLATFORM_CAPABILITIES) as Array<keyof typeof PLATFORM_CAPABILITIES>) {
      expect(hasCapability("always", p)).toBe(true);
    }
  });
});
