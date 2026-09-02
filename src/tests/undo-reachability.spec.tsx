import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useDesignerStore } from "../store";
import { createEmptyProject } from "../core/project";
import { TopBar } from "../app/TopBar";
import { HistoryPanel } from "../panels/HistoryPanel";
import { useUndoShortcuts } from "../app/useUndoShortcuts";
import { DesignerShell } from "../app/DesignerShell";

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
