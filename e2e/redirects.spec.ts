import { test, expect } from "@playwright/test";

// Legacy / alias routes that permanently redirect to the canonical page.
test.describe("Redirects", () => {
  test("/browse redirects to /bazaar", async ({ page }) => {
    await page.goto("/en/browse");
    await expect(page).toHaveURL(/\/bazaar/);
    await expect(page.getByText("iPhone 13 Pro")).toBeVisible();
  });

  test("/users/[id] redirects to the seller profile", async ({ page }) => {
    await page.goto("/en/users/1");
    await expect(page).toHaveURL(/\/sellers\/1/);
    // exact: true so we match the visible name span, not the page <title>
    // ("Ahmad Karimi — Hatiwal"), which getByText would otherwise also hit.
    await expect(page.getByText("Ahmad Karimi", { exact: true })).toBeVisible();
  });
});
