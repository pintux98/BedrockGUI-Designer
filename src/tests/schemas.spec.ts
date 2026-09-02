import { describe, it, expect } from "vitest";
import {
  bedrockComponentSchema,
  actionSchema,
  bedrockSimpleSchema,
  bedrockModalSchema,
  bedrockCustomSchema,
  bedrockButtonSchema
} from "../core/schemas";

describe("bedrockSimpleSchema", () => {
  it("valid SIMPLE bedrock form", () => {
    const parsed = bedrockSimpleSchema.parse({
      type: "SIMPLE",
      title: "Title",
      buttons: [{ id: "a", text: "A" }]
    });
    expect(parsed.title).toBe("Title");
  });

  it("accepts a SIMPLE form with zero buttons (work in progress; ValidationPanel flags it)", () => {
    const result = bedrockSimpleSchema.safeParse({ type: "SIMPLE", title: "Title", buttons: [] });
    expect(result.success).toBe(true);
  });
});

describe("bedrockModalSchema", () => {
  it("accepts a MODAL with 3 buttons (work in progress; ValidationPanel flags it)", () => {
    const result = bedrockModalSchema.safeParse({
      type: "MODAL",
      title: "Title",
      buttons: [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
        { id: "c", text: "C" }
      ]
    });
    expect(result.success).toBe(true);
  });

  it("accepts a MODAL with zero buttons", () => {
    const result = bedrockModalSchema.safeParse({ type: "MODAL", title: "Title", buttons: [] });
    expect(result.success).toBe(true);
  });
});

describe("bedrockCustomSchema", () => {
  it("accepts a CUSTOM form with zero components (work in progress; ValidationPanel flags it)", () => {
    const result = bedrockCustomSchema.safeParse({ type: "CUSTOM", title: "Title", components: [] });
    expect(result.success).toBe(true);
  });
});

describe("bedrockButtonSchema", () => {
  it("accepts an empty button text (work in progress; ValidationPanel flags it)", () => {
    const result = bedrockButtonSchema.safeParse({ id: "a", text: "" });
    expect(result.success).toBe(true);
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

