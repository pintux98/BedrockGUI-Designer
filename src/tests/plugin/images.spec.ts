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
});

describe("classifyImage against the shipped fixtures", () => {
  const dir = path.resolve(__dirname, "../fixtures/plugin-forms");
  const images: string[] = [];

  for (const file of fs.readdirSync(dir)) {
    const doc = yaml.load(fs.readFileSync(path.join(dir, file), "utf8"));
    collectImages(doc, images);
  }

  it("found image values in the fixtures", () => {
    expect(images.length).toBeGreaterThan(0);
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
