import { test, expect } from "@playwright/test";

async function buttonIds(page: import("@playwright/test").Page) {
  return page.locator("[data-button-id]").evaluateAll((els) => els.map((e) => e.getAttribute("data-button-id")));
}

test("reorders buttons from the outline with the keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("http://localhost:5173/");
  await page.getByRole("button", { name: "Add button" }).click();
  expect(await buttonIds(page)).toEqual(["button_1", "button_2"]);

  await page.getByLabel("Reorder button_1").focus();
  await page.keyboard.press("Space");

  const liveRegion = page.locator('[aria-live="assertive"]');
  for (let i = 0; i < 5; i++) {
    if ((await liveRegion.textContent())?.includes("droppable area bedrock-button-button_2")) break;
    await page.keyboard.press("ArrowDown");
  }
  await expect(liveRegion).toContainText("droppable area bedrock-button-button_2");
  await page.keyboard.press("Space");

  await expect.poll(() => buttonIds(page)).toEqual(["button_2", "button_1"]);
});

test("adds a button from the outline and selects it", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("http://localhost:5173/");
  await page.getByRole("button", { name: "Add button" }).click();
  expect(await buttonIds(page)).toEqual(["button_1", "button_2"]);
  await expect(page.locator('input[aria-label="Button ID"]')).toHaveValue("button_2");
});
