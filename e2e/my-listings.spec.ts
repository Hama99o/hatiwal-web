import { test, expect } from "@playwright/test";
import { BUYER_STATE, EMPTY_STATE } from "./auth-paths";

test.describe("My Shop (seller dashboard)", () => {
  test.use({ storageState: BUYER_STATE });

  test("lists the seller's listings across all statuses", async ({ page }) => {
    await page.goto("/en/my-listings");
    await expect(page.getByRole("heading", { name: "My Shop" })).toBeVisible();
    // Seller 1 owns one listing in each lifecycle state.
    await expect(page.getByText("iPhone 13 Pro")).toBeVisible();
    await expect(page.getByText("Antique Carpet")).toBeVisible(); // draft
    await expect(page.getByText("Gaming PC")).toBeVisible(); // reserved
    await expect(page.locator('a[href*="/my-listings/"]')).toHaveCount(6);
  });

  test("status tabs filter the grid in place", async ({ page }) => {
    await page.goto("/en/my-listings");
    await expect(page.getByText("iPhone 13 Pro")).toBeVisible();
    const draftTab = page.getByRole("button", { name: /^Draft/ });
    await expect(async () => {
      await draftTab.click();
      await expect(page.getByText("Antique Carpet")).toBeVisible();
      await expect(page.getByText("iPhone 13 Pro")).toHaveCount(0);
    }).toPass({ timeout: 20_000 });
    // The Expired tab (active-but-past-30-days) is available alongside the rest.
    await expect(page.getByRole("button", { name: /^Expired/ })).toBeVisible();
  });

  test("New Listing navigates to the create form", async ({ page }) => {
    await page.goto("/en/my-listings");
    await page.getByRole("link", { name: /New Listing/i }).first().click();
    await expect(page).toHaveURL(/\/listings\/new/);
    await expect(
      page.getByRole("heading", { name: "Create Listing" }),
    ).toBeVisible();
  });
});

test.describe("My Shop (empty)", () => {
  test.use({ storageState: EMPTY_STATE });

  test("shows the empty state with a create CTA", async ({ page }) => {
    await page.goto("/en/my-listings");
    await expect(
      page.getByText("You haven't posted anything yet"),
    ).toBeVisible();
    await expect(
      page.getByText("Post your first listing to start selling."),
    ).toBeVisible();
  });
});

test.describe("My Shop (guest)", () => {
  test("redirects an unauthenticated visitor to login", async ({ page }) => {
    await page.goto("/en/my-listings");
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });
});
