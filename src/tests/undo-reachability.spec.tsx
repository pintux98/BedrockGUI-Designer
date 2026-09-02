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

describe("project-level undo is reachable from the UI", () => {
  beforeEach(() => {
    s().loadProject(createEmptyProject());
  });
  afterEach(() => cleanup());

  it("enables the Undo button after deleting a form", () => {
    s().addForm("shop");
    s().removeForm("shop");
    render(<TopBar />);
    expect(screen.getByRole("button", { name: /undo/i })).toBeEnabled();
  });

  it("enables the Redo button after undoing a structural change", () => {
    s().addForm("shop");
    s().removeForm("shop");
    s().undo();
    render(<TopBar />);
    expect(screen.getByRole("button", { name: /redo/i })).toBeEnabled();
  });

  it("leaves Undo disabled on an untouched project", () => {
    render(<TopBar />);
    expect(screen.getByRole("button", { name: /undo/i })).toBeDisabled();
  });

  it("restores a deleted form when the Undo button is clicked", () => {
    s().addForm("shop");
    s().removeForm("shop");
    render(<TopBar />);
    fireEvent.click(screen.getByRole("button", { name: /undo/i }));
    expect(s().project.forms.map((f) => f.id)).toContain("shop");
  });

  it("lists structural changes in the history panel", () => {
    s().addForm("shop");
    render(<HistoryPanel />);
    expect(screen.getByText("Added form shop")).toBeInTheDocument();
  });

  it("reverts a structural change from the history panel", () => {
    s().addForm("shop");
    s().removeForm("shop");
    render(<HistoryPanel />);
    fireEvent.click(screen.getByText("Deleted form shop"));
    expect(s().project.forms.map((f) => f.id)).toContain("shop");
  });
});

describe("undo keyboard shortcuts", () => {
  beforeEach(() => {
    s().loadProject(createEmptyProject());
    render(<ShortcutHost />);
  });
  afterEach(() => cleanup());

  it("undoes a deleted form on ctrl+z, the chord FormSwitcher promises", () => {
    s().addForm("shop");
    s().removeForm("shop");
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(s().project.forms.map((f) => f.id)).toContain("shop");
  });

  it("redoes on ctrl+y", () => {
    s().addForm("shop");
    s().removeForm("shop");
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    fireEvent.keyDown(window, { key: "y", ctrlKey: true });
    expect(s().project.forms.map((f) => f.id)).not.toContain("shop");
  });

  it("redoes on ctrl+shift+z", () => {
    s().addForm("shop");
    s().removeForm("shop");
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    fireEvent.keyDown(window, { key: "Z", ctrlKey: true, shiftKey: true });
    expect(s().project.forms.map((f) => f.id)).not.toContain("shop");
  });

  it("leaves ctrl+z to the browser inside a text field", () => {
    s().addForm("shop");
    s().removeForm("shop");
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "z", ctrlKey: true });
    expect(s().project.forms.map((f) => f.id)).not.toContain("shop");
    input.remove();
  });

  it("ignores a bare z", () => {
    s().addForm("shop");
    s().removeForm("shop");
    fireEvent.keyDown(window, { key: "z" });
    expect(s().project.forms.map((f) => f.id)).not.toContain("shop");
  });

  // AltGr reports ctrlKey AND altKey on European layouts, and ctrl+alt+z is not
  // an undo chord anywhere, so the handler must stay out of the way.
  it("ignores ctrl+alt+z", () => {
    s().addForm("shop");
    s().removeForm("shop");
    fireEvent.keyDown(window, { key: "z", ctrlKey: true, altKey: true });
    expect(s().project.forms.map((f) => f.id)).not.toContain("shop");
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
    s().addForm("shop");
    s().removeForm("shop");
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(s().project.forms.map((f) => f.id)).toContain("shop");
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
        message: "Delete form 'form_2'? You can undo this with Ctrl+Z."
      });
    });
  }

  // Dialog moves focus to its first button, so the text-entry guard never fires
  // and ctrl+z used to revert an unrelated earlier edit behind the open dialog —
  // in the very dialog whose text invites the keystroke.
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
    s().addForm("shop");
    s().removeForm("shop");
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
    return s().project.forms.map((f) => f.id).includes("shop");
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
