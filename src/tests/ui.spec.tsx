import React from "react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent, screen, cleanup, waitFor, within } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { unzipSync } from "fflate";
import { useDesignerStore } from "../core/store";
import { createEmptyProject } from "../core/project";
import { useToastStore } from "../core/toast";
import { PropertiesPanel } from "../panels/PropertiesPanel";
import { Outline } from "../panels/Outline";
import { TopBar } from "../app/TopBar";

function wrap(ui: React.ReactElement) {
  return render(<DndContext>{ui}</DndContext>);
}

function pressCtrlS() {
  fireEvent.keyDown(window, { key: "s", ctrlKey: true });
}

function selectButton(id: string) {
  useDesignerStore.setState({ selectedBedrockButtonId: id, selectedBedrockComponentId: null } as any);
}

beforeEach(() => {
  useDesignerStore.setState({
    project: {
      name: "example",
      pluginTarget: "2.0.12",
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

  it("renders top bar without crashing", () => {
    wrap(<TopBar />);
    expect(screen.getByText("BedrockGUI Designer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import" })).toBeInTheDocument();
  });

  it("names the project separately from its forms", () => {
    wrap(<TopBar />);
    fireEvent.click(screen.getByText("example"));
    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "My server" } });
    const st = useDesignerStore.getState();
    expect(st.project.name).toBe("My server");
    expect(st.project.forms.map((f) => f.id)).toEqual(["example"]);
  });

  it("exports a single-form project as that form's yml, named from its fileName, and the modal lists exactly that one entry", async () => {
    useDesignerStore.setState((s) => ({
      project: {
        ...s.project,
        forms: [{ ...s.project.forms[0], id: "shop", fileName: "store.yml" }],
        activeFormId: "shop"
      }
    }));
    wrap(<TopBar />);

    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    let downloadedName: string | undefined;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadedName = this.download;
      });

    try {
      fireEvent.click(screen.getByRole("button", { name: "Export" }));
      await waitFor(() => expect(createObjectURL).toHaveBeenCalled());

      expect(downloadedName).toBe("store.yml");
      const blob = createObjectURL.mock.calls[0][0] as Blob;
      expect(blob.type).toBe("text/yaml");
      expect(await blob.text()).toContain("title:");

      const dialog = await screen.findByRole("dialog", { name: /register your exported forms/i });
      expect(dialog).toHaveTextContent("plugins/BedrockGUI/config.yml");
      const snippet = screen.getByLabelText(/config registry snippet/i) as HTMLTextAreaElement;
      expect(snippet.value).toBe('forms:\n  shop:\n    file: "store.yml"\n');

      fireEvent.click(screen.getByRole("button", { name: /copy config snippet to clipboard/i }));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith('forms:\n  shop:\n    file: "store.yml"\n'));

      fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    } finally {
      createObjectURL.mockRestore();
      revokeObjectURL.mockRestore();
      clickSpy.mockRestore();
    }
  });

  it("exports a multi-form project as a zip with no config.yml, and the modal lists every exported form by id", async () => {
    useDesignerStore.setState((s) => ({
      project: {
        ...s.project,
        forms: [
          { ...s.project.forms[0], id: "main_menu", fileName: "main_menu.yml" },
          { ...s.project.forms[0], id: "shop", fileName: "store.yml" }
        ],
        activeFormId: "main_menu"
      }
    }));
    wrap(<TopBar />);

    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    let downloadedName: string | undefined;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadedName = this.download;
      });

    try {
      fireEvent.click(screen.getByRole("button", { name: "Export" }));
      await waitFor(() => expect(createObjectURL).toHaveBeenCalled());

      expect(downloadedName).toBe("bedrockgui-forms.zip");
      const blob = createObjectURL.mock.calls[0][0] as Blob;
      expect(blob.type).toBe("application/zip");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const files = unzipSync(bytes);
      expect(files["config.yml"]).toBeUndefined();
      expect(Object.keys(files).sort()).toEqual(["forms/main_menu.yml", "forms/store.yml"]);

      const dialog = await screen.findByRole("dialog", { name: /register your exported forms/i });
      const snippet = screen.getByLabelText(/config registry snippet/i) as HTMLTextAreaElement;
      expect(snippet.value).toBe(
        'forms:\n  main_menu:\n    file: "main_menu.yml"\n  shop:\n    file: "store.yml"\n'
      );
      expect(dialog).toHaveTextContent(/main_menu/);
      expect(dialog).toHaveTextContent(/shop/);
    } finally {
      createObjectURL.mockRestore();
      revokeObjectURL.mockRestore();
      clickSpy.mockRestore();
    }
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
      fireEvent.click(screen.getByText("example", { selector: "span" }));
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
      fireEvent.click(screen.getByText("example", { selector: "span" }));
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
        forms: [{ ...s.project.forms[0], bedrock: { type: "NOT_A_REAL_TYPE", title: "Example Form", content: "Content" } }]
      }
    }));
    useToastStore.setState({ toasts: [] });
    localStorage.removeItem("project_example");

    try {
      wrap(<TopBar />);
      pressCtrlS();
      expect(localStorage.getItem("project_example")).toBeNull();
      const errorToast = useToastStore.getState().toasts.find((t) => t.variant === "error");
      expect(errorToast?.message).toContain("example");
      expect(errorToast?.message).toContain("not saved");
    } finally {
      localStorage.removeItem("project_example");
      useToastStore.setState({ toasts: [] });
    }
  });

  it("saves a work-in-progress project (0-component CUSTOM form) with Ctrl+S", () => {
    useDesignerStore.setState((s: any) => ({
      project: {
        ...s.project,
        forms: [{ ...s.project.forms[0], bedrock: { type: "CUSTOM", title: "Example Form", components: [] } }]
      }
    }));
    useToastStore.setState({ toasts: [] });
    localStorage.removeItem("project_example");

    try {
      wrap(<TopBar />);
      pressCtrlS();
      expect(localStorage.getItem("project_example")).not.toBeNull();
      const successToast = useToastStore.getState().toasts.find((t) => t.variant === "success");
      expect(successToast?.message).toContain("Saved");
    } finally {
      localStorage.removeItem("project_example");
      useToastStore.setState({ toasts: [] });
    }
  });

  it("shows form settings when nothing is selected", () => {
    wrap(<PropertiesPanel />);
    expect(screen.getByText("Form settings", { selector: "h2" })).toBeInTheDocument();
    expect(screen.getByLabelText("Form title")).toHaveValue("Example Form");
    expect(screen.queryByLabelText("Button text")).toBeNull();
    expect(screen.queryByText("Bedrock")).toBeNull();
  });

  it("edits only the selected button", () => {
    selectButton("button_1");
    wrap(<PropertiesPanel />);
    expect(screen.getByLabelText("Button text")).toHaveValue("Click me");
    expect(screen.queryByLabelText("Form title")).toBeNull();
  });

  it("action editor adds an action and updates store", () => {
    selectButton("button_1");
    wrap(<PropertiesPanel />);
    fireEvent.click(screen.getAllByText("Add action")[0]);
    fireEvent.click(screen.getByText("Send a chat message"));
    const dialog = screen.getByRole("dialog", { name: "Send a chat message" });
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Hello" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add action" }));
    const actions = (useDesignerStore.getState().activeForm().bedrock as any).buttons[0].onClick;
    expect(actions[0].raw).toContain("message");
    expect(actions[0].raw).toContain("Hello");
  });

  it("bedrock button text supports new lines", () => {
    selectButton("button_1");
    wrap(<PropertiesPanel />);
    const textarea = screen.getByLabelText("Button text") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Line1\nLine2" } });
    fireEvent.blur(textarea);
    expect((useDesignerStore.getState().activeForm().bedrock as any).buttons[0].text).toBe("Line1\nLine2");
  });

  it("mints a unique id when Add reuses a removed button's slot, so no button is lost on export", () => {
    useDesignerStore.setState((s: any) => ({
      project: {
        ...s.project,
        forms: [
          {
            ...s.project.forms[0],
            bedrock: { type: "SIMPLE", title: "Example Form", content: "", buttons: [{ id: "button_1", text: "First" }, { id: "button_2", text: "Second" }] }
          }
        ]
      }
    }));
    selectButton("button_1");
    wrap(
      <>
        <Outline />
        <PropertiesPanel />
      </>
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove button" }));
    fireEvent.click(screen.getByRole("button", { name: "Add button" }));

    const buttons = (useDesignerStore.getState().activeForm().bedrock as any).buttons;
    const ids = buttons.map((b: any) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(buttons).toHaveLength(2);
    expect(buttons.find((b: any) => b.text === "Second")).toBeDefined();
    expect(useDesignerStore.getState().selectedBedrockButtonId).toBe(ids[1]);
  });

  it("refuses a button id rename that collides with an existing button id", () => {
    useDesignerStore.setState((s: any) => ({
      project: {
        ...s.project,
        forms: [
          {
            ...s.project.forms[0],
            bedrock: { type: "SIMPLE", title: "Example Form", content: "", buttons: [{ id: "button_1", text: "First" }, { id: "button_2", text: "Second" }] }
          }
        ]
      }
    }));
    selectButton("button_2");
    wrap(<PropertiesPanel />);
    const idInput = screen.getByLabelText("Button ID") as HTMLInputElement;
    fireEvent.change(idInput, { target: { value: "button_1" } });
    fireEvent.blur(idInput);
    const buttons = (useDesignerStore.getState().activeForm().bedrock as any).buttons;
    expect(buttons.map((b: any) => b.id)).toEqual(["button_1", "button_2"]);
  });

  it("sends a player to another server through the wizard", () => {
    selectButton("button_1");
    wrap(<PropertiesPanel />);
    fireEvent.click(screen.getAllByText("Add action")[0]);
    fireEvent.click(screen.getByText("Send to another server"));
    const dialog = screen.getByRole("dialog", { name: "Send to another server" });
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "lobby" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add action" }));
    const raw = (useDesignerStore.getState() as any).activeForm().bedrock.buttons[0].onClick[0].raw;
    expect(raw).toBe('bungee {\n  subchannel: "Connect"\n  - "lobby"\n}');
  });

  it("action editor still edits any bungee subchannel after it is added", () => {
    selectButton("button_1");
    wrap(<PropertiesPanel />);
    fireEvent.click(screen.getAllByText("Add action")[0]);
    fireEvent.click(screen.getByText("Send to another server"));
    const dialog = screen.getByRole("dialog", { name: "Send to another server" });
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "x" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add action" }));
    const sub = screen.getByLabelText("Subchannel") as HTMLInputElement;
    fireEvent.change(sub, { target: { value: "Message" } });
    fireEvent.blur(sub);
    const arg = screen.getByLabelText("Arg 1") as HTMLInputElement;
    fireEvent.change(arg, { target: { value: "lobby" } });
    fireEvent.blur(arg);
    const actions = (useDesignerStore.getState() as any).activeForm().bedrock.buttons[0].onClick;
    expect(actions[0].raw).toContain("bungee");
    expect(actions[0].raw).toContain('subchannel: "Message"');
    expect(actions[0].raw).toContain('"lobby"');
  });

  it("labels each conditional-override property select so multiple rules stay distinguishable", () => {
    selectButton("button_1");
    wrap(<PropertiesPanel />);
    fireEvent.click(screen.getByText("Add override"));
    fireEvent.click(screen.getByText("Add override"));
    expect(screen.getByRole("combobox", { name: /rule 1 property/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /rule 2 property/i })).toBeInTheDocument();
  });

  it("edits the 2.0.12 form keys: open condition message, cooldown and on close", () => {
    useDesignerStore.setState((s: any) => ({
      project: { ...s.project, forms: [{ ...s.project.forms[0], bedrock: { ...s.project.forms[0].bedrock, openCondition: "plugin:Vault" } }] }
    }));
    wrap(<PropertiesPanel />);
    const cooldown = screen.getByLabelText("Form cooldown");
    fireEvent.change(cooldown, { target: { value: "3s" } });
    fireEvent.blur(cooldown);
    const message = screen.getByLabelText("Open condition message");
    fireEvent.change(message, { target: { value: "Needs Vault" } });
    fireEvent.blur(message);
    const form = useDesignerStore.getState().activeForm().bedrock;
    expect(form.cooldown).toBe("3s");
    expect(form.openConditionMessage).toBe("Needs Vault");
    expect(screen.getByText("On close")).toBeInTheDocument();
  });
});

