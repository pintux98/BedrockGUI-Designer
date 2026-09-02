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

  it("does not call an addon action type unknown, and names the addon that supplies it", () => {
    // Addons call registerActionHandler, so bw_shop_main sits in the same registry as
    // the 14 builtins. Written as its own action block it is correct, and the only
    // thing worth saying is that it needs the addon installed.
    setActiveFormBedrock({
      type: "SIMPLE",
      title: "Form",
      content: "",
      buttons: [{ id: "a", text: "A", onClick: [{ id: "act1", params: {}, raw: "bw_shop_main {\n}" }] }]
    });
    const { container } = renderExpanded();
    expect(container.textContent).not.toContain("unknown action type");
    expect(container.textContent).toContain("Bedwars Addon");
    expect(container.textContent).toContain("BedrockGUI-BedwarsAddon.jar");
    expect(container.textContent).toContain("only runs on servers with that addon installed");
  });

  it("recognises an addon action type on a CUSTOM component too", () => {
    setActiveFormBedrock({
      type: "CUSTOM",
      title: "Form",
      content: "",
      components: [
        { id: "comp_1", type: "input", props: {}, action: [{ id: "act1", params: {}, raw: "hs_welcome {\n}" }] }
      ]
    });
    const { container } = renderExpanded();
    expect(container.textContent).not.toContain("unknown action type");
    expect(container.textContent).toContain("Homestead Addon");
  });

  it("resolves an addon action type that carries a payload", () => {
    setActiveFormBedrock({
      type: "SIMPLE",
      title: "Form",
      content: "",
      buttons: [{ id: "a", text: "A", onClick: [{ id: "act1", params: {}, raw: "hs_region_menu:spawn" }] }]
    });
    const { container } = renderExpanded();
    expect(container.textContent).not.toContain("unknown action type");
    expect(container.textContent).toContain("Homestead Addon");
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

  it("says nothing about a SIMPLE form with zero buttons — the plugin allows it", () => {
    // ConfigValidator.validateButtons (ConfigValidator.java:97-104) warns about an
    // empty button list only when the form type is modal. An empty SIMPLE form loads
    // and opens, so calling it an error put a red mark on a valid config.
    setActiveFormBedrock({
      type: "SIMPLE",
      title: "Form",
      content: "",
      buttons: []
    });
    const { container } = renderExpanded();
    expect(container.textContent).toContain("No validation issues");
    expect(container.textContent).not.toContain("button");
  });

  it("says nothing about a CUSTOM form with zero components — the plugin allows it", () => {
    // validateFormTypeSpecific's CUSTOM branch is `case "custom": break;`.
    setActiveFormBedrock({
      type: "CUSTOM",
      title: "Form",
      content: "",
      components: []
    });
    const { container } = renderExpanded();
    expect(container.textContent).toContain("No validation issues");
    expect(container.textContent).not.toContain("component");
  });

  it("reports a button with empty text, even though the schema now accepts it", () => {
    setActiveFormBedrock({
      type: "SIMPLE",
      title: "Form",
      content: "",
      buttons: [{ id: "a", text: "" }]
    });
    const { container } = renderExpanded();
    expect(container.textContent).toContain("Button 'a': text is required");
  });
});
