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
        type: "NOT_A_REAL_TYPE",
        title: "Broken",
        buttons: [{ id: "a", text: "A" }]
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
    } finally {
      localStorage.removeItem("project_broken");
      useToastStore.setState({ toasts: [] });
    }
  });

  it("loads a legacy MODAL with 3 buttons as a work-in-progress state instead of refusing it", () => {
    const WIP_LEGACY = {
      configVersion: "1.0.0",
      menuName: "wip",
      platform: "bedrock",
      bedrock: {
        type: "MODAL",
        title: "Wip",
        buttons: [
          { id: "a", text: "A" },
          { id: "b", text: "B" },
          { id: "c", text: "C" }
        ]
      }
    };
    localStorage.setItem("project_wip", JSON.stringify(WIP_LEGACY));
    useToastStore.setState({ toasts: [] });

    try {
      wrap(<TopBar />);
      fireEvent.click(screen.getByText("example"));
      fireEvent.click(screen.getByText("wip"));

      const st = useDesignerStore.getState();
      expect(st.project.activeFormId).toBe("wip");
      expect((st.activeForm().bedrock as any).buttons).toHaveLength(3);

      const errorToast = useToastStore.getState().toasts.find((t) => t.variant === "error");
      expect(errorToast).toBeUndefined();
    } finally {
      localStorage.removeItem("project_wip");
      useToastStore.setState({ toasts: [] });
    }
  });

  it("refuses to save a structurally invalid project and does not touch localStorage", () => {
    useDesignerStore.setState((s: any) => ({
      project: {
        ...s.project,
        forms: [
          {
            ...s.project.forms[0],
            bedrock: {
              type: "NOT_A_REAL_TYPE",
              title: "Example Form",
              content: "Content"
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

  it("saves a work-in-progress project (0-component CUSTOM form) now that structural validity and plugin-readiness are separate", () => {
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

      expect(localStorage.getItem("project_example")).not.toBeNull();
      const successToast = useToastStore.getState().toasts.find((t) => t.variant === "success");
      expect(successToast?.message).toContain("saved");
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

  it("mints a unique id when Add reuses a removed button's slot, so no button is lost on export", () => {
    useDesignerStore.setState((s: any) => ({
      project: {
        ...s.project,
        forms: [
          {
            ...s.project.forms[0],
            bedrock: {
              type: "SIMPLE",
              title: "Example Form",
              content: "Content",
              buttons: [
                { id: "button_1", text: "First" },
                { id: "button_2", text: "Second" }
              ]
            }
          }
        ]
      }
    }));

    wrap(<PropertiesPanel />);
    fireEvent.click(screen.getAllByText("Remove")[0]);
    fireEvent.click(screen.getByText("Add"));

    const buttons = (useDesignerStore.getState().activeForm().bedrock as any).buttons;
    const ids = buttons.map((b: any) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(buttons).toHaveLength(2);
    expect(buttons.find((b: any) => b.text === "Second")).toBeDefined();
  });

  it("refuses a button id rename that collides with an existing button id", () => {
    useDesignerStore.setState((s: any) => ({
      project: {
        ...s.project,
        forms: [
          {
            ...s.project.forms[0],
            bedrock: {
              type: "SIMPLE",
              title: "Example Form",
              content: "Content",
              buttons: [
                { id: "button_1", text: "First" },
                { id: "button_2", text: "Second" }
              ]
            }
          }
        ]
      }
    }));

    wrap(<PropertiesPanel />);
    const secondIdInput = screen.getByDisplayValue("button_2") as HTMLInputElement;
    fireEvent.change(secondIdInput, { target: { value: "button_1" } });
    fireEvent.blur(secondIdInput);

    const buttons = (useDesignerStore.getState().activeForm().bedrock as any).buttons;
    expect(buttons.map((b: any) => b.id)).toEqual(["button_1", "button_2"]);
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

