import { test, expect } from "@playwright/test";

const SORT_HANDLE = '[aria-roledescription="sortable"]';
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

  await expect(page.locator(SORT_HANDLE)).toHaveCount(2);
  expect(await buttonIds(page)).toEqual(["button_1", "button_2"]);

  await page.locator(SORT_HANDLE).first().focus();
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
