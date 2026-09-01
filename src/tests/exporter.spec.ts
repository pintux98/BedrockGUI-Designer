import { describe, it, expect, beforeEach } from "vitest";
import { useDesignerStore } from "../core/store";
import { serializeFormDocument } from "../serialize/form";
import { createEmptyProject } from "../core/project";

describe("exporter", () => {
  beforeEach(() => {
    useDesignerStore.getState().loadProject(createEmptyProject());
  });

  it("exports a form document without a forms key or a config version", () => {
    const state = useDesignerStore.getState();
    state.setBedrock({ ...state.activeForm().bedrock, content: "Welcome" });
    const out = serializeFormDocument(useDesignerStore.getState().activeForm());

    expect(out).not.toContain("forms:");
    expect(out).not.toContain("configVersion");
    expect(out).not.toContain("config-version");
    expect(out).not.toContain("description:");
    expect(out).toContain("content:");
    expect(out).toMatch(/bedrock:/);
  });

  it("does not use block scalars for image urls", () => {
    const state = useDesignerStore.getState();
    state.setBedrock({
      type: "SIMPLE",
      title: "Test",
      buttons: [{ id: "btn1", text: "Click", image: "http://example.com/image.png" }]
    });
    const out = serializeFormDocument(useDesignerStore.getState().activeForm());
    expect(out).not.toContain("image: >-");
    expect(out).toMatch(/image:\s+["']http:\/\/example\.com\/image\.png["']/);
  });

  it("preserves multiline action formatting", () => {
    const state = useDesignerStore.getState();
    state.setBedrock({
      type: "SIMPLE",
      title: "Test",
      buttons: [
        {
          id: "btn1",
          text: "Click",
          onClick: [{ id: "raw", params: 'message {\n  - "Hello"\n}', raw: 'message {\n  - "Hello"\n}' }]
        }
      ]
    } as any);
    const out = serializeFormDocument(useDesignerStore.getState().activeForm());
    expect(out).toMatch(/onClick:\n\s+- \|-/);
    expect(out).toContain("message {");
    expect(out).toContain('  - "Hello"');
  });

  it("exports multiline bedrock content and button text safely", () => {
    const state = useDesignerStore.getState();
    state.setBedrock({
      type: "SIMPLE",
      title: "Test",
      content: "&6%luckperms_meta_kingdom%'s Gold &f%vault_eco_balance%\n&bSecond line\n\n&6Third line",
      buttons: [{ id: "deposit_10", text: "&6Pay\n&f%vault_eco_balance%" }]
    } as any);
    const out = serializeFormDocument(useDesignerStore.getState().activeForm());

    expect(out).toContain("content: |-");
    expect(out).not.toContain("description:");
    expect(out).toContain("&6%luckperms_meta_kingdom%'s Gold");

    expect(out).toContain("text: |-");
    expect(out).toContain("&f%vault_eco_balance%");
  });
});
