import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { classifyImage } from "../../plugin/images";

describe("classifyImage", () => {
  it("recognises a material", () => {
    expect(classifyImage("DIAMOND_SWORD").kind).toBe("material");
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

  it("recognises materials that draw no icon", () => {
    expect(classifyImage("BARRIER").kind).toBe("none");
    expect(classifyImage("AIR").kind).toBe("none");
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
