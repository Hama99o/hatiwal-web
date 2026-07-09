import { test, expect } from "@playwright/test";

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
