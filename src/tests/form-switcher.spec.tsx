import { beforeEach, afterEach, it, expect } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { FormSwitcher } from "../panels/FormSwitcher";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ToastHost } from "../components/ToastHost";
import { useDesignerStore } from "../store";
import { useToastStore } from "../core/toast";
import { resolveConfirm } from "../core/confirm";
import { createEmptyProject } from "../core/project";

beforeEach(() => {
  useDesignerStore.getState().loadProject(createEmptyProject());
  useToastStore.setState({ toasts: [] });
});
afterEach(() => {
  resolveConfirm(false);
  cleanup();
});

it("lists every form and marks the active one", () => {
  useDesignerStore.getState().addForm("shop");
  render(<FormSwitcher />);
  expect(screen.getByText("main_menu")).toBeInTheDocument();
  expect(screen.getByText("shop")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open form main_menu" })).toHaveAttribute("aria-current", "true");
});

it("switches the active form on click", () => {
  useDesignerStore.getState().addForm("shop");
  render(<FormSwitcher />);
  fireEvent.click(screen.getByRole("button", { name: "Open form shop" }));
  expect(useDesignerStore.getState().project.activeFormId).toBe("shop");
});

it("adds a form", () => {
  render(<FormSwitcher />);
  fireEvent.click(screen.getByRole("button", { name: "Add form" }));
  expect(useDesignerStore.getState().project.forms.length).toBe(2);
});

it("refuses to delete the last remaining form", () => {
  render(<FormSwitcher />);
  expect(screen.queryByRole("button", { name: "Delete form main_menu" })).toBeNull();
});

it("gives each row's delete control a distinct, id-suffixed accessible name", () => {
  useDesignerStore.getState().addForm("shop");
  render(<FormSwitcher />);
  const deleteMainMenu = screen.getByRole("button", { name: "Delete form main_menu" });
  const deleteShop = screen.getByRole("button", { name: "Delete form shop" });
  expect(deleteMainMenu).toBeInTheDocument();
  expect(deleteShop).toBeInTheDocument();
  expect(deleteMainMenu).not.toBe(deleteShop);
});

// Deleting a form used to promise "You can undo this with Ctrl+Z". Ctrl+Z is
// now the form on screen and nothing else, so the promise had to change and the
// replacement has to be real: these two tests pin the wording and the escape
// hatch it points at.
it("tells the user Ctrl+Z will not undo a delete, and where to go instead", async () => {
  useDesignerStore.getState().addForm("shop");
  render(
    <>
      <FormSwitcher />
      <ConfirmDialog />
    </>
  );

  fireEvent.click(screen.getByRole("button", { name: "Delete form shop" }));
  const dialog = await screen.findByRole("dialog");
  expect(dialog).toHaveTextContent(
    "Delete form 'shop'? Ctrl+Z will not bring it back — use the Undo button on the toast that appears, or the Project section of the History panel."
  );
});

it("brings a deleted form back through the toast's Undo action", async () => {
  useDesignerStore.getState().addForm("shop");
  useDesignerStore.getState().setActiveForm("shop");
  useDesignerStore
    .getState()
    .setBedrock({ ...useDesignerStore.getState().activeForm().bedrock, title: "Doomed" }, "Updated title");
  // Adding the form raised an undo toast of its own; drop it so the only Undo
  // button on screen is the one the deletion is about to raise.
  useToastStore.setState({ toasts: [] });

  render(
    <>
      <FormSwitcher />
      <ConfirmDialog />
      <ToastHost />
    </>
  );

  fireEvent.click(screen.getByRole("button", { name: "Delete form shop" }));
  fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
  await waitFor(() => expect(useDesignerStore.getState().project.forms.map((f) => f.id)).toEqual(["main_menu"]));

  fireEvent.click(await screen.findByRole("button", { name: "Undo" }));

  const after = useDesignerStore.getState();
  expect(after.project.forms.map((f) => f.id)).toEqual(["main_menu", "shop"]);
  // The whole FormDoc comes back, not an empty row.
  expect(after.project.forms[1].bedrock.title).toBe("Doomed");
  // ...and the toast is gone once its action has run.
  expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
});
