import { test, expect } from "@playwright/test";

// Buttons can be reordered from two surfaces now. Both render dnd-kit sortables, so the
// bare `[aria-roledescription="sortable"]` selector matches twice as many nodes as it used
// to; each surface is picked out by whether its handle carries a "Reorder <id>" label.
const PROPERTIES_HANDLE = '[aria-roledescription="sortable"]:not([aria-label])';
const PREVIEW_HANDLE = '[aria-roledescription="sortable"][aria-label^="Reorder "]';
const PALETTE_ITEM = '[aria-roledescription="draggable"]';

async function buttonIds(page: import("@playwright/test").Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("input"))
      .map((i) => (i as HTMLInputElement).value)
      .filter((v) => /^button_/.test(v))
  );
}

test("reorders buttons by dragging one onto another", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1400 });
  await page.goto("http://localhost:5173/");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await expect(page.locator(PROPERTIES_HANDLE)).toHaveCount(2);
  expect(await buttonIds(page)).toEqual(["button_1", "button_2"]);

  await page.locator(PROPERTIES_HANDLE).first().focus();
  await page.keyboard.press("Space");

  const liveRegion = page.locator('[aria-live="assertive"]');
  for (let i = 0; i < 5; i++) {
    if ((await liveRegion.textContent())?.includes("droppable area bedrock-button-button_2")) break;
    await page.keyboard.press("ArrowDown");
  }

  await expect(liveRegion).toContainText("droppable area bedrock-button-button_2");

  await page.keyboard.press("Space");

  expect(await buttonIds(page)).toEqual(["button_2", "button_1"]);
});

/**
 * The request behind this one: "I want to be able to order buttons also in the form where I
 * drag and drop them into." The preview is its own SortableContext, so it uses its own dnd
 * ids (`bedrock-preview-button-<id>`) — but it has to end up writing the same store the
 * PropertiesPanel list writes, which is what the id inputs read back below prove.
 */
test("reorders buttons by dragging one inside the preview", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1400 });
  await page.goto("http://localhost:5173/");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await expect(page.locator(PREVIEW_HANDLE)).toHaveCount(2);
  expect(await buttonIds(page)).toEqual(["button_1", "button_2"]);

  await page.locator('[aria-label="Reorder button_1"]').focus();
  await page.keyboard.press("Space");

  const liveRegion = page.locator('[aria-live="assertive"]');
  // Bounded poll, not a sleep. A preview button is much taller than a
  // PropertiesPanel row, and dnd-kit's KeyboardSensor moves a fixed 25px per
  // ArrowDown — so clearing one preview row takes several times the presses the
  // panel test above needs. Bounded so a genuine failure still terminates.
  for (let i = 0; i < 20; i++) {
    if ((await liveRegion.textContent())?.includes("droppable area bedrock-preview-button-button_2")) break;
    await page.keyboard.press("ArrowDown");
  }

  await expect(liveRegion).toContainText("droppable area bedrock-preview-button-button_2");

  await page.keyboard.press("Space");

  expect(await buttonIds(page)).toEqual(["button_2", "button_1"]);
});

test("adds a button when one is dropped from the palette", async ({ page }) => {
  await page.goto("http://localhost:5173/");
  expect(await buttonIds(page)).toEqual(["button_1"]);

  await page.locator(PALETTE_ITEM).first().focus();
  await page.keyboard.press("Space");

  await expect(page.locator('[aria-live="assertive"]')).toContainText(
    "was moved over droppable area bedrock-buttons"
  );

  await page.keyboard.press("Space");

  expect(await buttonIds(page)).toEqual(["button_1", "button_2"]);
});
