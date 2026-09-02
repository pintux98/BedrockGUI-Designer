import { describe, expect, it } from "vitest";
import { hasMinecraftCodes, parseMinecraftText, stripMinecraftCodes } from "../core/minecraftText";

describe("minecraftText", () => {
  it("parses legacy & color codes", () => {
    const segs = parseMinecraftText("&aHello");
    expect(stripMinecraftCodes("&aHello")).toBe("Hello");
    expect(segs.some((s) => s.style.color === "#55FF55")).toBe(true);
  });

  it("parses legacy § color codes", () => {
    expect(stripMinecraftCodes("§cHi")).toBe("Hi");
    const segs = parseMinecraftText("§cHi");
    expect(segs.some((s) => s.style.color === "#FF5555")).toBe(true);
  });

  it("parses direct #RRGGBB hex colors", () => {
    const segs = parseMinecraftText("#ff00ffHex");
    expect(stripMinecraftCodes("#ff00ffHex")).toBe("Hex");
    expect(segs.some((s) => s.style.color === "#FF00FF")).toBe(true);
  });

  it("parses &#RRGGBB hex colors", () => {
    const segs = parseMinecraftText("&#00ff00Green");
    expect(stripMinecraftCodes("&#00ff00Green")).toBe("Green");
    expect(segs.some((s) => s.style.color === "#00FF00")).toBe(true);
  });

  it("parses §x style hex sequences", () => {
    const text = "§x§F§F§0§0§F§FHex";
    const segs = parseMinecraftText(text);
    expect(stripMinecraftCodes(text)).toBe("Hex");
    expect(segs.some((s) => s.style.color === "#FF00FF")).toBe(true);
  });

  it("treats double && and §§ as literal characters", () => {
    expect(stripMinecraftCodes("&&aTest")).toBe("&aTest");
    expect(stripMinecraftCodes("§§cTest")).toBe("§cTest");
  });

  it("renders a hex colour", () => {
    const segs = parseMinecraftText("&#FF8800warm");
    expect(segs).toEqual([{ text: "warm", style: { color: "#FF8800" } }]);
  });

  it("renders MiniMessage colour and decoration tags", () => {
    expect(parseMinecraftText("<red>stop</red>")[0]).toEqual({ text: "stop", style: { color: "#FF5555" } });
    expect(parseMinecraftText("<bold>b</bold>")[0].style.bold).toBe(true);
  });

  it("renders a MiniMessage hex tag", () => {
    expect(parseMinecraftText("<#00FF00>go")[0].style.color).toBe("#00FF00");
  });

  it("still renders legacy codes and resets", () => {
    const segs = parseMinecraftText("§aok§rplain");
    expect(segs[0].style.color).toBe("#55FF55");
    expect(segs[1].style.color).toBeUndefined();
  });

  it("leaves an unknown tag as literal text", () => {
    expect(parseMinecraftText("<notatag>x")[0].text).toBe("<notatag>x");
  });

  it("closes only the decoration its tag opened", () => {
    const segs = parseMinecraftText("<red><bold>loud</bold>calm");
    expect(segs[0]).toEqual({ text: "loud", style: { color: "#FF5555", bold: true } });
    expect(segs[1].style.color).toBe("#FF5555");
    expect(segs[1].style.bold).toBeFalsy();
  });

  it("keeps a hex colour when a legacy code follows it immediately", () => {
    expect(parseMinecraftText("&#FF8800&lbold")[0]).toEqual({
      text: "bold",
      style: { color: "#FF8800", bold: true }
    });
    expect(parseMinecraftText("&#FF8800&rplain")[0]).toEqual({ text: "plain", style: {} });
  });

  it("detects MiniMessage tags but not unknown ones", () => {
    expect(hasMinecraftCodes("<red>stop</red>")).toBe(true);
    expect(hasMinecraftCodes("<#00FF00>go")).toBe(true);
    expect(hasMinecraftCodes("<notatag>x")).toBe(false);
  });

  it("does not mistake Object.prototype keys for tags", () => {
    expect(parseMinecraftText("<constructor>x")[0]).toEqual({ text: "<constructor>x", style: {} });
    expect(hasMinecraftCodes("<toString>x")).toBe(false);
  });
});
