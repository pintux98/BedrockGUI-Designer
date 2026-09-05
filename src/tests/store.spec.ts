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

  it("carries a form's own undo stack across a rename, and still undoes only that form's edits", () => {
    const active = useDesignerStore.getState().activeForm();
    useDesignerStore.getState().setBedrock({ ...active.bedrock, title: "Changed" });
    useDesignerStore.getState().renameForm("main_menu", "hub");

    const beforeUndo = useDesignerStore.getState();
    expect(beforeUndo.history["hub"]?.undo).toHaveLength(1);
    expect(beforeUndo.history["main_menu"]).toBeUndefined();

    // undo() takes the form's own edit, not the rename that moved the stack.
    useDesignerStore.getState().undo();
    const after = useDesignerStore.getState();
    expect(after.project.activeFormId).toBe("hub");
    expect(after.project.forms.map((f) => f.id)).toEqual(["hub"]);
    expect(after.activeForm().bedrock.title).toBe("New Form");

    // The rename is structural, so only undoProject reaches it — and it restores
    // the whole snapshot, title edit included.
    useDesignerStore.getState().undoProject();
    const undone = useDesignerStore.getState();
    expect(undone.project.forms.map((f) => f.id)).toEqual(["main_menu"]);
    expect(undone.activeForm().bedrock.title).toBe("Changed");
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

  it("undoes a form deletion through undoProject, and never through undo", () => {
    const s = () => useDesignerStore.getState();
    s().loadProject(createEmptyProject());
    s().addForm("shop");
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);
    s().removeForm("shop");
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu"]);

    // ctrl+z is the form on screen and nothing else.
    s().undo();
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu"]);

    s().undoProject();
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);
  });

  it("undoes an add, a rename and a duplicate through undoProject", () => {
    const s = () => useDesignerStore.getState();
    s().loadProject(createEmptyProject());
    s().addForm("shop");
    s().undoProject();
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu"]);
    s().renameForm("main_menu", "hub");
    s().undoProject();
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu"]);
    s().duplicateForm("main_menu");
    s().undoProject();
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu"]);
  });

  it("keeps the two undos independent: content on undo, structure on undoProject", () => {
    const s = () => useDesignerStore.getState();
    s().loadProject(createEmptyProject());
    const before = s().activeForm().bedrock.title;
    s().setBedrock({ ...s().activeForm().bedrock, title: "Changed" });
    s().addForm("shop");

    // The newer change is structural, but undo() still takes the form's edit —
    // it has no view of project history at all.
    s().undo();
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);
    expect(s().activeForm().bedrock.title).toBe(before);

    // undoProject restores the whole snapshot taken when the form was added,
    // which is the world as it stood *with* the title edit applied.
    s().undoProject();
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu"]);
    expect(s().activeForm().bedrock.title).toBe("Changed");
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
    s().undoProject();
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
    s().undoProject();
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
    s().undoProject();
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);
    expect(s().projectHistory.redo[0]?.description).toBe("Deleted form shop");

    s().setActiveForm("shop");
    s().setBedrock({ ...s().activeForm().bedrock, title: "UserEditedAfterUndo" });
    expect(s().projectHistory.redo).toEqual([]);

    s().redoProject();
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

  // A form edit, a structural change, then another form edit. undo() walks the
  // form's own stack straight past the structural change and, once that stack is
  // empty, stops — it does not spill into project history the way the old
  // fall-through branch did.
  it("walks the form's own stack to the bottom and then stops", () => {
    setTitle("A");
    s().addForm("shop");
    setTitle("B");
    expect(s().activeForm().bedrock.title).toBe("B");

    s().undo();
    expect(s().activeForm().bedrock.title).toBe("A");
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);

    s().undo();
    expect(s().activeForm().bedrock.title).toBe("New Form");
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);
    expect(undoStack()).toEqual([]);

    // The stack is empty. One more ctrl+z must be inert, not a form delete.
    s().undo();
    expect(s().activeForm().bedrock.title).toBe("New Form");
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);

    // Only undoProject reaches the structural change.
    s().undoProject();
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu"]);
    expect(s().activeForm().bedrock.title).toBe("A");
  });
});

