import React from "react";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { useDesignerStore } from "../core/store";
import { ValidationPanel } from "../panels/ValidationPanel";

function setActiveFormBedrock(bedrock: any) {
  useDesignerStore.setState({
    project: {
      pluginTarget: "2.0.11",
      configVersion: 1,
      assets: { enabled: false, port: 0, host: "" },
      platformTarget: "paper",
      activeFormId: "example",
      forms: [
        {
          id: "example",
          fileName: "example.yml",
          bedrock
        }
      ]
    },
    history: {},
    dirty: false,
    selectedBedrockButtonId: null,
    selectedBedrockComponentId: null
  } as any);
}

function renderExpanded() {
  const result = render(<ValidationPanel />);
  const summary = result.container.querySelector(".cursor-pointer");
  if (summary) fireEvent.click(summary);
  return result;
}

describe("ValidationPanel", () => {
  afterEach(() => cleanup());

  it("does not flag head:Notch or POTION:SPEED as invalid image sources", () => {
    setActiveFormBedrock({
      type: "SIMPLE",
      title: "Form",
      content: "",
      buttons: [
        { id: "a", text: "A", image: "head:Notch" },
        { id: "b", text: "B", image: "POTION:SPEED" }
      ]
    });
    const { container } = renderExpanded();
    expect(container.textContent).not.toContain("image source looks invalid");
  });

  it("still reports an unknown action type on a button", () => {
    setActiveFormBedrock({
      type: "SIMPLE",
      title: "Form",
      content: "",
      buttons: [
        {
          id: "a",
          text: "A",
          onClick: [{ id: "act1", params: {}, raw: 'totally_bogus_action {\n  - "x"\n}' }]
        }
      ]
    });
    const { container } = renderExpanded();
    expect(container.textContent).toContain("unknown action type 'totally_bogus_action'");
  });

  it("reports a bad action type on a CUSTOM component (field is `action`, not `onClick`)", () => {
    setActiveFormBedrock({
      type: "CUSTOM",
      title: "Form",
      content: "",
      components: [
        {
          id: "comp_1",
          type: "input",
          props: {},
          action: [{ id: "act1", params: {}, raw: 'nonsense_action {\n  - "x"\n}' }]
        }
      ]
    });
    const { container } = renderExpanded();
    expect(container.textContent).toContain("unknown action type 'nonsense_action'");
  });

  it("still reports a MODAL with 3 buttons", () => {
    setActiveFormBedrock({
      type: "MODAL",
      title: "Form",
      content: "",
      buttons: [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
        { id: "c", text: "C" }
      ]
    });
    const { container } = renderExpanded();
    expect(container.textContent).toContain("MODAL must have exactly 2 buttons");
  });
});
