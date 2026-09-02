import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import { classifyImage, HEAD_FALLBACK_MATERIALS } from "../../plugin/images";

describe("images.ts is data-only", () => {
  it("imports nothing from the app", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "../../plugin/images.ts"), "utf8");
    expect(source).not.toMatch(/^\s*import /m);
  });
});

describe("classifyImage", () => {
  it("recognises a material", () => {
    expect(classifyImage("DIAMOND_SWORD").kind).toBe("material");
  });

  it("recognises a real material not on the curated picker list", () => {
    expect(classifyImage("NETHERITE_CHESTPLATE").kind).toBe("material");
    expect(classifyImage("ENCHANTED_GOLDEN_APPLE").kind).toBe("material");
    expect(classifyImage("WRITABLE_BOOK").kind).toBe("material");
  });

  it("recognises a potion with an effect", () => {
    expect(classifyImage("POTION:HEALING").kind).toBe("potion");
    expect(classifyImage("TIPPED_ARROW:LONG_POISON").kind).toBe("potion");
  });

  it("recognises a resource pack path", () => {
    expect(classifyImage("textures/ui/icon_setting").kind).toBe("texturePath");
  });

  it("recognises a player head", () => {
    expect(classifyImage("head:Notch").kind).toBe("head");
    expect(classifyImage("head:{player}").kind).toBe("head");
  });

  it("recognises a URL", () => {
    expect(classifyImage("https://example.com/shop.png").kind).toBe("url");
  });

  it("recognises a local asset file", () => {
    expect(classifyImage("logo.png").kind).toBe("assetFile");
    expect(classifyImage("banner.webp").kind).toBe("assetFile");
  });

  it("reports the texture-less materials as the head render the plugin actually draws", () => {
    // The "no icon" guard is only in IconResolver.resolveImage (IconResolver.java:373-375),
    // which buttons never reach. FormMenuUtil.mapImageSource gets null from resolveIcon
    // and falls through to FormMenuUtil.java:1472-1474, which returns
    // https://mc-heads.net/head/BARRIER/64 — a player head named BARRIER.
    expect(classifyImage("BARRIER").kind).toBe("headFallback");
    expect(classifyImage("BARRIER").detail).toBe("BARRIER");
    expect(classifyImage("AIR").kind).toBe("headFallback");
    for (const material of HEAD_FALLBACK_MATERIALS) {
      expect(classifyImage(material).kind, material).toBe("headFallback");
    }
  });

  it("reports anything else as unknown", () => {
    expect(classifyImage("not a real thing").kind).toBe("unknown");
  });

  it("recognises an implicit head reference containing a dot or a dash", () => {
    expect(classifyImage("069a79f4-44e9-4726-a5be-fca90e38aaf5").kind).toBe("implicitHead");
    expect(classifyImage("some-custom-icon").kind).toBe("implicitHead");
    expect(classifyImage("vip.gold").kind).toBe("implicitHead");
  });

  it("does not let implicitHead swallow an asset file", () => {
    expect(classifyImage("logo.png").kind).toBe("assetFile");
    expect(classifyImage("logo.png").kind).not.toBe("implicitHead");
  });

  it("strips an embedded minecraft: namespace from a potion effect", () => {
    const result = classifyImage("POTION:minecraft:strong_healing");
    expect(result.kind).toBe("potion");
    expect(result.detail).toBe("HEALING");
  });
});

describe("classifyImage against the shipped fixtures", () => {
  const dir = path.resolve(__dirname, "../fixtures/plugin-forms");
  const images: string[] = [];

  for (const file of fs.readdirSync(dir)) {
    const doc = yaml.load(fs.readFileSync(path.join(dir, file), "utf8"));
    collectImages(doc, images);
  }

  it("found exactly 40 image values in the fixtures", () => {
    expect(images.length).toBe(40);
  });

  it("classifies every fixture image value as a known kind", () => {
    for (const image of images) {
      expect(classifyImage(image).kind).not.toBe("unknown");
    }
  });
});

function collectImages(node: unknown, out: string[]) {
  if (Array.isArray(node)) { node.forEach((n) => collectImages(n, out)); return; }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === "image" && typeof value === "string") out.push(value);
      else collectImages(value, out);
    }
  }
}