describe("undo is scoped to the form on screen", () => {
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

  // THE original bug, pinned hard. undo() read the active form's entry and, when
  // there was none, fell through to a project branch that ran unconditionally —
  // so ctrl+z on a form the user had never edited deleted a *different* form.
  // The fix is structural: there is no project branch left to fall into, so an
  // empty stack can only return the state untouched.
  it("does nothing whatsoever on a form with no history", () => {
    s().addForm("shop");
    setTitle("Edited"); // on main_menu
    s().setActiveForm("shop");
    s().setSelectedBedrockButtonId("button_1");

    s().undo();

    // No form deleted, no project history consumed, no active-form switch, and
    // the other form's edit still standing.
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);
    expect(s().projectHistory.undo.map((e) => e.description)).toEqual(["Added form shop"]);
    expect(s().projectHistory.redo).toEqual([]);
    expect(s().project.activeFormId).toBe("shop");
    expect(titleOf("main_menu")).toBe("Edited");
    expect(titleOf("shop")).toBe("New Form");
    // It returned the state object untouched, so it did not even clear selection.
    expect(s().selectedBedrockButtonId).toBe("button_1");
  });

  // "I might have changed something in a form and now to undo, it will undo
  // everything I have done globally." A newer edit on another form is not this
  // form's business.
  it("does not revert another form's newer edit", () => {
    s().addForm("shop");
    s().setActiveForm("shop");
    setTitle("Shop edit");
    s().setActiveForm("main_menu");
    setTitle("Main edit");
    s().setActiveForm("shop");

    s().undo();
    expect(s().project.activeFormId).toBe("shop");
    expect(titleOf("shop")).toBe("New Form");
    expect(titleOf("main_menu")).toBe("Main edit");
  });

  it("redoes on the form on screen and never switches away from it", () => {
    s().addForm("shop");
    setTitle("Main edit"); // on main_menu
    s().undo();
    s().setActiveForm("shop");

    // shop has no redo of its own, so this is inert — it must not replay
    // main_menu's edit, and must not jump the user back to main_menu.
    s().redo();
    expect(s().project.activeFormId).toBe("shop");
    expect(titleOf("main_menu")).toBe("New Form");
    expect(titleOf("shop")).toBe("New Form");

    s().setActiveForm("main_menu");
    s().redo();
    expect(titleOf("main_menu")).toBe("Main edit");
  });

  // The structural toast pins the entry it was raised for. Without that, a toast
  // left on screen after a newer structural change would undo the newer one.
  it("ignores a stale structural toast and honours a live one", () => {
    s().addForm("shop");
    const stale = s().projectHistory.undo[0].timestamp;
    s().addForm("bazaar");

    s().undoProject(stale);
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu", "shop", "bazaar"]);

    const live = s().projectHistory.undo[s().projectHistory.undo.length - 1].timestamp;
    s().undoProject(live);
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);
  });
});

describe("history snapshots are isolated from later edits", () => {
  const s = () => useDesignerStore.getState();

  beforeEach(() => {
    s().loadProject(createEmptyProject());
  });

  function setTitle(title: string) {
    s().setBedrock({ ...s().activeForm().bedrock, title }, "Updated title");
  }

  // pushProjectHistory stores the live `project` and `history` by reference
  // instead of deep-cloning them, which is only sound while every store write
  // REPLACES objects rather than mutating them. Reintroduce a mutation anywhere
  // in that chain — a `value.redo = []` in withClearedRedo, a `stack.undo.push`,
  // a panel editing `bedrock.buttons[i].text` in place — and the snapshot drifts
  // forward to match the live state, so the undo it exists to serve silently
  // restores the value the user was trying to get away from.
  //
  // This asserts on the retained snapshot object directly, and then on what undo
  // actually produces, because a snapshot that is merely *reachable* proves
  // nothing if the entries inside it have been rewritten underneath.
  it("keeps a project-history snapshot isolated from every later edit", () => {
    setTitle("First");
    setTitle("Second");
    s().undo();
    expect(s().activeForm().bedrock.title).toBe("First");

    s().addForm("shop");
    const snapshot = s().projectHistory.undo[s().projectHistory.undo.length - 1];
    expect(snapshot.description).toBe("Added form shop");

    // Churn the live project and the live per-form stacks well past the snapshot.
    setTitle("Third");
    s().addForm("bazaar");
    s().setAssets({ enabled: true, port: 8123, host: "cdn.example.com" });
    s().renameForm("shop", "market");

    // The retained snapshot must still describe the world as it stood at "Added
    // form shop" — one form titled "First", assets off, one undo step banked and
    // one redo step still pending on main_menu.
    expect(snapshot.project.forms.map((f) => f.id)).toEqual(["main_menu"]);
    expect(snapshot.project.forms[0].bedrock.title).toBe("First");
    expect(snapshot.project.assets.enabled).toBe(false);
    expect(snapshot.history["main_menu"].undo.map((e) => e.form.bedrock.title)).toEqual(["New Form"]);
    expect(snapshot.history["main_menu"].redo.map((e) => e.form.bedrock.title)).toEqual(["Second"]);

    // ...and walking undo back to it must restore exactly that, redo stack included.
    s().undoProject(); // Renamed form shop to market
    s().undoProject(); // Updated assets configuration
    s().undoProject(); // Added form bazaar
    s().undo(); // Updated title -> "Third"
    s().undoProject(); // Added form shop -> restores the snapshot
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu"]);
    expect(s().activeForm().bedrock.title).toBe("First");
    expect(s().project.assets.enabled).toBe(false);
    expect(s().history["main_menu"].undo.map((e) => e.form.bedrock.title)).toEqual(["New Form"]);
    expect(s().history["main_menu"].redo.map((e) => e.form.bedrock.title)).toEqual(["Second"]);
  });

  // The same invariant one level down: a per-form undo entry holds the FormDoc
  // as it was before the edit, and setBedrock must not reach into it.
  it("keeps a per-form undo entry isolated from every later edit", () => {
    setTitle("First");
    const entry = s().history["main_menu"].undo[0];
    expect(entry.form.bedrock.title).toBe("New Form");

    setTitle("Second");
    setTitle("Third");
    expect(entry.form.bedrock.title).toBe("New Form");

    s().undo();
    s().undo();
    s().undo();
    expect(s().activeForm().bedrock.title).toBe("New Form");

    // Walk it back up. Each redo entry banks the live FormDoc on its way past,
    // so if undo restored by assigning onto that FormDoc rather than replacing
    // it, all three entries end up aliasing one object and redo replays the
    // same value three times.
    s().redo();
    expect(s().activeForm().bedrock.title).toBe("First");
    s().redo();
    expect(s().activeForm().bedrock.title).toBe("Second");
    s().redo();
    expect(s().activeForm().bedrock.title).toBe("Third");
  });
});
