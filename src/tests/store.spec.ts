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

describe("history granularity", () => {
  const s = () => useDesignerStore.getState();

  beforeEach(() => {
    s().loadProject(createEmptyProject());
  });

  function buttons() {
    const bedrock = s().activeForm().bedrock;
    if (bedrock.type === "CUSTOM") throw new Error("the empty project's form should have buttons");
    return bedrock;
  }

  function addButton(id: string) {
    const bedrock = buttons();
    s().setBedrock({ ...bedrock, buttons: [...bedrock.buttons, { id, text: id }] }, "Added button");
  }

  function setButtonText(id: string, text: string) {
    const bedrock = buttons();
    s().setBedrock(
      { ...bedrock, buttons: bedrock.buttons.map((b) => (b.id === id ? { ...b, text } : b)) },
      "Updated button text"
    );
  }

  function setTitle(title: string) {
    s().setBedrock({ ...s().activeForm().bedrock, title }, "Updated title");
  }

  function buttonIds() {
    return buttons().buttons.map((b) => b.id);
  }

  function buttonText(id: string) {
    return buttons().buttons.find((b) => b.id === id)?.text;
  }

  function undoStack() {
    return s().history[s().project.activeFormId]?.undo ?? [];
  }

  // A description is not an identity. Two Add clicks push the same string, so
  // merging on it made one ctrl+z remove both buttons.
  it("keeps two Add button clicks as two undo steps", () => {
    addButton("button_2");
    addButton("button_3");
    expect(undoStack()).toHaveLength(2);

    s().undo();
    expect(buttonIds()).toEqual(["button_1", "button_2"]);
    s().undo();
    expect(buttonIds()).toEqual(["button_1"]);
  });

  // Same string, different subject: editing two buttons in quick succession
  // must not let one ctrl+z revert both.
  it("keeps edits to two different buttons as two undo steps", () => {
    addButton("button_2");
    setButtonText("button_1", "First");
    setButtonText("button_2", "Second");
    expect(undoStack()).toHaveLength(3);

    s().undo();
    expect(buttonText("button_2")).toBe("button_2");
    expect(buttonText("button_1")).toBe("First");
    s().undo();
    expect(buttonText("button_1")).toBe("Click me");
  });

  // No wall-clock window either: a burst is still one step per push, however
  // fast it lands. Editors that fire per keystroke buffer their own writes.
  it("keeps a rapid burst of same-description edits as one step each", () => {
    setTitle("s");
    setTitle("sh");
    setTitle("sho");
    setTitle("shop");
    expect(undoStack()).toHaveLength(4);

    s().undo();
    expect(s().activeForm().bedrock.title).toBe("sho");
  });

  it("caps the per-form undo stack so a long session cannot grow without bound", () => {
    for (let i = 0; i < 140; i++) setTitle(`t${i}`);
    expect(undoStack()).toHaveLength(100);
  });

  // The 1a scenario: a form edit, a structural change, then another form edit.
  // Refreshing a merged entry's timestamp sorted it past the project entry, so
  // the second undo restored a project snapshot holding the value just undone.
  it("undoes a form edit and a structural change in strict reverse order", () => {
    setTitle("A");
    s().addForm("shop");
    setTitle("B");
    expect(s().activeForm().bedrock.title).toBe("B");

    s().undo();
    expect(s().activeForm().bedrock.title).toBe("A");
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);

    s().undo();
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu"]);
    expect(s().activeForm().bedrock.title).toBe("A");

    s().undo();
    expect(s().activeForm().bedrock.title).toBe("New Form");
    expect(undoStack()).toEqual([]);
  });
});

describe("undo spans every form, not just the active one", () => {
  const s = () => useDesignerStore.getState();

  beforeEach(() => {
    s().loadProject(createEmptyProject());
  });

  function setTitle(title: string) {
    s().setBedrock({ ...s().activeForm().bedrock, title }, "Updated title");
  }

  function titleOf(id: string) {
    return s().project.forms.find((f) => f.id === id)?.bedrock.title;
  }

  // Finding 2. With the active form's stack empty, undo used to fall through to
  // project history unconditionally and delete the form on screen, while the
  // newer edit it should have reverted survived.
  it("does not delete the form on screen when that form has no history", () => {
    s().addForm("shop");
    setTitle("Edited");
    s().setActiveForm("shop");

    s().undo();
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);
    expect(titleOf("main_menu")).toBe("New Form");
  });

  it("undoes the newest edit even when it belongs to another form, and switches to it", () => {
    s().addForm("shop");
    s().setActiveForm("shop");
    setTitle("Shop edit");
    s().setActiveForm("main_menu");
    setTitle("Main edit");
    s().setActiveForm("shop");

    s().undo();
    expect(s().project.activeFormId).toBe("main_menu");
    expect(titleOf("main_menu")).toBe("New Form");
    expect(titleOf("shop")).toBe("Shop edit");
  });

  it("redoes on the form the change belongs to, switching to it", () => {
    s().addForm("shop");
    setTitle("Main edit");
    s().undo();
    s().setActiveForm("shop");

    s().redo();
    expect(s().project.activeFormId).toBe("main_menu");
    expect(titleOf("main_menu")).toBe("Main edit");
  });
});
