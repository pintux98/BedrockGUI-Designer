import { describe, it, expect, beforeEach } from "vitest";
import { useDesignerStore } from "../store";
import { createEmptyProject } from "../core/project";

describe("designer store", () => {
  beforeEach(() => {
    useDesignerStore.getState().loadProject(createEmptyProject());
  });

  it("adds a form and leaves the active form alone", () => {
    const before = useDesignerStore.getState().project.activeFormId;
    useDesignerStore.getState().addForm("shop");
    const state = useDesignerStore.getState();
    expect(state.project.forms.map((f) => f.id)).toContain("shop");
    expect(state.project.activeFormId).toBe(before);
  });

  it("refuses a duplicate form id", () => {
    useDesignerStore.getState().addForm("shop");
    useDesignerStore.getState().addForm("shop");
    expect(useDesignerStore.getState().project.forms.filter((f) => f.id === "shop")).toHaveLength(1);
  });

  it("renames a form and its file", () => {
    useDesignerStore.getState().renameForm("main_menu", "hub");
    const form = useDesignerStore.getState().project.forms[0];
    expect(form.id).toBe("hub");
    expect(form.fileName).toBe("hub.yml");
  });

  it("undoes a title change on the active form only", () => {
    useDesignerStore.getState().addForm("shop");
    const active = useDesignerStore.getState().activeForm();
    useDesignerStore.getState().setBedrock({ ...active.bedrock, title: "Changed" });
    expect(useDesignerStore.getState().activeForm().bedrock.title).toBe("Changed");
    useDesignerStore.getState().undo();
    expect(useDesignerStore.getState().activeForm().bedrock.title).toBe("New Form");
    expect(useDesignerStore.getState().project.forms.map((f) => f.id)).toContain("shop");
  });

  it("redoes what it undid", () => {
    const active = useDesignerStore.getState().activeForm();
    useDesignerStore.getState().setBedrock({ ...active.bedrock, title: "Changed" });
    useDesignerStore.getState().undo();
    useDesignerStore.getState().redo();
    expect(useDesignerStore.getState().activeForm().bedrock.title).toBe("Changed");
  });

  it("keeps undo history across a rename", () => {
    const active = useDesignerStore.getState().activeForm();
    useDesignerStore.getState().setBedrock({ ...active.bedrock, title: "Changed" });
    useDesignerStore.getState().renameForm("main_menu", "hub");

    const beforeUndo = useDesignerStore.getState();
    expect(beforeUndo.history["hub"]?.undo).toHaveLength(1);
    expect(beforeUndo.history["main_menu"]).toBeUndefined();

    useDesignerStore.getState().undo();
    const after = useDesignerStore.getState();
    expect(after.project.activeFormId).toBe("hub");
    expect(after.activeForm().id).toBe("hub");
    expect(after.activeForm().bedrock.title).toBe("New Form");
    expect(after.project.forms.map((f) => f.id)).toEqual(["hub"]);
  });

  it("marks the project dirty on mutation", () => {
    expect(useDesignerStore.getState().dirty).toBe(false);
    const active = useDesignerStore.getState().activeForm();
    useDesignerStore.getState().setBedrock({ ...active.bedrock, title: "Changed" });
    expect(useDesignerStore.getState().dirty).toBe(true);
  });

  it("clears selection on undo and redo", () => {
    const active = useDesignerStore.getState().activeForm();
    useDesignerStore.getState().setBedrock({ ...active.bedrock, title: "Changed" });
    useDesignerStore.getState().setSelectedBedrockButtonId("button_1");
    useDesignerStore.getState().setSelectedBedrockComponentId("comp_1");

    useDesignerStore.getState().undo();
    expect(useDesignerStore.getState().selectedBedrockButtonId).toBeNull();
    expect(useDesignerStore.getState().selectedBedrockComponentId).toBeNull();

    useDesignerStore.getState().setSelectedBedrockButtonId("button_1");
    useDesignerStore.getState().setSelectedBedrockComponentId("comp_1");
    useDesignerStore.getState().redo();
    expect(useDesignerStore.getState().selectedBedrockButtonId).toBeNull();
    expect(useDesignerStore.getState().selectedBedrockComponentId).toBeNull();
  });
});
