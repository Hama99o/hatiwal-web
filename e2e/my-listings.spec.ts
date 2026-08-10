import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE, EMPTY_STATE } from "./auth-paths";
import ps from "../messages/ps.json";

/** One seller card: the wrapper around the link to that listing's owner page. */
function card(page: Page, id: number, locale = "en") {
  return page.locator(`a[href="/${locale}/my-listings/${id}"]`).locator("..");
}

/**
 * Open My Shop and wait for the grid itself.
 *
 * The listings come from React Query through the authed proxy, and every inline
 * quick-action lives in a card FOOTER — so asserting on a button straight after
 * `goto` races the fetch (and, on a cold dev server, the route compile) rather
 * than the feature. Wait for the cards once, here.
 */
async function openMyShop(page: Page, locale = "en") {
  await page.goto(`/${locale}/my-listings`);
  await expect(
    page.locator(`a[href^="/${locale}/my-listings/"]`).first(),
  ).toBeVisible({ timeout: 30_000 });
}

test.describe("My Shop (seller dashboard)", () => {
  test.use({ storageState: BUYER_STATE });

  test("lists the seller's listings across all statuses", async ({ page }) => {
    await openMyShop(page);
    await expect(page.getByRole("heading", { name: "My Shop" })).toBeVisible();
    // Seller 1 owns one listing in each lifecycle state.
    await expect(page.getByText("iPhone 13 Pro")).toBeVisible();
    await expect(page.getByText("Antique Carpet")).toBeVisible(); // draft
    await expect(page.getByText("Gaming PC")).toBeVisible(); // reserved
    await expect(page.getByText("Old Bicycle")).toBeVisible(); // active + expired
    await expect(page.locator('a[href*="/my-listings/"]')).toHaveCount(7);
  });

  test("status tabs filter the grid in place", async ({ page }) => {
    await openMyShop(page);
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
    await openMyShop(page);
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
    await openMyShop(page);
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
    await openMyShop(page);
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
    await openMyShop(page);
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
    await openMyShop(page);
    await card(page, 1).getByRole("button", { name: "More options" }).click();
    await page.getByRole("menuitem", { name: "Mark as Reserved" }).click();
    await expect(page.getByText("Who's buying this item?")).toBeVisible();
  });

  test("the kebab is labelled with its listing so the six aren't identical", async ({
    page,
  }) => {
    await openMyShop(page);
    await expect(
      card(page, 8).getByRole("button", {
        name: "More options for Antique Carpet",
      }),
    ).toBeVisible();
  });

  test("publishing a draft inline confirms, then toasts", async ({ page }) => {
    await openMyShop(page);
    await card(page, 8).getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Publish this listing?")).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Publish" })
      .click();
    await expect(page.getByText("Listing published!")).toBeVisible();
  });

  test("deleting inline confirms, then toasts", async ({ page }) => {
    await openMyShop(page);
    await card(page, 8).getByRole("button", { name: "More options" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(page.getByText("Delete this listing?")).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete Listing" })
      .click();
    await expect(page.getByText("Listing deleted")).toBeVisible();
  });

  // The prompt opens OVER the grid and hides the card that was clicked, so it
  // has to name the listing — otherwise a mis-click deletes the wrong item with
  // a confirm the seller cannot check.
  test("every inline prompt names the listing it will act on", async ({
    page,
  }) => {
    await openMyShop(page);
    await card(page, 8).getByRole("button", { name: "Publish" }).click();
    const confirm = page.getByRole("dialog");
    await expect(confirm.getByText("Antique Carpet")).toBeVisible();
    await confirm.getByRole("button", { name: "Cancel" }).click();
    // …including the buyer picker, which is the one that records a sale.
    await card(page, 1).getByRole("button", { name: "Mark as Sold" }).click();
    await expect(
      page.getByRole("dialog").getByText("iPhone 13 Pro"),
    ).toBeVisible();
  });

  test("Mark as Sold inline opens the buyer picker", async ({ page }) => {
    await openMyShop(page);
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
    await openMyShop(page);
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

  // The whole point of acting inline: the grid updates from the ['my-listings']
  // refetch WITHOUT leaving the page and without the cached cards being replaced
  // by the loading skeleton (React Query keeps the data while it revalidates).
  test("an inline action updates the grid in place — no reload, no skeleton flash", async ({
    page,
  }) => {
    await openMyShop(page);
    const cards = page.locator('a[href*="/my-listings/"]');
    await expect(cards).toHaveCount(7);
    // The skeleton lives in the page body; the header's own avatar placeholder
    // is outside <main>, so this only sees the grid's.
    const skeletons = page.locator("main .animate-pulse");

    await card(page, 8).getByRole("button", { name: "Publish" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Publish" })
      .click();
    await expect(page.getByText("Listing published!")).toBeVisible();

    await expect(page).toHaveURL(/\/en\/my-listings$/);
    await expect(cards).toHaveCount(7);
    await expect(card(page, 8)).toBeVisible();
    await expect(skeletons).toHaveCount(0);
    // …and the per-status tab counts are still rendered off the same query.
    await expect(page.getByRole("button", { name: /^All \(7\)/ })).toBeVisible();
  });

  test("a failed inline action toasts the error and leaves the card unchanged", async ({
    page,
  }) => {
    await page.route("**/api/me/my/listings/1/unpublish", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
    );
    await openMyShop(page);
    await card(page, 1).getByRole("button", { name: "More options" }).click();
    await page.getByRole("menuitem", { name: "Unpublish" }).click();
    const confirm = page.getByRole("dialog");
    await confirm.getByRole("button", { name: "Unpublish" }).click();
    await expect(
      page.locator("[data-sonner-toast]").getByText("Error", { exact: true }),
    ).toBeVisible();
    // The prompt stays open so the seller can retry, and nothing about the card
    // changed — it still offers the same primary action for an active listing.
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(
      card(page, 1).getByRole("button", { name: "Mark as Sold" }),
    ).toBeVisible();
  });

  test("the action row is disabled while a mutation is in flight", async ({
    page,
  }) => {
    // Hold the lifecycle response open so the in-flight state is observable.
    await page.route("**/api/me/my/listings/8/publish", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      await route.continue();
    });
    await openMyShop(page);
    const draftCard = card(page, 8);
    await draftCard.getByRole("button", { name: "Publish" }).click();
    const confirm = page.getByRole("dialog");
    await confirm.getByRole("button", { name: "Publish" }).click();
    // No double-submit: the prompt's own buttons and the card's whole action row
    // are disabled until the request settles.
    await expect(confirm.getByRole("button", { name: "Publish" })).toBeDisabled();
    await expect(confirm.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await expect(draftCard.getByRole("button", { name: "Publish" })).toBeDisabled();
    await expect(
      draftCard.getByRole("button", { name: /^More options/ }),
    ).toBeDisabled();
    await expect(page.getByText("Listing published!")).toBeVisible();
    await expect(draftCard.getByRole("button", { name: "Publish" })).toBeEnabled();
  });

  // RTL: Pashto reads right-to-left, so the row and the kebab's menu must mirror
  // (logical properties + Radix's `dir`), not stay pinned to the left.
  test("the action row and its menu mirror in RTL (ps)", async ({ page }) => {
    await openMyShop(page, "ps");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const draftCard = card(page, 8, "ps");
    await expect(
      draftCard.getByRole("button", { name: ps.listing.publish }),
    ).toBeVisible();
    const kebab = draftCard.getByRole("button", {
      name: ps.listing.detail.moreOptionsFor.replace("{title}", "Antique Carpet"),
    });
    // Measured BEFORE opening: an open Radix menu aria-hides the rest of the
    // page, so the trigger is no longer reachable by role.
    const kebabBox = (await kebab.boundingBox())!;
    await kebab.click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute("dir", "rtl");
    await expect(
      menu.getByRole("menuitem", { name: ps.common.delete }),
    ).toBeVisible();
    // Mirrored placement: with dir=rtl an `end`-aligned menu hangs off the
    // trigger's LEFT edge, and must stay inside the viewport.
    const menuBox = (await menu.boundingBox())!;
    expect(menuBox.x).toBeLessThan(kebabBox.x + kebabBox.width);
    expect(menuBox.x).toBeGreaterThanOrEqual(0);
  });

  // The narrowest place this row ever lands: a 2-column grid on a 375px phone.
  // Both controls must keep the house 40px tap target AND stay inside the card
  // (a wrapping label may grow the row taller, never wider).
  test("the action row keeps its 40px targets inside a 375px 2-column card", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await openMyShop(page);
    const activeCard = card(page, 1);
    const cardBox = (await activeCard.boundingBox())!;
    for (const control of [
      activeCard.getByRole("button", { name: "Mark as Sold" }),
      activeCard.getByRole("button", { name: /^More options/ }),
    ]) {
      const box = (await control.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(40);
      expect(box.x).toBeGreaterThanOrEqual(cardBox.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
    }
  });

  test("New Listing navigates to the create form", async ({ page }) => {
    await openMyShop(page);
    await page.getByRole("link", { name: /New Listing/i }).first().click();
    await expect(page).toHaveURL(/\/listings\/new/, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: "Create Listing" }),
    ).toBeVisible();
  });
});

test.describe("My Shop (empty)", () => {
  test.use({ storageState: EMPTY_STATE });

  // No cards to wait for here, so this one navigates directly (openMyShop waits
  // for the grid, which is exactly what this seller does not have).
  test("shows the empty state with a create CTA", async ({ page }) => {
    await page.goto("/en/my-listings");
    await expect(
      page.getByText("You haven't posted anything yet"),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByText("Post your first listing to start selling."),
    ).toBeVisible();
  });
});

test.describe("My Shop (guest)", () => {
  test("redirects an unauthenticated visitor to login", async ({ page }) => {
    await page.goto("/en/my-listings");
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
  });
});
