import { describe, it, expect } from "vitest";
import yaml from "js-yaml";
import { serializeFormDocument } from "../serialize/form";
import { createForm } from "../core/project";

describe("serializeFormDocument", () => {
  it("writes content, never description", () => {
    const doc = createForm("welcome");
    doc.bedrock.content = "Hello";
    const text = serializeFormDocument(doc);
    expect(text).toContain("content:");
    expect(text).not.toContain("description:");
  });

  it("never writes a config version into a form file", () => {
    expect(serializeFormDocument(createForm("welcome"))).not.toContain("configVersion");
    expect(serializeFormDocument(createForm("welcome"))).not.toContain("config-version");
  });

  it("writes buttons as a keyed map", () => {
    const text = serializeFormDocument(createForm("welcome"));
    const loaded = yaml.load(text) as any;
    expect(Object.keys(loaded.bedrock.buttons)).toEqual(["button_1"]);
  });

  it("emits action blocks as block scalars", () => {
    const doc = createForm("welcome");
    (doc.bedrock as any).buttons[0].onClick = [
      { id: "raw", params: 'message {\n  - "Hi"\n}', raw: 'message {\n  - "Hi"\n}' }
    ];
    expect(serializeFormDocument(doc)).toContain("- |-");
  });

  it("round-trips a preserved java section", () => {
    const doc = createForm("shop");
    doc.javaRaw = { type: "CHEST", size: "27" };
    const loaded = yaml.load(serializeFormDocument(doc)) as any;
    expect(loaded.java).toEqual({ type: "CHEST", size: "27" });
  });
});
