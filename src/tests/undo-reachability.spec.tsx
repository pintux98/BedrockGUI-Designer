import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { useDesignerStore } from "../store";
import { createEmptyProject } from "../core/project";
import { TopBar } from "../app/TopBar";
import { HistoryPanel } from "../panels/HistoryPanel";
import { useUndoShortcuts } from "../app/useUndoShortcuts";
import { DesignerShell } from "../app/DesignerShell";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { confirmDialog, resolveConfirm } from "../core/confirm";

function ShortcutHost() {
  useUndoShortcuts();
  return null;
}

const s = () => useDesignerStore.getState();

function edit(title: string) {
  s().setBedrock({ ...s().activeForm().bedrock, title }, "Updated title");
}

describe("the TopBar buttons describe exactly what ctrl+z does", () => {
  beforeEach(() => {
    s().loadProject(createEmptyProject());
  });
  afterEach(() => cleanup());

  it("leaves Undo disabled on an untouched project", () => {
    render(<TopBar />);
    expect(screen.getByRole("button", { name: /undo/i })).toBeDisabled();
  });

  it("enables Undo after an edit to the form on screen", () => {
    edit("Edited");
    render(<TopBar />);
    expect(screen.getByRole("button", { name: /undo/i })).toBeEnabled();
  });

  // The button *is* ctrl+z. Lighting it up for a change ctrl+z cannot make is
  // the exact lie the per-form rewrite exists to stop telling.
  it("leaves Undo disabled after a structural change", () => {
    s().addForm("shop");
    s().removeForm("shop");
    render(<TopBar />);
    expect(screen.getByRole("button", { name: /undo/i })).toBeDisabled();
  });

  it("leaves Undo disabled when only another form has edits", () => {
    edit("Edited");
    s().addForm("shop");
    s().setActiveForm("shop");
    render(<TopBar />);
    expect(screen.getByRole("button", { name: /undo/i })).toBeDisabled();
  });

  it("leaves Redo disabled after undoing a structural change", () => {
    s().addForm("shop");
    s().removeForm("shop");
    s().undoProject();
    render(<TopBar />);
    expect(screen.getByRole("button", { name: /redo/i })).toBeDisabled();
  });

  it("enables Redo after undoing an edit to the form on screen", () => {
    edit("Edited");
    s().undo();
    render(<TopBar />);
    expect(screen.getByRole("button", { name: /redo/i })).toBeEnabled();
  });

  it("reverts the form on screen when Undo is clicked, and leaves the project alone", () => {
    s().addForm("shop");
    edit("Edited");
    render(<TopBar />);
    fireEvent.click(screen.getByRole("button", { name: /undo/i }));
    expect(s().activeForm().bedrock.title).toBe("New Form");
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);
  });
});

describe("the History panel keeps the two undos apart", () => {
  beforeEach(() => {
    s().loadProject(createEmptyProject());
  });
  afterEach(() => cleanup());

  it("labels one section for this form and one for the project", () => {
    render(<HistoryPanel />);
    expect(screen.getByText("This form — main_menu")).toBeInTheDocument();
    expect(screen.getByText("Project")).toBeInTheDocument();
  });

  it("lists structural changes under Project", () => {
    s().addForm("shop");
    render(<HistoryPanel />);
    expect(screen.getByText("Added form shop")).toBeInTheDocument();
  });

  it("reverts a structural change from the Project section", () => {
    s().addForm("shop");
    s().removeForm("shop");
    render(<HistoryPanel />);
    fireEvent.click(screen.getByText("Deleted form shop"));
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);
  });

  it("reverts a form edit from the This form section without touching the project", () => {
    s().addForm("shop");
    edit("Edited");
    render(<HistoryPanel />);
    fireEvent.click(screen.getByText("Updated title"));
    expect(s().activeForm().bedrock.title).toBe("New Form");
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);
  });

  // "Revert to here" counts steps against the stack the row came from. Counting
  // against a merged timeline, as the single-list panel had to, walked a
  // different number of steps than the row promised.
  it("counts revert steps against the stack the row belongs to", () => {
    edit("One");
    s().addForm("shop");
    s().setBedrock({ ...s().activeForm().bedrock, title: "Two" }, "Retitled again");
    s().addForm("bazaar");

    render(<HistoryPanel />);
    fireEvent.click(screen.getByText("Updated title"));

    // Two form steps walked, both structural changes untouched.
    expect(s().activeForm().bedrock.title).toBe("New Form");
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu", "shop", "bazaar"]);
  });
});

