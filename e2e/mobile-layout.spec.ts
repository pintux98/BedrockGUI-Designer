import { test, expect, type Page } from "@playwright/test";

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test.describe("mobile layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("fits the viewport and shows the workspace tabs", async ({ page }) => {
    await page.goto("http://localhost:5173/");
    await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Forms" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Preview" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    const rootH = await page.evaluate(() => document.getElementById("root")!.getBoundingClientRect().height);
    expect(rootH).toBeLessThanOrEqual(846);
  });

  test("project menu opens and shows save actions", async ({ page }) => {
    await page.goto("http://localhost:5173/");
    await page.getByText("Untitled project").click();
    await expect(page.getByText("Saved projects", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /save in browser/i })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });

  test("edit tab reaches the YAML view", async ({ page }) => {
    await page.goto("http://localhost:5173/");
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("tab", { name: "YAML" }).click();
    await expect(page.locator("textarea[readonly]")).toHaveValue(/bedrock:/);
  });
});

test("tablet width has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("http://localhost:5173/");
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
});

test("help menu holds the external links", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto("http://localhost:5173/");
  await page.getByRole("button", { name: "Help and links" }).click();
  await expect(page.getByRole("menuitem", { name: /Documentation/ })).toBeVisible();
});
