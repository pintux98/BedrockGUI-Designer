import { describe, it, expect } from "vitest";
import { buildConfigSnippet } from "../serialize/configSnippet";
import { createForm } from "../core/project";

describe("buildConfigSnippet", () => {
  it("keys each form by its id and points at its fileName", () => {
    const main = createForm("main_menu");
    const shop = createForm("shop");
    shop.fileName = "store.yml";
    expect(buildConfigSnippet([main, shop])).toBe(
      'forms:\n  main_menu:\n    file: "main_menu.yml"\n  shop:\n    file: "store.yml"\n'
    );
  });

  it("uses the id, not the fileName, as the registry key", () => {
    const form = createForm("shop");
    form.fileName = "totally_different.yml";
    const snippet = buildConfigSnippet([form]);
    expect(snippet).toContain("  shop:\n");
    expect(snippet).toContain('file: "totally_different.yml"');
    expect(snippet).not.toContain("totally_different:");
  });

  it("produces an empty registry for no forms", () => {
    expect(buildConfigSnippet([])).toBe("forms: {}\n");
  });
});
