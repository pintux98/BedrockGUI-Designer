import { test, expect } from "@playwright/test";

test("loads designer app", async ({ page }) => {
  await page.goto("http://localhost:5173/");
  await expect(page.getByText("BedrockGUI Designer")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
});

test("keeps the project after a reload", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://localhost:5173/");
  const title = page.locator('input[aria-label="Form title"]');
  await title.fill("Survives reload");
  await title.press("Enter");
  await expect(page.locator('[title="Double-click to edit"]')).toHaveText("Survives reload");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("bedrockgui.designer.draft") ?? ""))
    .toContain("Survives reload");
  await page.reload();
  await expect(page.locator('[title="Double-click to edit"]')).toHaveText("Survives reload");
});

test("selecting a button in the preview opens its editor", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://localhost:5173/");
  await page.getByRole("button", { name: "Select button button_1" }).click();
  await expect(page.locator('textarea[aria-label="Button text"]')).toHaveValue("Click me");
  await page.getByRole("button", { name: "Back to form settings" }).click();
  await expect(page.locator('input[aria-label="Form title"]')).toBeVisible();
});
