import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

test.describe("Seller reviews (REV3)", () => {
  test("shows the rating summary and revealed reviews for a rated seller", async ({
    page,
  }) => {
    await page.goto("/en/sellers/1");

    // Section heading + summary badge (avg 4.7 from the public profile).
    await expect(
      page.getByRole("heading", { name: "Ratings & Reviews" }),
    ).toBeVisible();
    await expect(page.getByText("4.7").first()).toBeVisible();
    await expect(page.getByText("3 reviews").first()).toBeVisible();

    // The "As a seller" tab is the default — its reviews render.
    await expect(
      page.getByText("Item exactly as described, met on time."),
    ).toBeVisible();
    await expect(page.getByText("Good deal, friendly seller.")).toBeVisible();

    // Switching to "As a buyer" (no reviews) shows the empty state.
    await page.getByRole("tab", { name: "As a buyer" }).click();
    await expect(page.getByText("No reviews yet").first()).toBeVisible();
  });

  test("a seller with no reviews shows a neutral empty state, not a rating", async ({
    page,
  }) => {
    await page.goto("/en/sellers/2");
    await expect(
      page.getByRole("heading", { name: "Ratings & Reviews" }),
    ).toBeVisible();
    // No average shown; the summary falls back to the neutral empty label.
    await expect(page.getByText("No reviews yet").first()).toBeVisible();
  });
});

test.describe("Pending reviews (REV2 write flow)", () => {
  test.use({ storageState: BUYER_STATE });

  test("rate a recent deal from the profile nudge", async ({ page }) => {
    await page.goto("/en/profile");

    // "Rate your recent deals" nudge shows the counterparty (the buyer).
    await expect(page.getByText("Rate your recent deals")).toBeVisible();
    await expect(page.getByText("Sara Ahmadi")).toBeVisible();

    await page.getByRole("button", { name: "Rate" }).first().click();

    // Caller is the seller, so the prompt rates the BUYER.
    await expect(
      page.getByRole("heading", { name: /How was Sara Ahmadi as a buyer\?/ }),
    ).toBeVisible();

    // Pick 5 stars and submit.
    await page.getByRole("radio", { name: "5 out of 5 stars" }).click();
    await page.getByRole("button", { name: "Submit review" }).click();

    // Confirmation (double-blind: hidden until the other party rates too).
    await expect(page.getByText("Review saved")).toBeVisible();
    await page.getByRole("button", { name: "Got it" }).click();
    await expect(page.getByText("Review saved")).toHaveCount(0);
  });
});
