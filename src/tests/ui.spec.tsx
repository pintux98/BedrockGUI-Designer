import React from "react";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { useDesignerStore } from "../core/store";
import { PropertiesPanel } from "../panels/PropertiesPanel";
import { StyleGuidePanel } from "../panels/StyleGuidePanel";
import { TopBar } from "../app/TopBar";

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

describe("ui panels", () => {
  afterEach(() => cleanup());

  it("renders style guide panel", () => {
    wrap(<StyleGuidePanel />);
    expect(screen.getByText("UI Guide")).toBeInTheDocument();
    expect(screen.getByText("Buttons")).toBeInTheDocument();
    expect(screen.getByText("Primary")).toBeInTheDocument();
  });

  it("renders top bar without crashing", () => {
    wrap(<TopBar />);
    expect(screen.getByText("BEDROCK")).toBeInTheDocument();
    expect(screen.getByText("GUI")).toBeInTheDocument();
    expect(screen.getByText("Export")).toBeInTheDocument();
  });

  it("action editor adds an action and updates store", () => {
    wrap(<PropertiesPanel />);
    fireEvent.click(screen.getAllByText("+ Add Action")[0]);
    fireEvent.click(screen.getByText("Message"));
    const textarea = screen.getByPlaceholderText("e.g. &aHello, {player}!") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.blur(textarea);
    const st = useDesignerStore.getState();
    expect(st.activeForm().bedrock?.type).toBe("SIMPLE");
    const actions = (st.activeForm().bedrock as any).buttons[0].onClick;
    expect(Array.isArray(actions)).toBe(true);
    expect(actions[0].raw).toContain("message");
    expect(actions[0].raw).toContain("Hello");
  });

  it("bedrock button text supports new lines", () => {
    wrap(<PropertiesPanel />);
    const textarea = screen.getAllByPlaceholderText("text (supports new lines)")[0] as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Line1\nLine2" } });
    fireEvent.blur(textarea);
    const st = useDesignerStore.getState() as any;
    expect(st.activeForm().bedrock.buttons[0].text).toBe("Line1\nLine2");
  });

  it("action editor supports bungee action blocks", () => {
    wrap(<PropertiesPanel />);
    fireEvent.click(screen.getAllByText("+ Add Action")[0]);
    fireEvent.click(screen.getByText("Bungee"));
    const sub = screen.getByPlaceholderText("subchannel (e.g. Connect)") as HTMLInputElement;
    fireEvent.change(sub, { target: { value: "Connect" } });
    fireEvent.blur(sub);
    const args = screen.getByPlaceholderText("e.g. Lobby") as HTMLTextAreaElement;
    fireEvent.change(args, { target: { value: "lobby" } });
    fireEvent.blur(args);
    const st = useDesignerStore.getState() as any;
    const actions = st.activeForm().bedrock.buttons[0].onClick;
    expect(actions[0].raw).toContain("bungee");
    expect(actions[0].raw).toContain('subchannel: "Connect"');
    expect(actions[0].raw).toContain('"lobby"');
  });
});

