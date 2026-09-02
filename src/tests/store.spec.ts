import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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

  it("invalidates a stale structural redo when a new content edit follows an undo", () => {
    const s = () => useDesignerStore.getState();
    s().loadProject(createEmptyProject());
    s().addForm("shop");
    s().removeForm("shop");
    s().undo();
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);
    expect(s().projectHistory.redo[0]?.description).toBe("Deleted form shop");

    s().setActiveForm("shop");
    s().setBedrock({ ...s().activeForm().bedrock, title: "UserEditedAfterUndo" });
    expect(s().projectHistory.redo).toEqual([]);

    s().redo();
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);
    expect(s().activeForm().bedrock.title).toBe("UserEditedAfterUndo");
  });

  it("invalidates a stale content redo when a new form is added after an undo", () => {
    const s = () => useDesignerStore.getState();
    s().loadProject(createEmptyProject());
    const before = s().activeForm().bedrock.title;
    s().setBedrock({ ...s().activeForm().bedrock, title: "ContentEdit" });
    s().undo();
    expect(s().activeForm().bedrock.title).toBe(before);
    expect(s().history["main_menu"].redo[0]?.form.bedrock.title).toBe("ContentEdit");

    s().addForm("shop");
    expect(s().history["main_menu"].redo).toEqual([]);

    s().redo();
    expect(s().activeForm().bedrock.title).toBe(before);
  });

  it("clears every form's redo stack when any new action is pushed", () => {
    const s = () => useDesignerStore.getState();
    s().loadProject(createEmptyProject());
    s().addForm("shop");
    s().setBedrock({ ...s().activeForm().bedrock, title: "A1" });
    s().setActiveForm("shop");
    s().setBedrock({ ...s().activeForm().bedrock, title: "B1" });
    s().undo();
    s().setActiveForm("main_menu");
    s().undo();
    expect(s().history["main_menu"].redo[0]?.form.bedrock.title).toBe("A1");
    expect(s().history["shop"].redo[0]?.form.bedrock.title).toBe("B1");

    s().addForm("extra");
    expect(s().history["main_menu"].redo).toEqual([]);
    expect(s().history["shop"].redo).toEqual([]);

    s().setActiveForm("main_menu");
    s().redo();
    expect(s().activeForm().bedrock.title).toBe("New Form");
    s().setActiveForm("shop");
    s().redo();
    expect(s().activeForm().bedrock.title).toBe("New Form");
  });
});

describe("history coalescing", () => {
  beforeEach(() => {
    vi.useRealTimers();
    useDesignerStore.getState().loadProject(createEmptyProject());
  });

  afterEach(() => vi.useRealTimers());

  function setTitle(title: string, description: string) {
    const s = useDesignerStore.getState();
    s.setBedrock({ ...s.activeForm().bedrock, title }, description);
  }

  function undoStack() {
    const s = useDesignerStore.getState();
    return s.history[s.project.activeFormId]?.undo ?? [];
  }

  it("collapses a burst of same-description edits into one undo step", () => {
    setTitle("s", "Updated title");
    setTitle("sh", "Updated title");
    setTitle("sho", "Updated title");
    setTitle("shop", "Updated title");
    expect(undoStack()).toHaveLength(1);
  });

  it("undoes a coalesced burst back to before the burst began, not one keystroke", () => {
    const original = useDesignerStore.getState().activeForm().bedrock.title;
    setTitle("s", "Updated title");
    setTitle("sh", "Updated title");
    setTitle("shop", "Updated title");
    useDesignerStore.getState().undo();
    expect(useDesignerStore.getState().activeForm().bedrock.title).toBe(original);
  });

  it("keeps edits of different descriptions as separate steps", () => {
    setTitle("a", "Updated title");
    setTitle("b", "Updated content");
    setTitle("c", "Updated title");
    expect(undoStack()).toHaveLength(3);
  });

  it("starts a new step once the coalescing window has passed", () => {
    vi.useFakeTimers();
    setTitle("a", "Updated title");
    vi.advanceTimersByTime(1500);
    setTitle("b", "Updated title");
    expect(undoStack()).toHaveLength(2);
  });

  it("caps the per-form undo stack so a long session cannot grow without bound", () => {
    vi.useFakeTimers();
    for (let i = 0; i < 140; i++) {
      vi.advanceTimersByTime(1500);
      setTitle(`t${i}`, "Updated title");
    }
    expect(undoStack()).toHaveLength(100);
  });
});
