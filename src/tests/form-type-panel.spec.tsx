import React from "react";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { useDesignerStore } from "../core/store";
import { FormTypePanel } from "../panels/FormTypePanel";

beforeEach(() => {
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
          bedrock: {
            type: "SIMPLE",
            title: "Example Form",
            content: "Content",
            command: "example",
            commandIntercept: "intercept",
            permission: "example.use",
            globalActions: [{ id: "a1", params: {}, raw: "message: hi" }],
            buttons: [{ id: "button_1", text: "Click me" }]
          }
        }
      ]
    },
    history: {},
    dirty: false,
    selectedBedrockButtonId: null,
    selectedBedrockComponentId: null
  } as any);
});

describe("FormTypePanel type conversion", () => {
  afterEach(() => cleanup());

  it("preserves shared fields across SIMPLE -> CUSTOM -> SIMPLE", () => {
    render(<FormTypePanel />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;

    fireEvent.change(select, { target: { value: "CUSTOM" } });
    let bedrock = useDesignerStore.getState().activeForm().bedrock as any;
    expect(bedrock.type).toBe("CUSTOM");
    expect(bedrock.title).toBe("Example Form");
    expect(bedrock.content).toBe("Content");
    expect(bedrock.command).toBe("example");
    expect(bedrock.commandIntercept).toBe("intercept");
    expect(bedrock.permission).toBe("example.use");
    expect(bedrock.globalActions).toEqual([{ id: "a1", params: {}, raw: "message: hi" }]);

    fireEvent.change(select, { target: { value: "SIMPLE" } });
    bedrock = useDesignerStore.getState().activeForm().bedrock as any;
    expect(bedrock.type).toBe("SIMPLE");
    expect(bedrock.title).toBe("Example Form");
    expect(bedrock.content).toBe("Content");
    expect(bedrock.command).toBe("example");
    expect(bedrock.commandIntercept).toBe("intercept");
    expect(bedrock.permission).toBe("example.use");
    expect(bedrock.globalActions).toEqual([{ id: "a1", params: {}, raw: "message: hi" }]);
  });
});
