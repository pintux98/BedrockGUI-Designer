import { describe, it, expect } from "vitest";
import { designerSchema, bedrockComponentSchema } from "../core/schemas";

describe("designerSchema", () => {
  it("valid SIMPLE bedrock form", () => {
    const parsed = designerSchema.parse({
      configVersion: "1.0.0",
      menuName: "test",
      platform: "bedrock",
      bedrock: {
        type: "SIMPLE",
        title: "Title",
        buttons: [{ id: "a", text: "A" }]
      }
    });
    expect(parsed.menuName).toBe("test");
  });
});

describe("bedrockComponentSchema", () => {
  it("accepts free-form props", () => {
    const result = bedrockComponentSchema.safeParse({
      id: "nickname",
      type: "input",
      props: { text: "Display name", placeholder: "Type a nickname" }
    });
    expect(result.success).toBe(true);
  });
});

