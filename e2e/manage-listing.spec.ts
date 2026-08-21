import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

test.describe("Manage a listing", () => {
  test.use({ storageState: BUYER_STATE });

  test("shows the listing, lifecycle actions and analytics", async ({
    page,
  }) => {
    await page.goto("/en/my-listings/1");
    await expect(
      page.getByRole("heading", { name: "iPhone 13 Pro" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Description" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Views (last 7 days)" }),
    ).toBeVisible();
    // Active listing → these lifecycle actions are available.
    await expect(
      page.getByRole("button", { name: "Mark as Sold" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Edit/i })).toBeVisible();
  });

  test("marking as sold picks a buyer then succeeds", async ({ page }) => {
    await page.goto("/en/my-listings/1");
    await page.getByRole("button", { name: "Mark as Sold" }).first().click();
    // Buyer picker (records a Transaction so both parties can review).
    await expect(page.getByText("Who bought this item?")).toBeVisible();
    // Sale to someone not on Hatiwal — always available, no buyer selection.
    await page
      .getByRole("button", { name: /Sold to someone not on Hatiwal/ })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm sold" })
      .click();
    await expect(page.getByText("Listing marked as sold")).toBeVisible();
  });

  test("deleting confirms then returns to My Shop", async ({ page }) => {
    await page.goto("/en/my-listings/1");
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("Delete this listing?")).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete Listing" })
      .click();
    await expect(page.getByText("Listing deleted")).toBeVisible();
    await expect(page).toHaveURL(/\/my-listings\/?$/, { timeout: 20_000 });
  });

  // ── Multi-quantity (docs/SPIKE_LISTING_QUANTITY.md) ────────────────────────
  //
  // Listing 14 is the batch fixture (15 total, 4 sold). The OWNER phrasing is
  // deliberately different from the buyer's: a seller's question is "how do I
  // know when they're all gone?", so they get progress through the batch
  // ("11 of 15 left"), not just the remainder.

  test("the owner sees how many are left of the original count", async ({
    page,
  }) => {
    await page.goto("/en/my-listings/14");
    await expect(
      page.getByRole("heading", { name: "Phone Cases Wholesale" }),
    ).toBeVisible();
    // "11 of 15 left" — both numbers, unlike the buyer's "11 in stock".
    await expect(page.getByText("11 of 15 left")).toBeVisible();
    // And the price says which number it is.
    await expect(page.getByText("each")).toBeVisible();
  });

  test("a single-item listing shows no stock line at all", async ({ page }) => {
    await page.goto("/en/my-listings/1");
    await expect(
      page.getByRole("heading", { name: "iPhone 13 Pro" }),
    ).toBeVisible();
    await expect(page.getByText(/left$/)).toHaveCount(0);
    await expect(page.getByText("each")).toHaveCount(0);
  });

  test("Edit navigates to the edit form", async ({ page }) => {
    await page.goto("/en/my-listings/1");
    await page.getByRole("link", { name: /Edit/i }).click();
    await expect(page).toHaveURL(/\/listings\/1\/edit/);
  });
});
