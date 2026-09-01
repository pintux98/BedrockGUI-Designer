import React from "react";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup, screen } from "@testing-library/react";
import { useDesignerStore } from "../core/store";
import { YamlEditorPanel } from "../panels/YamlEditorPanel";
import { DndContext } from "@dnd-kit/core";
import { parseFormDocument } from "../parse/form";

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
    expect(textarea.value).toContain("content:");
    expect(textarea.value).not.toContain("description:");
    expect(textarea.value).not.toContain("configVersion");
  });

  it("imports new fields from YAML snippet into store", () => {
    const yamlText = [
      "bedrock:",
      "  type: SIMPLE",
      "  title: Example Form",
      "  command: /example",
      "  command_intercept: /example",
      "  content: Content",
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

    const doc = parseFormDocument(yamlText, "example");
    const bedrock = doc.bedrock as any;
    expect(bedrock.commandIntercept).toBe("/example");
    expect(bedrock.globalActions?.length).toBe(1);
    const button = bedrock.buttons.find((b: any) => b.id === "button_1");
    expect(button.showCondition).toBe("permission:bedrockgui.use");
    expect(button.conditions).toHaveLength(1);
    expect(button.conditions[0].id).toBe("c1");
    expect(button.conditions[0].condition).toBe("permission:bedrockgui.use");
  });
});

