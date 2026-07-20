import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

test.describe("Hidden listings", () => {
  test.use({ storageState: BUYER_STATE });

  test("lists hidden listings and restores one", async ({ page }) => {
    await page.goto("/en/settings/hidden-listings");
    await expect(
      page.getByRole("heading", { name: "Hidden Listings" }),
    ).toBeVisible();
    // The mock returns one hidden listing.
    await expect(page.getByText("Samsung 4K TV")).toBeVisible();

    // Restore removes it optimistically and confirms via a toast.
    await page.getByRole("button", { name: "Restore" }).first().click();
    await expect(page.getByText("Listing restored to your feed")).toBeVisible();
    await expect(page.getByText("Samsung 4K TV")).toHaveCount(0);
  });
});

test.describe("Hidden listings (guest)", () => {
  test("redirects an unauthenticated visitor to login", async ({ page }) => {
    await page.goto("/en/settings/hidden-listings");
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });
});
