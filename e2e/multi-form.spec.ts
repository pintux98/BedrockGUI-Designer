import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";

/**
 * The seam between the form switcher, the store and the exporter.
 *
 * The unit suite covers each of those in isolation; what it cannot see is
 * whether clicking a switcher row actually re-points the canvas and the
 * properties panel at a different FormDoc, and whether Export walks every form
 * in the project rather than just the active one.
 *
 * Locator notes (verified against the running app, not assumed):
 *  - FormSwitcher rows are `Open form <id>`; the active one carries
 *    aria-current="true" and the inactive ones aria-current="false".
 *    Rename/Duplicate/Delete are `<Verb> form <id>`, and Delete is only
 *    rendered while more than one form exists.
 *  - Delete goes through the app's own imperative confirm() singleton, which
 *    renders src/components/ConfirmDialog.tsx into the DOM as role="dialog".
 *    It is NOT a native browser dialog, so page.on("dialog") never fires here.
 *  - The assertions below read the title back off BOTH the canvas preview and
 *    the properties field. They are different surfaces, so agreeing is real
 *    evidence the store moved rather than one widget re-rendering.
 */

const APP_URL = "http://localhost:5173/";
/** The canvas preview's title element (carries title="Double-click to edit"). */
const CANVAS_TITLE = '[title="Double-click to edit"]';
/** The form title field in PropertiesPanel > Form Settings. */
const TITLE_INPUT = 'input[aria-label="Form title"]';

function formRow(page: Page, id: string) {
  return page.getByRole("button", { name: `Open form ${id}` });
}

function formRows(page: Page) {
  return page.getByRole("button", { name: /^Open form / });
}

async function openApp(page: Page) {
  // Below 768px the shell collapses to a bottom tab bar and the switcher is
  // behind the "Tools" tab; keep the desktop three-pane layout.
  await page.setViewportSize({ width: 1600, height: 1400 });
  await page.goto(APP_URL);
  await expect(formRows(page)).toHaveText(["main_menu"]);
}

/** Type a new form title and wait for the canvas preview to agree. */
async function setTitle(page: Page, value: string) {
  const input = page.locator(TITLE_INPUT);
  await input.fill(value);
  await input.press("Enter");
  await expect(page.locator(CANVAS_TITLE)).toHaveText(value);
}

/** Assert which switcher row the store considers active. */
async function expectActiveForm(page: Page, id: string, others: string[]) {
  await expect(formRow(page, id)).toHaveAttribute("aria-current", "true");
  for (const other of others) {
    await expect(formRow(page, other)).toHaveAttribute("aria-current", "false");
  }
}

test("adds a form and switches the whole editor between forms", async ({ page }) => {
  await openApp(page);
  await expectActiveForm(page, "main_menu", []);

  await page.getByRole("button", { name: "Add form" }).click();
  await expect(formRows(page)).toHaveText(["main_menu", "form_2"]);
  // Adding a form must not silently steal the selection.
  await expectActiveForm(page, "main_menu", ["form_2"]);

  // Give the active form a title of its own so switching is observable.
  await setTitle(page, "Main Menu");

  await formRow(page, "form_2").click();
  await expectActiveForm(page, "form_2", ["main_menu"]);
  // Not just the button state: the canvas and the properties panel must both
  // be showing the newly selected form.
  await expect(page.locator(CANVAS_TITLE)).toHaveText("New Form");
  await expect(page.locator(TITLE_INPUT)).toHaveValue("New Form");

  await formRow(page, "main_menu").click();
  await expectActiveForm(page, "main_menu", ["form_2"]);
  await expect(page.locator(CANVAS_TITLE)).toHaveText("Main Menu");
  await expect(page.locator(TITLE_INPUT)).toHaveValue("Main Menu");
});

test("keeps an edit on the form it was made on", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Add form" }).click();
  await expect(formRows(page)).toHaveText(["main_menu", "form_2"]);

  await setTitle(page, "Alpha");

  await formRow(page, "form_2").click();
  // The edit to main_menu must not have leaked into the second form.
  await expect(page.locator(CANVAS_TITLE)).toHaveText("New Form");
  await setTitle(page, "Beta");

  await formRow(page, "main_menu").click();
  await expect(page.locator(CANVAS_TITLE)).toHaveText("Alpha");
  await expect(page.locator(TITLE_INPUT)).toHaveValue("Alpha");

  await formRow(page, "form_2").click();
  await expect(page.locator(CANVAS_TITLE)).toHaveText("Beta");
  await expect(page.locator(TITLE_INPUT)).toHaveValue("Beta");
});

