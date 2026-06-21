import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("header links go to Bazaar and Categories", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("link", { name: "Bazaar" }).first().click();
    await expect(page).toHaveURL(/\/bazaar/);
    await expect(page.getByText("iPhone 13 Pro")).toBeVisible();

    await page.getByRole("link", { name: "Categories" }).first().click();
    await expect(page).toHaveURL(/\/categories/);
    await expect(page.getByRole("heading", { name: "Categories" })).toBeVisible();
  });

  test("footer legal links resolve", async ({ page }) => {
    await page.goto("/en");
    const footer = page.getByRole("contentinfo");
    await footer.getByRole("link", { name: "Delete account" }).click();
    await expect(page).toHaveURL(/\/delete-account/);
    await expect(page.getByRole("heading", { name: /Delete your Hatiwal account/i })).toBeVisible();
  });

  test("logo returns to the home page", async ({ page }) => {
    await page.goto("/en/categories");
    await page.getByRole("link", { name: "Hatiwal home" }).click();
    await expect(page).toHaveURL(/\/en\/?$/);
    await expect(page.getByRole("heading", { name: "Buy and sell locally in Afghanistan" })).toBeVisible();
  });

  test("unknown route renders the 404 page", async ({ page }) => {
    const resp = await page.goto("/en/this-route-does-not-exist");
    expect(resp?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  });
});
