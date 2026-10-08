import path from "node:path";
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

// VER-1, web = app parity (mobile PublishSuccessSheet; d0, 2026-10-08): after a
// FIRST published listing, an unverified seller gets one soft line — "Verified
// sellers sell faster" with a "Get verified" action — never a popup.
test.describe("Publish → the soft 'Get verified' line", () => {
  test.use({ storageState: BUYER_STATE });

  test("an unverified seller's first listing: the line + Get verified, which opens the verify page", async ({ page }) => {
    await page.route("**/api/auth/session", async (route) => {
      const res = await route.fetch();
      const json = await res.json();
      if (json.user) Object.assign(json.user, { verified: false, itemsActiveCount: 0, items_active_count: 0 });
      await route.fulfill({ response: res, json });
    });
    await page.goto("/en/listings/new");
    await page.getByLabel("Title", { exact: true }).fill("Vintage Radio");
    await page.getByLabel("Price", { exact: true }).fill("2500");
    await page.getByLabel("Category", { exact: true }).selectOption({ label: "Vehicles" });
    await page.getByLabel("Location", { exact: true }).fill("Kabul");
    await page.locator('input[type="file"]').first().setInputFiles(path.join(__dirname, "fixtures", "photo-a.png"));
    await page.getByRole("button", { name: "Publish" }).click();

    await expect(page.getByText("Verified sellers sell faster")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Get verified" }).click();
    await expect(page).toHaveURL(/\/en\/profile\/verify$/, { timeout: 20_000 });
  });
});
