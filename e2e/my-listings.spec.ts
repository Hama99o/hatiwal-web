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
    await expect(page.getByText("Old Bicycle")).toBeVisible(); // active + expired
    await expect(page.locator('a[href*="/my-listings/"]')).toHaveCount(7);
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
    // The Expired tab (active-but-past-30-days) is its own bucket, NOT Active.
    await expect(async () => {
      await page.getByRole("button", { name: /^Expired/ }).click();
      await expect(page.getByText("Old Bicycle")).toBeVisible();
      await expect(page.getByText("iPhone 13 Pro")).toHaveCount(0);
    }).toPass({ timeout: 20_000 });
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
    // Expired (active, past its run): Renew is the most useful next step.
    await expect(card(page, 10).getByRole("button", { name: "Renew" })).toBeVisible();
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

  // An expired listing is still a live `active` record — taking it down or
  // holding it for a buyer must stay reachable, not just Renew.
  test("an expired card can still be reserved or unpublished from the kebab", async ({
    page,
  }) => {
    await page.goto("/en/my-listings");
    await card(page, 10).getByRole("button", { name: "More options" }).click();
    const menu = page.getByRole("menu");
    for (const label of [
      "Mark as Sold",
      "Mark as Reserved",
      "Unpublish",
      "Edit",
      "Delete",
    ]) {
      await expect(menu.getByRole("menuitem", { name: label })).toBeVisible();
    }
  });

  test("a secondary action from the kebab opens its confirm and completes", async ({
    page,
  }) => {
    await page.goto("/en/my-listings");
    await card(page, 1).getByRole("button", { name: "More options" }).click();
    await page.getByRole("menuitem", { name: "Unpublish" }).click();
    // The confirm prompt must be usable right after the menu closes.
    await expect(page.getByText("Unpublish this listing?")).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Unpublish" })
      .click();
    await expect(page.getByText("Listing unpublished")).toBeVisible();
  });

  test("Mark as Reserved from the kebab opens the buyer picker", async ({
    page,
  }) => {
    await page.goto("/en/my-listings");
    await card(page, 1).getByRole("button", { name: "More options" }).click();
    await page.getByRole("menuitem", { name: "Mark as Reserved" }).click();
    await expect(page.getByText("Who's buying this item?")).toBeVisible();
  });

  test("the kebab is labelled with its listing so the six aren't identical", async ({
    page,
  }) => {
    await page.goto("/en/my-listings");
    await expect(
      card(page, 8).getByRole("button", {
        name: "More options for Antique Carpet",
      }),
    ).toBeVisible();
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

  // A sale that identifies a real buyer records a Transaction, so the seller is
  // invited to rate them immediately (REV2). The prompt is owned by the LIST,
  // not by the card: the ['my-listings'] refetch that follows the sale drops the
  // now-sold card out of a filtered tab, unmounting its action row — a prompt
  // living in there would vanish before the seller could use it.
  test("Mark as Sold with a real buyer opens the review prompt", async ({
    page,
  }) => {
    await page.goto("/en/my-listings");
    await card(page, 1).getByRole("button", { name: "Mark as Sold" }).click();
    await expect(page.getByText("Who bought this item?")).toBeVisible();
    await page.getByRole("button", { name: /Sara Ahmadi/ }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm sold" })
      .click();
    await expect(page.getByText("Listing marked as sold")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "How was Sara Ahmadi as a buyer?" }),
    ).toBeVisible();
    await expect(page.getByText("Your rating")).toBeVisible();
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
