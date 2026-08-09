import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE, EMPTY_STATE } from "./auth-paths";

/** One seller card: the wrapper around the link to that listing's owner page. */
function card(page: Page, id: number) {
  return page.locator(`a[href="/en/my-listings/${id}"]`).locator("..");
}

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

  // TASK-WEB-C2-ACTIONS — inline lifecycle quick-actions on each card, so a
  // seller never has to open /my-listings/[id] just to act.
  test("each card shows the primary action for its status", async ({ page }) => {
    await page.goto("/en/my-listings");
    await expect(card(page, 8).getByRole("button", { name: "Publish" })).toBeVisible(); // draft
    await expect(
      card(page, 1).getByRole("button", { name: "Mark as Sold" }),
    ).toBeVisible(); // active
    await expect(
      card(page, 9).getByRole("button", { name: "Mark as Sold" }),
    ).toBeVisible(); // reserved
    // Sold is terminal: no lifecycle button, just the kebab (Edit / Delete).
    await expect(
      card(page, 7).getByRole("button", { name: "Mark as Sold" }),
    ).toHaveCount(0);
    await expect(
      card(page, 7).getByRole("button", { name: "More options" }),
    ).toBeVisible();
  });

  test("the kebab holds the secondary actions plus Edit and Delete", async ({
    page,
  }) => {
    await page.goto("/en/my-listings");
    await card(page, 1).getByRole("button", { name: "More options" }).click();
    const menu = page.getByRole("menu");
    for (const label of [
      "Mark as Reserved",
      "Unpublish",
      "Renew",
      "Edit",
      "Delete",
    ]) {
      await expect(menu.getByRole("menuitem", { name: label })).toBeVisible();
    }
  });

  test("publishing a draft inline confirms, then toasts", async ({ page }) => {
    await page.goto("/en/my-listings");
    await card(page, 8).getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Publish this listing?")).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Publish" })
      .click();
    await expect(page.getByText("Listing published!")).toBeVisible();
  });

  test("deleting inline confirms, then toasts", async ({ page }) => {
    await page.goto("/en/my-listings");
    await card(page, 8).getByRole("button", { name: "More options" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(page.getByText("Delete this listing?")).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete Listing" })
      .click();
    await expect(page.getByText("Listing deleted")).toBeVisible();
  });

  test("Mark as Sold inline opens the buyer picker", async ({ page }) => {
    await page.goto("/en/my-listings");
    await card(page, 1).getByRole("button", { name: "Mark as Sold" }).click();
    await expect(page.getByText("Who bought this item?")).toBeVisible();
    await page
      .getByRole("button", { name: /Sold to someone not on Hatiwal/ })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm sold" })
      .click();
    await expect(page.getByText("Listing marked as sold")).toBeVisible();
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
