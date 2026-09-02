import { beforeEach, afterEach, it, expect } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FormSwitcher } from "../panels/FormSwitcher";
import { useDesignerStore } from "../store";
import { createEmptyProject } from "../core/project";

beforeEach(() => useDesignerStore.getState().loadProject(createEmptyProject()));
afterEach(() => cleanup());

it("lists every form and marks the active one", () => {
  useDesignerStore.getState().addForm("shop");
  render(<FormSwitcher />);
  expect(screen.getByText("main_menu")).toBeInTheDocument();
  expect(screen.getByText("shop")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /main_menu/ })).toHaveAttribute("aria-current", "true");
});

it("switches the active form on click", () => {
  useDesignerStore.getState().addForm("shop");
  render(<FormSwitcher />);
  fireEvent.click(screen.getByRole("button", { name: /shop/ }));
  expect(useDesignerStore.getState().project.activeFormId).toBe("shop");
});

it("adds a form", () => {
  render(<FormSwitcher />);
  fireEvent.click(screen.getByRole("button", { name: "Add form" }));
  expect(useDesignerStore.getState().project.forms.length).toBe(2);
});

it("refuses to delete the last remaining form", () => {
  render(<FormSwitcher />);
  expect(screen.queryByRole("button", { name: /Delete main_menu/ })).toBeNull();
});
