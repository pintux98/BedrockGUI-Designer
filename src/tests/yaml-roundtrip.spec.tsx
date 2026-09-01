import React from "react";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup, screen } from "@testing-library/react";
import { useDesignerStore } from "../core/store";
import { YamlEditorPanel } from "../panels/YamlEditorPanel";
import { DndContext } from "@dnd-kit/core";
import { yamlToStateDoc, deserializeActions } from "../core/yaml";

function wrap(ui: React.ReactElement) {
  return render(<DndContext>{ui}</DndContext>);
}

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
            command: "/example",
            commandIntercept: "/example",
            buttons: [
              {
                id: "button_1",
                text: "Click me",
                showCondition: "permission:bedrockgui.use",
                alternativeText: "No perms",
                conditions: [{ id: "c1", condition: "permission:bedrockgui.use", property: "text", value: "Has perms" }]
              }
            ],
            globalActions: [{ id: "raw", params: 'message {\n  - "Hello"\n}', raw: 'message {\n  - "Hello"\n}' }]
          }
        }
      ]
    },
    history: {}
  } as any);
});

afterEach(() => cleanup());

describe("yaml roundtrip", () => {
  it("exports new fields into YAML snippet", () => {
    wrap(<YamlEditorPanel />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toContain("command_intercept");
    expect(textarea.value).toContain("global_actions");
    expect(textarea.value).toContain("show_condition");
  });

  it("imports new fields from YAML snippet into store", () => {
    const yaml = [
      "bedrock:",
      "  type: SIMPLE",
      "  title: Example Form",
      "  command: /example",
      "  command_intercept: /example",
      "  description: Content",
      "  global_actions:",
      "    - 'message {",
      '      - "Hello"',
      "      }'",
      "  buttons:",
      "    button_1:",
      "      text: Click me",
      "      show_condition: permission:bedrockgui.use",
      "      alternative_text: No perms",
      "      conditions:",
      "        c1:",
      "          condition: permission:bedrockgui.use",
      "          property: text",
      "          value: Has perms",
      ""
    ].join("\n");

    const { entry } = yamlToStateDoc(yaml);
    expect(entry.bedrock.command_intercept).toBe("/example");
    const globalActions = deserializeActions(entry.bedrock.global_actions);
    expect(globalActions?.length).toBe(1);
    expect(entry.bedrock.buttons.button_1.show_condition).toBe("permission:bedrockgui.use");
    expect(entry.bedrock.buttons.button_1.conditions).toHaveProperty("c1");
    expect(entry.bedrock.buttons.button_1.conditions.c1.condition).toBe("permission:bedrockgui.use");
  });
});

