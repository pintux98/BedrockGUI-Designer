import { describe, it, expect } from "vitest";
import { resolveImageForPreview } from "../core/resolveImage";
import { AssetsConfig } from "../core/project";

const OFF: AssetsConfig = { enabled: false, port: 0, host: "" };
const ON: AssetsConfig = { enabled: true, port: 8123, host: "mc.example.com" };

describe("resolveImageForPreview", () => {
  it("resolves a URL to itself", () => {
    expect(resolveImageForPreview("https://e.com/a.png", OFF).src).toBe("https://e.com/a.png");
  });

  it("resolves a player head through mc-heads", () => {
    const r = resolveImageForPreview("head:Notch", OFF);
    expect(r.src).toContain("mc-heads.net");
    expect(r.src).toContain("Notch");
  });

  it("resolves a bare name that looks like a head through mc-heads", () => {
    const r = resolveImageForPreview("069a79f4-44e9-4726-a5be-fca90e38aaf5", OFF);
    expect(r.src).toContain("mc-heads.net");
    expect(r.src).toContain("069a79f4-44e9-4726-a5be-fca90e38aaf5");
  });

  it("resolves a local asset against the configured host when the server is on", () => {
    expect(resolveImageForPreview("logo.png", ON).src).toBe("http://mc.example.com:8123/logo.png");
  });

  it("explains why a local asset cannot render when the server is off", () => {
    const r = resolveImageForPreview("logo.png", OFF);
    expect(r.src).toBeUndefined();
    expect(r.label).toContain("asset server");
  });

  it("explains why a local asset cannot render when the host is blank", () => {
    const r = resolveImageForPreview("logo.png", { enabled: true, port: 8123, host: "   " });
    expect(r.src).toBeUndefined();
    expect(r.label).toContain("asset server");
  });

  it("renders nothing for a no-icon material", () => {
    const r = resolveImageForPreview("BARRIER", OFF);
    expect(r.src).toBeUndefined();
    expect(r.label).toContain("BARRIER");
  });

  it("returns no src and does not call an empty value broken", () => {
    const r = resolveImageForPreview("", OFF);
    expect(r.src).toBeUndefined();
    expect(r.label).not.toMatch(/unrecognis|unrecogniz|broken|invalid|error/i);
  });

  it("carries the classified potion effect in the label", () => {
    const r = resolveImageForPreview("POTION:LONG_NIGHT_VISION", OFF);
    expect(r.src).toBeUndefined();
    expect(r.label).toContain("NIGHT_VISION");
  });

  it("describes a material instead of drawing it", () => {
    const r = resolveImageForPreview("DIAMOND_SWORD", OFF);
    expect(r.src).toBeUndefined();
    expect(r.label).toContain("DIAMOND_SWORD");
  });

  it("describes a texture path instead of drawing it", () => {
    const r = resolveImageForPreview("textures/items/apple", OFF);
    expect(r.src).toBeUndefined();
    expect(r.label).toContain("textures/items/apple");
  });

  it("names an unrecognised value as unrecognised", () => {
    const r = resolveImageForPreview("what is this??", OFF);
    expect(r.src).toBeUndefined();
    expect(r.label).toMatch(/unrecognised/i);
  });
});

describe("skin sources", () => {
  const SKIN_BLOB =
    "eyJ0aW1lc3RhbXAiOiAxNzAwMDAwMDAwMDAwLCAicHJvZmlsZUlkIjogIjA2OWE3OWY0NDRlOTQ3MjZhNWJlZmNhOTBlMzhhYWY1IiwgInByb2ZpbGVOYW1lIjogIk5vdGNoIiwgInRleHR1cmVzIjogeyJTS0lOIjogeyJ1cmwiOiAiaHR0cDovL3RleHR1cmVzLm1pbmVjcmFmdC5uZXQvdGV4dHVyZS8yOTIwMDlhNDkyNWI1OGYwMmM3N2RhZGMzZWNlZjA3ZWE0Yzc0NzJmNjRlMGZkYzMyY2U1NTIyNDg5MzYyNjgwIn19fQ==";
  const HASH = "292009a4925b58f02c77dadc3ecef07ea4c7472f64e0fdc32ce5522489362680";

  it("renders a Mojang texture URL as a head, not the raw skin sheet", () => {
    const r = resolveImageForPreview(`https://textures.minecraft.net/texture/${HASH}`, OFF);
    expect(r.src).toBe(`https://mc-heads.net/head/${HASH}/64`);
  });

  it("decodes a base64 skin blob to its head, as mapImageSource does", () => {
    expect(resolveImageForPreview(SKIN_BLOB, OFF).src).toBe(`https://mc-heads.net/head/${HASH}/64`);
  });

  it("does not call an undecodable blob broken — the plugin still accepts it", () => {
    const r = resolveImageForPreview("A".repeat(60), OFF);
    expect(r.src).toBeUndefined();
    expect(r.label).not.toMatch(/unrecognis|unrecogniz|invalid|broken/i);
  });
});
