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
    expect(after.project.activeFormId).toBe("main_menu");
    expect(after.activeForm().id).toBe("main_menu");
    expect(after.activeForm().bedrock.title).toBe("Changed");
    expect(after.project.forms.map((f) => f.id)).toEqual(["main_menu"]);
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

  it("undoes a form deletion", () => {
    const s = () => useDesignerStore.getState();
    s().loadProject(createEmptyProject());
    s().addForm("shop");
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);
    s().removeForm("shop");
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu"]);
    s().undo();
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);
  });

  it("undoes an add, a rename and a duplicate", () => {
    const s = () => useDesignerStore.getState();
    s().loadProject(createEmptyProject());
    s().addForm("shop");
    s().undo();
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu"]);
    s().renameForm("main_menu", "hub");
    s().undo();
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu"]);
    s().duplicateForm("main_menu");
    s().undo();
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu"]);
  });

  it("keeps content undo working alongside structural undo", () => {
    const s = () => useDesignerStore.getState();
    s().loadProject(createEmptyProject());
    const before = s().activeForm().bedrock.title;
    s().setBedrock({ ...s().activeForm().bedrock, title: "Changed" });
    s().addForm("shop");
    s().undo();
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu"]);
    s().undo();
    expect(s().activeForm().bedrock.title).toBe(before);
  });

  it("caps the project history at 20 entries", () => {
    const s = () => useDesignerStore.getState();
    s().loadProject(createEmptyProject());
    for (let i = 0; i < 30; i++) s().addForm(`form_${i}`);
    expect(s().projectHistory.undo.length).toBe(20);
  });

  it("keeps a form's content history intact across an undone rename", () => {
    const s = () => useDesignerStore.getState();
    s().loadProject(createEmptyProject());
    const before = s().activeForm().bedrock.title;
    s().setBedrock({ ...s().activeForm().bedrock, title: "Changed" });
    s().renameForm("main_menu", "hub");
    s().undo();
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu"]);
    expect(s().activeForm().bedrock.title).toBe("Changed");
    s().undo();
    expect(s().activeForm().bedrock.title).toBe(before);
  });

  it("keeps a deleted form's content history intact after undoing the deletion", () => {
    const s = () => useDesignerStore.getState();
    s().loadProject(createEmptyProject());
    s().addForm("shop");
    s().setActiveForm("shop");
    const before = s().activeForm().bedrock.title;
    s().setBedrock({ ...s().activeForm().bedrock, title: "Changed" });
    s().removeForm("shop");
    s().undo();
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);
    expect(s().activeForm().id).toBe("shop");
    expect(s().activeForm().bedrock.title).toBe("Changed");
    s().undo();
    expect(s().activeForm().bedrock.title).toBe(before);
  });

  it("keeps the project history cap after entries carry per-form history", () => {
    const s = () => useDesignerStore.getState();
    s().loadProject(createEmptyProject());
    s().setBedrock({ ...s().activeForm().bedrock, title: "Changed" });
    for (let i = 0; i < 30; i++) s().addForm(`form_${i}`);
    expect(s().projectHistory.undo.length).toBe(20);
  });
});
