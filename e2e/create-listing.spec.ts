import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

test.describe("Create a listing", () => {
  test.use({ storageState: BUYER_STATE });

  test("renders the full form", async ({ page }) => {
    await page.goto("/en/listings/new");
    await expect(
      page.getByRole("heading", { name: "Create Listing" }),
    ).toBeVisible();
    await expect(page.getByLabel("Title", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Price", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Category", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Location", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save Draft" }),
    ).toBeVisible();
    // Firm/negotiable toggle (mobile parity) — present and negotiable by default.
    const negotiable = page.getByLabel("Price is negotiable");
    await expect(negotiable).toBeVisible();
    await expect(negotiable).toBeChecked();
  });

  test("submitting an empty form shows validation errors", async ({ page }) => {
    await page.goto("/en/listings/new");
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText(/Title is required/i)).toBeVisible();
    await expect(
      page.getByText(/Enter a valid price greater than 0/i),
    ).toBeVisible();
    await expect(page.getByText(/Please select a category/i)).toBeVisible();
  });

  test("saving a draft creates the listing and navigates to it", async ({
    page,
  }) => {
    await page.goto("/en/listings/new");
    await page.getByLabel("Title", { exact: true }).fill("Vintage Radio");
    await page.getByLabel("Price", { exact: true }).fill("2500");
    await page.getByLabel("Category", { exact: true }).selectOption({
      label: "Vehicles",
    });
    await page.getByLabel("Location", { exact: true }).fill("Kabul");
    await page.getByRole("button", { name: "Save Draft" }).click();
    // createListing returns the new (mock id 1001) draft → redirect to it.
    await expect(page).toHaveURL(/\/my-listings\/1001/, { timeout: 20_000 });
  });
});
