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

  // LegacyColors matches hex only via HEX_ANGLE (`<#RRGGBB>`) and HEX_AMP
  // (`&#RRGGBB`); a bare `#RRGGBB` is not a colour anywhere in the plugin.
  it("leaves a bare #RRGGBB as literal text", () => {
    expect(parseMinecraftText("#ff00ffHex")).toEqual([{ text: "#ff00ffHex", style: {} }]);
    expect(hasMinecraftCodes("#ff00ffHex")).toBe(false);
  });

  it("does not eat a six-digit number after a #", () => {
    expect(stripMinecraftCodes("Ticket #123456 confirmed")).toBe("Ticket #123456 confirmed");
    expect(parseMinecraftText("Ticket #123456 confirmed")).toEqual([
      { text: "Ticket #123456 confirmed", style: {} }
    ]);
    expect(hasMinecraftCodes("Ticket #123456 confirmed")).toBe(false);
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

  // The plugin has no `&&` escape. translateAmpersands converts `&` only when the
  // NEXT char is in CODES — `&` is not — and then re-examines that second `&`, so
  // "&&aTest" becomes "&§aTest": a literal ampersand plus a live colour code.
  it("treats the second of a doubled && as a live colour code", () => {
    expect(parseMinecraftText("&&aTest")).toEqual([
      { text: "&", style: {} },
      { text: "Test", style: { color: "#55FF55" } }
    ]);
    expect(stripMinecraftCodes("&&aTest")).toBe("&Test");
    expect(parseMinecraftText("§§cTest")).toEqual([
      { text: "§", style: {} },
      { text: "Test", style: { color: "#FF5555" } }
    ]);
    expect(stripMinecraftCodes("§§cTest")).toBe("§Test");
  });

  // LegacyColorsTest.leavesALiteralAmpersandAlone: "Tom & Jerry" and "trailing&"
  // both survive untouched, because the char after `&` is not a code.
  it("leaves an ampersand that no code follows alone", () => {
    expect(parseMinecraftText("Tom & Jerry")).toEqual([{ text: "Tom & Jerry", style: {} }]);
    expect(hasMinecraftCodes("Tom & Jerry")).toBe(false);
    expect(parseMinecraftText("trailing&")).toEqual([{ text: "trailing&", style: {} }]);
    expect(hasMinecraftCodes("trailing&")).toBe(false);
  });

  // The old escape rewrote this to "a & b" while hasMinecraftCodes returned false,
  // so the preview's markdown branch silently lost a character.
  it("passes a doubled ampersand between spaces through untouched", () => {
    expect(parseMinecraftText("a && b")).toEqual([{ text: "a && b", style: {} }]);
    expect(stripMinecraftCodes("a && b")).toBe("a && b");
    expect(hasMinecraftCodes("a && b")).toBe(false);
  });

  // LegacyColorsTest.translatesColourCodesRegardlessOfCase asserts
  // translate("&AGreen") == "§aGreen", and CODES lists "AaBbCcDdEeFf". Uppercase
  // really is a colour code, so "R&D budget" colouring is the plugin's behaviour.
  it("treats an uppercase code after & as a colour, as the plugin does", () => {
    expect(parseMinecraftText("R&D budget")).toEqual([
      { text: "R", style: {} },
      { text: " budget", style: { color: "#FF55FF" } }
    ]);
    expect(hasMinecraftCodes("R&D budget")).toBe(true);
    expect(parseMinecraftText("&AGreen")).toEqual([{ text: "Green", style: { color: "#55FF55" } }]);
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

  // Dropping the bare-`#` rule from hasMinecraftCodes must not take the two
  // prefixed hex syntaxes with it — they were incidentally covered by it.
  it("still detects both prefixed hex syntaxes", () => {
    expect(hasMinecraftCodes("&#00ff00Green")).toBe(true);
    expect(hasMinecraftCodes("§#00ff00Green")).toBe(true);
    expect(hasMinecraftCodes("<#00FF00>go")).toBe(true);
    expect(hasMinecraftCodes("§x§F§F§0§0§F§FHex")).toBe(true);
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