test("deletes a form through the app's own confirm dialog", async ({ page }) => {
  await openApp(page);
  // The last remaining form has no delete affordance at all.
  await expect(page.getByRole("button", { name: /^Delete form / })).toHaveCount(0);

  await page.getByRole("button", { name: "Add form" }).click();
  await expect(formRows(page)).toHaveText(["main_menu", "form_2"]);
  await expect(page.getByRole("button", { name: /^Delete form / })).toHaveCount(2);

  // Cancelling leaves the project alone.
  await page.getByRole("button", { name: "Delete form form_2" }).click();
  const cancelled = page.getByRole("dialog");
  await expect(cancelled).toContainText("Delete form 'form_2'?");
  await cancelled.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(cancelled).toBeHidden();
  await expect(formRows(page)).toHaveText(["main_menu", "form_2"]);

  // Confirming removes it.
  await page.getByRole("button", { name: "Delete form form_2" }).click();
  const confirmed = page.getByRole("dialog");
  await expect(confirmed).toContainText("Delete form 'form_2'?");
  await confirmed.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(confirmed).toBeHidden();

  await expect(formRows(page)).toHaveText(["main_menu"]);
  await expectActiveForm(page, "main_menu", []);
  await expect(page.getByRole("button", { name: /^Delete form / })).toHaveCount(0);
});

test("brings a deleted form back from the toast, and not from Ctrl+Z", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Add form" }).click();
  await expect(formRows(page)).toHaveText(["main_menu", "form_2"]);

  // Give the doomed form content of its own, so restoring it has to bring back
  // the whole FormDoc and not just an empty row in the switcher.
  await formRow(page, "form_2").click();
  await setTitle(page, "Doomed");
  await expectActiveForm(page, "form_2", ["main_menu"]);

  await page.getByRole("button", { name: "Delete form form_2" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Ctrl+Z will not bring it back");
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(formRows(page)).toHaveText(["main_menu"]);
  await expect(page.locator(CANVAS_TITLE)).toHaveText("New Form");

  // Ctrl+Z is per-form now. On main_menu, which has no edits of its own, it must
  // do nothing at all — this is the shape of the bug that used to delete the
  // form on screen, so the negative assertion is the point of the test.
  await page.locator("body").click({ position: { x: 4, y: 4 } });
  expect(await page.evaluate(() => document.activeElement?.tagName ?? "NONE")).not.toMatch(
    /^(INPUT|TEXTAREA|SELECT)$/
  );
  await page.keyboard.press("Control+z");
  await expect(formRows(page)).toHaveText(["main_menu"]);

  // The toast raised by the delete is the way back.
  // Name the delete toast exactly: only a destructive change raises one, and
  // matching loosely on "form_2" would also accept an unrelated toast.
  const toast = page.getByRole("status").filter({ hasText: "Deleted form form_2" });
  await toast.getByRole("button", { name: /undo/i }).click();

  await expect(formRows(page)).toHaveText(["main_menu", "form_2"]);
  // The restored form still carries its own title, so the whole FormDoc came back.
  await formRow(page, "form_2").click();
  await expect(page.locator(CANVAS_TITLE)).toHaveText("Doomed");
  await expect(page.locator(TITLE_INPUT)).toHaveValue("Doomed");
});

test("exports every form in the project plus the config registry snippet", async ({ page }) => {
  await openApp(page);
  await setTitle(page, "Main Menu");

  // One form exports as a bare .yml named after the form.
  const singleDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  const single = await singleDownload;
  expect(single.suggestedFilename()).toBe("main_menu.yml");

  const singleYaml = readFileSync(await single.path(), "utf8");
  expect(singleYaml).toContain('title: "Main Menu"');
  expect(singleYaml).toContain('type: "SIMPLE"');
  // Contract: form files carry no config version, and content is never
  // emitted as `description:`.
  expect(singleYaml).not.toContain("config-version");
  expect(singleYaml).not.toContain("description:");

  const snippet = page.locator("#config-snippet-textarea");
  await expect(snippet).toHaveValue('forms:\n  main_menu:\n    file: "main_menu.yml"\n');
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  // Two or more forms export as a zip holding one file per form — including
  // the form that is not currently active, which is the part the unit suite
  // cannot reach.
  await page.getByRole("button", { name: "Add form" }).click();
  await expect(formRows(page)).toHaveText(["main_menu", "form_2"]);

  const zipDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  const zipFile = await zipDownload;
  expect(zipFile.suggestedFilename()).toBe("bedrockgui-forms.zip");

  const entries = unzipSync(new Uint8Array(readFileSync(await zipFile.path())));
  expect(Object.keys(entries).sort()).toEqual(["forms/form_2.yml", "forms/main_menu.yml"]);
  expect(strFromU8(entries["forms/main_menu.yml"])).toContain('title: "Main Menu"');
  expect(strFromU8(entries["forms/form_2.yml"])).toContain('title: "New Form"');

  await expect(snippet).toHaveValue(
    'forms:\n  main_menu:\n    file: "main_menu.yml"\n  form_2:\n    file: "form_2.yml"\n'
  );
});
