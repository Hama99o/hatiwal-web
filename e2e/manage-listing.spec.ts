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

  test("marking as sold asks for confirmation then succeeds", async ({
    page,
  }) => {
    await page.goto("/en/my-listings/1");
    await page.getByRole("button", { name: "Mark as Sold" }).first().click();
    // Confirm dialog.
    await expect(page.getByText("Mark as sold?")).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Mark as Sold" })
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

  test("Edit navigates to the edit form", async ({ page }) => {
    await page.goto("/en/my-listings/1");
    await page.getByRole("link", { name: /Edit/i }).click();
    await expect(page).toHaveURL(/\/listings\/1\/edit/);
  });
});