describe("image sources the plugin maps but the classifier used to miss", () => {
  const SKIN_BLOB =
    "eyJ0aW1lc3RhbXAiOiAxNzAwMDAwMDAwMDAwLCAicHJvZmlsZUlkIjogIjA2OWE3OWY0NDRlOTQ3MjZhNWJlZmNhOTBlMzhhYWY1IiwgInByb2ZpbGVOYW1lIjogIk5vdGNoIiwgInRleHR1cmVzIjogeyJTS0lOIjogeyJ1cmwiOiAiaHR0cDovL3RleHR1cmVzLm1pbmVjcmFmdC5uZXQvdGV4dHVyZS8yOTIwMDlhNDkyNWI1OGYwMmM3N2RhZGMzZWNlZjA3ZWE0Yzc0NzJmNjRlMGZkYzMyY2U1NTIyNDg5MzYyNjgwIn19fQ==";

  it("classifies a Mojang texture URL apart from a plain URL", () => {
    const r = classifyImage("http://textures.minecraft.net/texture/abc123");
    expect(r.kind).toBe("mojangTexture");
    expect(r.detail).toBe("abc123");
    expect(classifyImage("https://textures.minecraft.net/texture/abc123").kind).toBe("mojangTexture");
  });

  it("still classifies any other URL as a plain URL", () => {
    expect(classifyImage("https://example.com/a.png").kind).toBe("url");
  });

  it("classifies a base64 skin blob", () => {
    expect(classifyImage(SKIN_BLOB).kind).toBe("base64Skin");
  });

  it("does not mistake a material name for a base64 blob", () => {
    expect(classifyImage("DIAMOND_SWORD").kind).toBe("material");
    expect(classifyImage("A".repeat(30)).kind).toBe("material");
  });

  it("accepts a blob on shape alone, as the plugin's validator does", () => {
    // ValidationUtils.isValidImageSource never decodes; only mapImageSource does.
    expect(classifyImage("A".repeat(60)).kind).toBe("base64Skin");
  });
});

describe("shapes the plugin accepts that used to read as unknown", () => {
  it("classifies any value carrying a placeholder", () => {
    // ValidationUtils.java:93-96 returns true for anything containing '%', and
    // FormMenuUtil substitutes placeholders (FormMenuUtil.java:676-677, 697-698)
    // before mapImageSource ever sees the value.
    expect(classifyImage("%player_skin_texture%").kind).toBe("placeholder");
    expect(classifyImage("%vault_rank%_icon").kind).toBe("placeholder");
    expect(classifyImage("POTION:%effect%").kind).toBe("placeholder");
  });

  it("gives a placeholder no detail to build a src from", () => {
    expect(classifyImage("%player_skin_texture%").detail).toBeUndefined();
  });

  it("keeps head: winning over the placeholder rule", () => {
    // head:%player% is the documented spelling (IconResolver.java:445-447).
    const result = classifyImage("head:%player%");
    expect(result.kind).toBe("head");
    expect(result.detail).toBe("%player%");
  });

  it("keeps a URL and a texture path winning over the placeholder rule", () => {
    expect(classifyImage("https://example.com/%player%.png").kind).toBe("url");
    expect(classifyImage("textures/ui/%icon%").kind).toBe("texturePath");
  });

  it("classifies a pack-relative path under a non-textures root", () => {
    // ValidationUtils.java:103-106 accepts it and FormMenuUtil.java:1476 passes it
    // to the client verbatim as FormImage.Type.PATH.
    expect(classifyImage("mypack/icons/gold").kind).toBe("texturePath");
    expect(classifyImage("custom/deep/nested/icon").kind).toBe("texturePath");
    expect(classifyImage("pack-1/icon_v2").kind).toBe("texturePath");
  });

  it("still reads a slashed path with an image extension as a local asset", () => {
    // IconResolver.isLocalImageFile accepts a slashed path, so mapImageSource routes
    // it through the asset server (FormMenuUtil.java:1468-1470) rather than 1476.
    expect(classifyImage("assets/logo.png").kind).toBe("assetFile");
    expect(classifyImage("icons/shop/banner.webp").kind).toBe("assetFile");
  });

  it("still reports a namespaced material as unknown, on purpose", () => {
    // ValidationUtils.java:108-111 accepts it, but resolveIcon rejects the colon
    // (IconResolver.java:414) and the value reaches the client as a dead PATH.
    // The designer's warning is more useful than the plugin's silence.
    expect(classifyImage("minecraft:diamond_sword").kind).toBe("unknown");
  });

  it("still reports genuine nonsense as unknown", () => {
    expect(classifyImage("not a real thing").kind).toBe("unknown");
    expect(classifyImage("who/knows what this is").kind).toBe("unknown");
  });
});
