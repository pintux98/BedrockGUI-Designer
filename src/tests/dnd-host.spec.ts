import { describe, it, expect } from "vitest";
import { computeDropResult } from "../app/DndHost";
import { BedrockForm } from "../core/types";

const customForm: BedrockForm = {
  type: "CUSTOM",
  title: "Form",
  components: []
};

const simpleForm: BedrockForm = {
  type: "SIMPLE",
  title: "Form",
  buttons: [{ id: "button_1", text: "Button 1" }]
};

describe("computeDropResult", () => {
  it("ignores a drop with type: label onto a CUSTOM form and creates no component", () => {
    const result = computeDropResult(customForm, "bedrock-components", "label");
    expect(result).toBeNull();
  });

  it("ignores a drop with an unknown type onto a CUSTOM form", () => {
    const result = computeDropResult(customForm, "bedrock-components", "stepper");
    expect(result).toBeNull();
  });

  it("creates a component for a valid BedrockComponentType", () => {
    const result = computeDropResult(customForm, "bedrock-components", "input");
    expect(result).not.toBeNull();
    if (result?.type !== "CUSTOM") throw new Error("expected CUSTOM");
    expect(result.components).toHaveLength(1);
    expect(result.components[0].type).toBe("input");
  });

  it("creates a button for a SIMPLE form with a unique id", () => {
    const result = computeDropResult(simpleForm, "bedrock-buttons", "button");
    expect(result).not.toBeNull();
    if (result?.type !== "SIMPLE") throw new Error("expected SIMPLE");
    expect(result.buttons.map((b) => b.id)).toEqual(["button_1", "button_2"]);
  });

  it("ignores a button drop onto a CUSTOM form's component zone", () => {
    const result = computeDropResult(customForm, "bedrock-components", "button");
    expect(result).toBeNull();
  });
});