describe("undo keyboard shortcuts", () => {
  beforeEach(() => {
    s().loadProject(createEmptyProject());
    render(<ShortcutHost />);
  });
  afterEach(() => cleanup());

  it("undoes an edit to the form on screen on ctrl+z", () => {
    edit("Edited");
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(s().activeForm().bedrock.title).toBe("New Form");
  });

  // The original bug, at the keystroke that caused it: the user is on a form
  // they have not touched, and presses ctrl+z. It used to delete a form.
  it("does nothing on ctrl+z when the form on screen has no edits", () => {
    s().addForm("shop");
    edit("Edited"); // on main_menu
    s().setActiveForm("shop");

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });

    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);
    expect(s().project.activeFormId).toBe("shop");
    expect(s().project.forms[0].bedrock.title).toBe("Edited");
  });

  it("does not reach a deleted form on ctrl+z", () => {
    s().addForm("shop");
    s().removeForm("shop");
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(s().project.forms.map((f) => f.id)).toEqual(["main_menu"]);
  });

  it("redoes on ctrl+y", () => {
    edit("Edited");
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    fireEvent.keyDown(window, { key: "y", ctrlKey: true });
    expect(s().activeForm().bedrock.title).toBe("Edited");
  });

  it("redoes on ctrl+shift+z", () => {
    edit("Edited");
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    fireEvent.keyDown(window, { key: "Z", ctrlKey: true, shiftKey: true });
    expect(s().activeForm().bedrock.title).toBe("Edited");
  });

  it("leaves ctrl+z to the browser inside a text field", () => {
    edit("Edited");
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "z", ctrlKey: true });
    expect(s().activeForm().bedrock.title).toBe("Edited");
    input.remove();
  });

  it("ignores a bare z", () => {
    edit("Edited");
    fireEvent.keyDown(window, { key: "z" });
    expect(s().activeForm().bedrock.title).toBe("Edited");
  });

  // AltGr reports ctrlKey AND altKey on European layouts, and ctrl+alt+z is not
  // an undo chord anywhere, so the handler must stay out of the way.
  it("ignores ctrl+alt+z", () => {
    edit("Edited");
    fireEvent.keyDown(window, { key: "z", ctrlKey: true, altKey: true });
    expect(s().activeForm().bedrock.title).toBe("Edited");
  });
});

describe("the shell actually mounts the shortcuts", () => {
  beforeEach(() => s().loadProject(createEmptyProject()));
  afterEach(() => cleanup());

  // Without this, the suite above proves only that the hook works when someone
  // calls it — not that anything does. That is the same built-but-unreachable
  // gap the shortcuts were written to close.
  it("undoes on ctrl+z with only DesignerShell rendered", () => {
    render(<DesignerShell />);
    edit("Edited");
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(s().activeForm().bedrock.title).toBe("New Form");
  });
});

