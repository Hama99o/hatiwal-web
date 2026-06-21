import { test, expect } from "@playwright/test";
import { BUYER_STATE, EMPTY_STATE } from "./auth-paths";

test.describe("Saved listings", () => {
  test.use({ storageState: BUYER_STATE });

  test("shows the buyer's favorited listings", async ({ page }) => {
    await page.goto("/en/saved");
    await expect(page.getByRole("heading", { name: "Saved" })).toBeVisible();
    await expect(page.getByText("Samsung 4K TV")).toBeVisible();
    await expect(page.getByText("Winter Jacket")).toBeVisible();
  });
});

test.describe("Saved listings (empty)", () => {
  test.use({ storageState: EMPTY_STATE });

  test("shows the empty state", async ({ page }) => {
    await page.goto("/en/saved");
    await expect(page.getByText("No saved items yet")).toBeVisible();
    await expect(
      page.getByText("Tap the heart on any listing to save it here"),
    ).toBeVisible();
  });
});

test.describe("Saved listings (guest)", () => {
  test("redirects an unauthenticated visitor to login", async ({ page }) => {
    await page.goto("/en/saved");
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });
});
