import { describe, it, expect } from "vitest";
import { bedrockComponentSchema, actionSchema, bedrockSimpleSchema } from "../core/schemas";

describe("bedrockSimpleSchema", () => {
  it("valid SIMPLE bedrock form", () => {
    const parsed = bedrockSimpleSchema.parse({
      type: "SIMPLE",
      title: "Title",
      buttons: [{ id: "a", text: "A" }]
    });
    expect(parsed.title).toBe("Title");
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

describe("actionSchema", () => {
  it("accepts an action with no params key, as Zod 3 did", () => {
    const result = actionSchema.safeParse({ id: "raw" });
    expect(result.success).toBe(true);
  });
});

