import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

test.describe("Edit a listing", () => {
  test.use({ storageState: BUYER_STATE });

  test("prefills the form with the listing's values", async ({ page }) => {
    await page.goto("/en/listings/1/edit");
    await expect(
      page.getByRole("heading", { name: "Edit Listing" }),
    ).toBeVisible();
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
      "iPhone 13 Pro",
    );
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();
  });

  test("saving changes returns to the manage screen", async ({ page }) => {
    await page.goto("/en/listings/1/edit");
    await page.getByLabel("Title", { exact: true }).fill("iPhone 13 Pro Max");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page).toHaveURL(/\/my-listings\/1\/?$/, { timeout: 20_000 });
  });
});
