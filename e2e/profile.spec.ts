import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

test.describe("Profile (signed in)", () => {
  test.use({ storageState: BUYER_STATE });

  test("shows the user, stats, and account actions", async ({ page }) => {
    await page.goto("/en/profile");
    await expect(page.getByText("Ahmad Karimi")).toBeVisible();
    // Stats from /users/me (active 3, sold 1, saved 2).
    await expect(page.getByText("Active", { exact: true })).toBeVisible();
    await expect(page.getByText("Sold", { exact: true })).toBeVisible();
    await expect(page.getByText("Saved Items")).toBeVisible();
    await expect(page.getByText("Personal Info")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Edit Profile/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Sign Out/i }),
    ).toBeVisible();
  });

  test("Edit Profile navigates to the edit screen", async ({ page }) => {
    await page.goto("/en/profile");
    await page.getByRole("link", { name: /Edit Profile/i }).click();
    await expect(page).toHaveURL(/\/profile\/edit/);
    await expect(
      page.getByRole("heading", { name: "Edit Profile" }),
    ).toBeVisible();
  });
});

test.describe("Profile (guest)", () => {
  test("redirects an unauthenticated visitor to login", async ({ page }) => {
    await page.goto("/en/profile");
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });
});
