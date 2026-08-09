import { test, expect } from "@playwright/test";
import { BUYER_STATE, EMPTY_STATE } from "./auth-paths";

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

  test("shows your own rating and your reviews (REP815)", async ({ page }) => {
    await page.goto("/en/profile");

    // Rating summary under your name — from /users/me (avg 4.7, 3 reviews).
    await expect(page.getByText("4.7").first()).toBeVisible();
    await expect(page.getByText("3 reviews").first()).toBeVisible();

    // "My reviews" (not the public "Ratings & Reviews" heading) + the list.
    await expect(
      page.getByRole("heading", { name: "My reviews" }),
    ).toBeVisible();
    await expect(
      page.getByText("Item exactly as described, met on time."),
    ).toBeVisible();

    // Role toggle works here too — "As a buyer" has none, so the empty state.
    await page.getByRole("tab", { name: "As a buyer" }).click();
    await expect(page.getByText("No reviews yet").first()).toBeVisible();
  });

  test("View my public profile opens the seller page (REP815)", async ({
    page,
  }) => {
    await page.goto("/en/profile");
    await page
      .getByRole("link", { name: /View my public profile/i })
      .click();
    await expect(page).toHaveURL(/\/sellers\/1/);
    // Other people's view keeps the public heading — unchanged by REP815.
    await expect(
      page.getByRole("heading", { name: "Ratings & Reviews" }),
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

test.describe("Profile — brand-new account (no reviews)", () => {
  test.use({ storageState: EMPTY_STATE });

  test("shows a neutral no-rating state, never NaN or 0 stars", async ({
    page,
  }) => {
    await page.goto("/en/profile");
    await expect(
      page.getByRole("heading", { name: "My reviews" }),
    ).toBeVisible();
    // Neutral label for both the summary and the (empty) list.
    await expect(page.getByText("No reviews yet").first()).toBeVisible();
    await expect(page.getByText("NaN")).toHaveCount(0);
    await expect(page.getByText("0.0")).toHaveCount(0);
  });
});

test.describe("Profile (guest)", () => {
  test("redirects an unauthenticated visitor to login", async ({ page }) => {
    await page.goto("/en/profile");
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });
});