describe("the shortcut yields to an open modal", () => {
  beforeEach(() => {
    s().loadProject(createEmptyProject());
    render(
      <>
        <ShortcutHost />
        <ConfirmDialog />
      </>
    );
  });
  afterEach(() => {
    act(() => resolveConfirm(false));
    cleanup();
  });

  function openConfirm() {
    act(() => {
      void confirmDialog({
        title: "Delete form form_2?",
        message:
          "Delete form 'form_2'? Ctrl+Z will not bring it back — use the Undo button on the toast that appears, or the Project section of the History panel."
      });
    });
  }

  // Dialog moves focus to its first button, so the text-entry guard never fires
  // and ctrl+z used to revert an unrelated earlier edit behind the open dialog.
  it("ignores ctrl+z while a confirm dialog is open", () => {
    s().setBedrock({ ...s().activeForm().bedrock, title: "Edited" }, "Updated title");
    openConfirm();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(s().activeForm().bedrock.title).toBe("Edited");
  });

  it("ignores ctrl+z aimed at the dialog's own focused button", () => {
    s().setBedrock({ ...s().activeForm().bedrock, title: "Edited" }, "Updated title");
    openConfirm();
    const confirmButton = screen.getByRole("button", { name: "Confirm" });

    fireEvent.keyDown(confirmButton, { key: "z", ctrlKey: true });
    expect(s().activeForm().bedrock.title).toBe("Edited");
  });

  it("ignores ctrl+y while a confirm dialog is open", () => {
    s().setBedrock({ ...s().activeForm().bedrock, title: "Edited" }, "Updated title");
    s().undo();
    openConfirm();

    fireEvent.keyDown(window, { key: "y", ctrlKey: true });
    expect(s().activeForm().bedrock.title).toBe("New Form");
  });

  // The signal is read from the live DOM at keydown, so closing the dialog
  // restores the shortcut with nothing to invalidate.
  it("undoes again once the dialog closes", () => {
    s().setBedrock({ ...s().activeForm().bedrock, title: "Edited" }, "Updated title");
    openConfirm();
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(s().activeForm().bedrock.title).toBe("Edited");

    act(() => resolveConfirm(true));
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(s().activeForm().bedrock.title).toBe("New Form");
  });
});

describe("the text-entry guard covers only fields with an undo of their own", () => {
  beforeEach(() => {
    s().loadProject(createEmptyProject());
    render(<ShortcutHost />);
    edit("Edited");
  });
  afterEach(() => cleanup());

  function input(type: string) {
    const el = document.createElement("input");
    el.setAttribute("type", type);
    return el;
  }

  function pressUndoOn(el: HTMLElement) {
    document.body.appendChild(el);
    fireEvent.keyDown(el, { key: "z", ctrlKey: true });
    el.remove();
  }

  function undone() {
    return s().activeForm().bedrock.title === "New Form";
  }

  // No browser undo to defer to: swallowing the chord here just loses it.
  it("undoes from a select", () => {
    pressUndoOn(document.createElement("select"));
    expect(undone()).toBe(true);
  });

  it("undoes from a checkbox", () => {
    pressUndoOn(input("checkbox"));
    expect(undone()).toBe(true);
  });

  it("undoes from a radio", () => {
    pressUndoOn(input("radio"));
    expect(undone()).toBe(true);
  });

  it("undoes from a number input", () => {
    pressUndoOn(input("number"));
    expect(undone()).toBe(true);
  });

  it("undoes from a range input", () => {
    pressUndoOn(input("range"));
    expect(undone()).toBe(true);
  });

  // These own an edit history, so the browser keeps the chord.
  it("leaves a textarea alone", () => {
    pressUndoOn(document.createElement("textarea"));
    expect(undone()).toBe(false);
  });

  it("leaves an input with no type attribute alone, since it defaults to text", () => {
    pressUndoOn(document.createElement("input"));
    expect(undone()).toBe(false);
  });

  it("leaves a password input alone", () => {
    pressUndoOn(input("password"));
    expect(undone()).toBe(false);
  });

  it("leaves an email input alone", () => {
    pressUndoOn(input("email"));
    expect(undone()).toBe(false);
  });

  it("leaves a search input alone", () => {
    pressUndoOn(input("search"));
    expect(undone()).toBe(false);
  });

  it("leaves an uppercase TEXT input alone", () => {
    pressUndoOn(input("TEXT"));
    expect(undone()).toBe(false);
  });

  it("leaves a contenteditable element alone", () => {
    const el = document.createElement("div");
    el.setAttribute("contenteditable", "true");
    pressUndoOn(el);
    expect(undone()).toBe(false);
  });

  it("leaves a node nested inside a contenteditable host alone", () => {
    const host = document.createElement("div");
    host.setAttribute("contenteditable", "true");
    const child = document.createElement("span");
    host.appendChild(child);
    document.body.appendChild(host);
    fireEvent.keyDown(child, { key: "z", ctrlKey: true });
    host.remove();
    expect(undone()).toBe(false);
  });
});
