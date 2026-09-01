import React from "react";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { useDesignerStore } from "../core/store";
import { useToastStore } from "../core/toast";
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

  it("refuses to load a legacy save that still fails validation after migration", () => {
    const CORRUPT_LEGACY = {
      configVersion: "1.0.0",
      menuName: "broken",
      platform: "bedrock",
      bedrock: {
        type: "MODAL",
        title: "Broken",
        buttons: [
          { id: "a", text: "A" },
          { id: "b", text: "B" },
          { id: "c", text: "C" }
        ]
      }
    };
    localStorage.setItem("project_broken", JSON.stringify(CORRUPT_LEGACY));
    useToastStore.setState({ toasts: [] });

    try {
      wrap(<TopBar />);
      fireEvent.click(screen.getByText("example"));
      fireEvent.click(screen.getByText("broken"));

      const st = useDesignerStore.getState();
      expect(st.project.activeFormId).toBe("example");
      expect(st.project.forms.map((f) => f.id)).toEqual(["example"]);

      const errorToast = useToastStore.getState().toasts.find((t) => t.variant === "error");
      expect(errorToast?.message).toContain("broken");
      expect(errorToast?.message).toContain("old format");
      expect(errorToast?.message).toContain("could not be migrated");
      expect(errorToast?.message).toContain("buttons");
    } finally {
      localStorage.removeItem("project_broken");
      useToastStore.setState({ toasts: [] });
    }
  });

  it("refuses to save an invalid project and does not touch localStorage", () => {
    useDesignerStore.setState((s: any) => ({
      project: {
        ...s.project,
        forms: [
          {
            ...s.project.forms[0],
            bedrock: {
              type: "CUSTOM",
              title: "Example Form",
              content: "Content",
              components: []
            }
          }
        ]
      }
    }));
    useToastStore.setState({ toasts: [] });
    localStorage.removeItem("project_example");

    try {
      wrap(<TopBar />);
      window.dispatchEvent(new Event("save-project"));

      expect(localStorage.getItem("project_example")).toBeNull();
      const errorToast = useToastStore.getState().toasts.find((t) => t.variant === "error");
      expect(errorToast?.message).toContain("example");
      expect(errorToast?.message).toContain("not saved");
    } finally {
      localStorage.removeItem("project_example");
      useToastStore.setState({ toasts: [] });
    }
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