describe("outline add affordances by form type", () => {
  afterEach(() => cleanup());

  function setBedrock(bedrock: unknown) {
    useDesignerStore.setState((s: any) => ({
      project: { ...s.project, forms: [{ ...s.project.forms[0], bedrock }] }
    }));
  }

  it("offers Add button on a SIMPLE form", () => {
    wrap(<Outline />);
    expect(screen.getByRole("button", { name: "Add button" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add field" })).toBeNull();
  });

  it("offers all six field types on a CUSTOM form, including label and step slider", () => {
    setBedrock({ type: "CUSTOM", title: "Example Form", components: [] });
    wrap(<Outline />);
    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    expect(screen.getAllByRole("menuitem")).toHaveLength(6);
    fireEvent.click(screen.getByRole("menuitem", { name: /Step slider/ }));
    const form = useDesignerStore.getState().activeForm().bedrock as any;
    expect(form.components[0].type).toBe("step_slider");
    expect(useDesignerStore.getState().selectedBedrockComponentId).toBe(form.components[0].id);
  });

  it("offers nothing to add on a MODAL form, only a note explaining why", () => {
    setBedrock({ type: "MODAL", title: "Example Form", content: "", buttons: [{ id: "yes", text: "Yes" }, { id: "no", text: "No" }] });
    wrap(<Outline />);
    expect(screen.queryByRole("button", { name: "Add button" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add field" })).toBeNull();
    expect(screen.getByText(/exactly two buttons/i)).toBeInTheDocument();
  });
});

describe("reorder affordances tell the truth about what can be reordered", () => {
  beforeEach(() => {
    useDesignerStore.getState().loadProject(createEmptyProject());
  });
  afterEach(() => cleanup());

  it("offers a drag handle for SIMPLE buttons", () => {
    useDesignerStore.getState().setBedrock(
      { type: "SIMPLE", title: "t", content: "", buttons: [{ id: "a", text: "A" }, { id: "b", text: "B" }] },
      "setup"
    );
    wrap(<Outline />);
    expect(screen.getByLabelText("Reorder a")).toBeInTheDocument();
    expect(screen.getByLabelText("Reorder b")).toBeInTheDocument();
  });

  it("offers no drag handle for MODAL buttons, which cannot be reordered", () => {
    useDesignerStore.getState().setBedrock(
      { type: "MODAL", title: "t", content: "", buttons: [{ id: "yes", text: "Yes" }, { id: "no", text: "No" }] },
      "setup"
    );
    wrap(<Outline />);
    expect(screen.queryByLabelText("Reorder yes")).toBeNull();
  });
});
