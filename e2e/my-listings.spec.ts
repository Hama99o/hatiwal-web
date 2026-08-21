import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE, EMPTY_STATE } from "./auth-paths";
import en from "../messages/en.json";
import ps from "../messages/ps.json";
import fa from "../messages/fa.json";

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
  // 60s, not 30: a cold dev-mode compile of this route plus the authed proxy
  // round-trip can pass 30s on a loaded machine, and this wait is only the
  // PRE-condition of every spec below — timing out here reports a flake, not the
  // feature. The suite's own 120s test timeout is still the real ceiling.
  await expect(
    page.locator(`a[href^="/${locale}/my-listings/"]`).first(),
  ).toBeVisible({ timeout: 60_000 });
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
    await expect(page.getByText("Phone Cases Wholesale")).toBeVisible(); // multi-unit batch
    await expect(page.locator('a[href*="/my-listings/"]')).toHaveCount(8);
  });

  // The status filter is the shared SegmentedControl, so its options are `tab`s
  // inside a `tablist` (a11y: six same-shaped pills need a selected state and a
  // group name), not bare buttons.
  test("status tabs filter the grid in place", async ({ page }) => {
    await openMyShop(page);
    await expect(page.getByText("iPhone 13 Pro")).toBeVisible();
    const draftTab = page.getByRole("tab", { name: /^Draft/ });
    await expect(async () => {
      await draftTab.click();
      await expect(page.getByText("Antique Carpet")).toBeVisible();
      await expect(page.getByText("iPhone 13 Pro")).toHaveCount(0);
    }).toPass({ timeout: 20_000 });
    await expect(draftTab).toHaveAttribute("aria-selected", "true");
    // The Expired tab (active-but-past-its-run) is its own bucket, NOT Active.
    await expect(async () => {
      await page.getByRole("tab", { name: /^Expired/ }).click();
      await expect(page.getByText("Old Bicycle")).toBeVisible();
      await expect(page.getByText("iPhone 13 Pro")).toHaveCount(0);
    }).toPass({ timeout: 20_000 });
  });

  // Every filter option is a real tap target: this row is the only control on the
  // page that was ever below the 40px floor the cards' own actions hold.
  test("the status filter is a tablist whose options clear 40px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await openMyShop(page);
    const tablist = page.getByRole("tablist", { name: "Filter by status" });
    await expect(tablist).toBeVisible();
    const tabs = tablist.getByRole("tab");
    await expect(tabs).toHaveCount(6);
    for (const option of await tabs.all()) {
      expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(40);
    }
    // Six options with counts cannot fit one row on a phone — they wrap inside
    // the control instead of overflowing the page.
    const [listBox, viewport] = [
      (await tablist.boundingBox())!,
      page.viewportSize()!,
    ];
    expect(listBox.width).toBeLessThanOrEqual(viewport.width);
    expect(listBox.height).toBeGreaterThan(40); // more than one row
  });

  // The seller's own count of what has lapsed has to agree with the badge on the
  // card. Rails leaves `expired: false` until something touches the record, so
  // the tab buckets derive it from the shared `listingExpiryState()` rule (past
  // `expiresAt` = expired) rather than the raw flag — otherwise a lapsed listing
  // sat under Active, showing a red "Expired" pill and offering Renew, while the
  // Expired tab read (0).
  test("a lapsed listing counts as Expired even when the server flag is stale", async ({
    page,
  }) => {
    await page.route(
      (url) => url.pathname === "/api/me/my/listings",
      async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        // Rails' own drift shape: still `active`, run finished a week ago, flag
        // never updated. (The proxy passes Rails' snake_case straight through.)
        const stale = body.listings.find(
          (l: { title: string }) => l.title === "iPhone 13 Pro",
        );
        stale.expires_at = new Date(Date.now() - 7 * 86_400_000).toISOString();
        stale.expired = false;
        await route.fulfill({ response, json: body });
      },
    );
    await openMyShop(page);
    // The card says expired…
    await expect(
      card(page, 1).getByText("Expired", { exact: true }),
    ).toBeVisible();
    // …so its primary is Renew, and the tabs agree: Expired holds two, Active
    // has dropped it.
    await expect(card(page, 1).getByRole("button", { name: "Renew" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Expired (2)" })).toBeVisible();
    await expect(async () => {
      await page.getByRole("tab", { name: /^Active/ }).click();
      await expect(page.getByText("iPhone 13 Pro")).toHaveCount(0);
    }).toPass({ timeout: 20_000 });
    await page.getByRole("tab", { name: /^Expired/ }).click();
    await expect(page.getByText("iPhone 13 Pro")).toBeVisible();
  });

  // TASK-WEB-C2-ACTIONS — inline lifecycle quick-actions on each card, so a
  // seller never has to open /my-listings/[id] just to act.
  test("each card shows the primary action for its status", async ({ page }) => {
    await openMyShop(page);
    await expect(card(page, 8).getByRole("button", { name: "Publish" })).toBeVisible(); // draft
    // Active → Mark as Reserved, the same next step mobile's shared hook offers
    // (useListingLifecycle.ts). Sold is terminal, so it is not the primary
    // anywhere except on a listing that is already reserved.
    await expect(
      card(page, 1).getByRole("button", { name: "Mark as Reserved" }),
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

  // The primary is the loudest control in the footer, so it must not be set at
  // the card's caption size — and it must announce WHICH listing it acts on,
  // because a shop of seven active items would otherwise read out seven
  // identical "Mark as Reserved" buttons.
  test("the primary action is emphasised and names its listing", async ({
    page,
  }) => {
    await openMyShop(page);
    const primary = card(page, 1).getByRole("button", {
      name: "Mark as Reserved",
    });
    await expect(primary).toHaveAccessibleName(
      "Mark as Reserved — iPhone 13 Pro",
    );
    const { size, weight } = await primary.evaluate((el) => {
      const s = getComputedStyle(el);
      return { size: parseFloat(s.fontSize), weight: Number(s.fontWeight) };
    });
    // >= the 14px body step at desktop widths, and bolder than the default
    // medium — never the 12px meta step.
    expect(size).toBeGreaterThanOrEqual(14);
    expect(weight).toBeGreaterThanOrEqual(600);
  });

  // A terminal `sold` card's kebab is its ONLY control. Left as a lone glyph it
  // reads as a stray artifact and hides that Edit/Delete are still reachable, so
  // it takes the whole row and carries the word — same as mobile's card.
  test("a sold card's only control is a full-width labelled More button", async ({
    page,
  }) => {
    await openMyShop(page);
    const soldCard = card(page, 7);
    const more = soldCard.getByRole("button", { name: "More options" });
    await expect(more).toBeVisible();
    // The label is really rendered, not just an aria-label on an icon button.
    await expect(more).toContainText("More options");
    const [moreBox, cardBox] = [
      (await more.boundingBox())!,
      (await soldCard.boundingBox())!,
    ];
    // Full width of the card body (the footer's px-3 inset on either side).
    expect(moreBox.width).toBeGreaterThan(cardBox.width - 32);
    expect(moreBox.height).toBeGreaterThanOrEqual(40);
  });

  // On a phone this menu is the only path to Unpublish/Renew/Edit/Delete — with
  // Delete one separator below Edit — so its rows carry the same 40px floor as
  // the two controls that open it.
  test("every kebab menu item clears the 40px tap target", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await openMyShop(page);
    await card(page, 1).getByRole("button", { name: /^More options/ }).click();
    const items = page.getByRole("menu").getByRole("menuitem");
    await expect(items).toHaveCount(5); // sold · unpublish · renew · edit · delete
    for (const item of await items.all()) {
      expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(40);
    }
  });

  test("the kebab holds the secondary actions plus Edit and Delete", async ({
    page,
  }) => {
    await openMyShop(page);
    await card(page, 1).getByRole("button", { name: "More options" }).click();
    const menu = page.getByRole("menu");
    for (const label of [
      // Sold is here, not on the primary: it is terminal (no relist on web yet),
      // so it takes the deliberate route through the overflow menu.
      "Mark as Sold",
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

  // ── Multi-quantity (docs/SPIKE_LISTING_QUANTITY.md §0b) ────────────────────
  //
  // Listing 14 (Phone Cases Wholesale) is the batch fixture: 15 total, 4 sold, 11 left.
  // Before this, the web dialog sent no quantity at all, so Rails defaulted to
  // the WHOLE remaining stock — a web seller could only ever sell an entire
  // batch at once while a mobile seller could sell 3 of 15, on the same listing.

  test("selling a batch asks how many, pre-filled with the whole remainder", async ({
    page,
  }) => {
    await openMyShop(page);
    await card(page, 14).getByRole("button", { name: "More options" }).click();
    await page.getByRole("menuitem", { name: "Mark as Sold" }).click();
    await expect(page.getByText("Who bought this item?")).toBeVisible();

    // The field appears only once a real buyer is chosen — a sale to "someone
    // not on Hatiwal" records no transaction for a quantity to attach to.
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator("#soldUnits")).toHaveCount(0);
    await dialog.getByRole("button", { name: /Bilal Nazari/ }).first().click();

    // Pre-filled with all 11, so "I sold the lot" stays one click, and the
    // remainder is stated so the number is never typed blind.
    await expect(dialog.locator("#soldUnits")).toHaveValue("11");
    await expect(dialog.getByText("11 available")).toBeVisible();
    // And the final price says which number it is.
    await expect(dialog.getByText("The price for one item")).toBeVisible();
  });

  test("a single-item listing never asks how many", async ({ page }) => {
    // The governing rule: a seller with one item must not see this feature.
    await openMyShop(page);
    await card(page, 1).getByRole("button", { name: "More options" }).click();
    await page.getByRole("menuitem", { name: "Mark as Sold" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Sara Ahmadi/ }).first().click();
    await expect(dialog.locator("#soldUnits")).toHaveCount(0);
    await expect(dialog.getByText("The price for one item")).toHaveCount(0);
    // The final price itself is still offered — that part is unchanged.
    await expect(dialog.locator("#finalPrice")).toBeVisible();
  });

  test("reserving a batch never asks how many", async ({ page }) => {
    // A reservation is a hold on the whole listing, not a per-unit deduction the
    // backend models (spike §5.2 B).
    await openMyShop(page);
    await card(page, 14).getByRole("button", { name: "Mark as Reserved" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Bilal Nazari/ }).first().click();
    await expect(dialog.locator("#soldUnits")).toHaveCount(0);
  });

  test("Mark as Sold from the kebab opens the buyer picker", async ({
    page,
  }) => {
    // Both buyer-recording transitions go through the picker wherever they are
    // offered — this is the one that lives in the menu on an active card.
    await openMyShop(page);
    await card(page, 1).getByRole("button", { name: "More options" }).click();
    await page.getByRole("menuitem", { name: "Mark as Sold" }).click();
    await expect(page.getByText("Who bought this item?")).toBeVisible();
  });

  // A photoless listing in the seller's OWN shop is an action prompt — no photo
  // is why nobody is messaging them — so the placeholder says so in words instead
  // of showing a silent grey glyph (mobile's SellerListingCard does the same).
  //
  // It rides its OWN `nameMissingPhoto` flag, not the `showStatus` badge switch,
  // so every buyer-facing grid keeps the quiet tile. Both public surfaces are
  // asserted below — the feed, and the public seller profile's Sold grid, which
  // also sets `showStatus` and was the one that leaked the caption to buyers.
  test("a photoless card names the gap, and only in the seller's own shop", async ({
    page,
  }) => {
    await openMyShop(page);
    const draft = card(page, 8);
    await expect(draft.getByText("No photo")).toBeVisible();
    // The tile's accessible name is still the listing title (`role="img"` prunes
    // its own subtree), so the caption adds no duplicate screen-reader noise.
    await expect(
      draft.getByRole("img", { name: "Antique Carpet" }),
    ).toBeVisible();
    // Same fixture data on the public feed — every mock listing is photoless —
    // and there the caption must NOT appear.
    await page.goto("/en/bazaar");
    await expect(page.getByText("iPhone 13 Pro").first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText("No photo")).toHaveCount(0);
    // The public seller profile's Sold tab: `showStatus` is on here too (the
    // cards carry a dimmed "Sold" badge), so this is the surface that proves the
    // caption is gated on OWNERSHIP and not on the badge switch.
    await page.goto("/en/sellers/1");
    await page.getByRole("tab", { name: "Sold" }).click();
    const soldCard = page.locator('a[href="/en/listings/7"]');
    await expect(soldCard).toBeVisible({ timeout: 60_000 });
    // The lifecycle badge still renders on this photoless card — it is only the
    // caption that is suppressed, so the assertion below cannot pass by the grid
    // simply having failed to load.
    await expect(soldCard.getByText("Sold", { exact: true })).toBeVisible();
    await expect(page.getByText("No photo")).toHaveCount(0);
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
    // …including the buyer picker, which is the one that records a transaction.
    await card(page, 1)
      .getByRole("button", { name: "Mark as Reserved" })
      .click();
    await expect(
      page.getByRole("dialog").getByText("iPhone 13 Pro"),
    ).toBeVisible();
  });

  test("Mark as Reserved inline opens the buyer picker", async ({ page }) => {
    await openMyShop(page);
    await card(page, 1)
      .getByRole("button", { name: "Mark as Reserved" })
      .click();
    await expect(page.getByText("Who's buying this item?")).toBeVisible();
    await page
      .getByRole("button", { name: /Sold to someone not on Hatiwal/ })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm reserve" })
      .click();
    await expect(page.getByText("Listing marked as reserved")).toBeVisible();
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
    // Via the kebab: on an active card Mark as Sold is a secondary transition
    // (the primary is Mark as Reserved). The review prompt is what a *sale*
    // earns, so this is the path that has to reach it.
    await card(page, 1).getByRole("button", { name: "More options" }).click();
    await page.getByRole("menuitem", { name: "Mark as Sold" }).click();
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
    await expect(cards).toHaveCount(8);
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
    await expect(cards).toHaveCount(8);
    await expect(card(page, 8)).toBeVisible();
    await expect(skeletons).toHaveCount(0);
    // …and the per-status tab counts are still rendered off the same query.
    await expect(page.getByRole("tab", { name: /^All \(8\)/ })).toBeVisible();
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
      card(page, 1).getByRole("button", { name: "Mark as Reserved" }),
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

  // Phone widths, where this row is at its tightest: ListingGrid's `page` tracks
  // are `grid-cols-2` from the base breakpoint up, so a 2-column card is what
  // every phone gets. Both controls must keep the house 40px tap target, stay
  // inside the card (a wrapping label may grow the row taller, never wider) and
  // never clip their text.
  //
  // The two widths we pin — not the only narrow ones (320px also behaves,
  // measured) but the two that matter: 375 (iPhone portrait) and 360 (the most
  // common Android portrait width). Both are narrower than the ~150px of content
  // box this primary gets in a 2-column card, so both exercise the
  // `h-auto min-h-10 whitespace-normal` treatment — the label wraps, the row
  // keeps its 40px floor and stays inside the card instead of clipping.
  //
  // All three locales run, at both widths, but they do NOT pull equal weight.
  // English is the binding one: the primary label is now "Mark as Reserved"
  // (active listings offer reserve, not the terminal sold — mobile parity), which
  // is LONGER than the "Mark as Sold" this spec was first written against, so it
  // wraps at both widths in en. ps ("ریزرو کول") and fa ("ثبت رزرو") are the
  // roomier two, and are here for RTL: the box checks confirm a mirrored row
  // still starts and ends inside the card. Do not drop the `en` cases as "covered
  // by RTL"; they are the only ones that guard the primary's type scale.
  for (const width of [375, 360]) {
    for (const [locale, m] of [
      ["en", en],
      ["ps", ps],
      ["fa", fa],
    ] as const) {
      test(`the action row keeps its 40px targets inside a ${width}px 2-column card (${locale})`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 800 });
        await openMyShop(page, locale);
        // Listing 1 is the active one, so its footer is the full pair: the widest
        // primary label of the set next to the compact kebab.
        const activeCard = card(page, 1, locale);
        const cardBox = (await activeCard.boundingBox())!;
        const named = (template: string, title: string) =>
          activeCard.getByRole("button", {
            name: template.replace("{title}", title),
            exact: true,
          });
        for (const control of [
          named(m.listing.detail.actionFor.replace("{action}", m.listing.markReserved), "iPhone 13 Pro"),
          named(m.listing.detail.moreOptionsFor, "iPhone 13 Pro"),
        ]) {
          const box = (await control.boundingBox())!;
          expect(box.height).toBeGreaterThanOrEqual(40);
          expect(box.x).toBeGreaterThanOrEqual(cardBox.x - 1);
          expect(box.x + box.width).toBeLessThanOrEqual(
            cardBox.x + cardBox.width + 1,
          );
          // Not clipped: a control whose text overflowed its own box would still
          // satisfy the box checks above while reading "Mark as So…".
          // `scrollWidth <= clientWidth` is the assertion that catches that, and
          // `scrollHeight <= clientHeight` catches a wrapped line being cut off
          // by a fixed height (which is why the primary is `h-auto min-h-10`).
          const { scrollWidth, clientWidth, scrollHeight, clientHeight } =
            await control.evaluate((el) => ({
              scrollWidth: el.scrollWidth,
              clientWidth: el.clientWidth,
              scrollHeight: el.scrollHeight,
              clientHeight: el.clientHeight,
            }));
          expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
          expect(scrollHeight).toBeLessThanOrEqual(clientHeight + 1);
          // …and wrapping stays proportionate. At these widths the label is 12px
          // with `leading-tight` (15px a line, measured), so min-h-10 swallows one
          // AND two lines at exactly 40px; three would reach ~53px. A row past
          // 56px means the label has taken four lines and no longer fits.
          expect(box.height).toBeLessThanOrEqual(56);
        }
      });
    }
  }

  // The placeholder has to mirror the real card, action row included: without a
  // footer every card grows ~61px taller the moment ['my-listings'] lands and the
  // whole grid reflows under the seller's cursor.
  test("the loading placeholder reserves the action row's height", async ({
    page,
  }) => {
    await page.route(
      (url) => url.pathname === "/api/me/my/listings",
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2_500));
        await route.continue();
      },
    );
    await page.goto("/en/my-listings");
    // A skeleton card = a bordered card whose content is pulses.
    const skeletonCard = page
      .locator("main div.rounded-lg.border")
      .filter({ has: page.locator(".animate-pulse") })
      .first();
    await expect(skeletonCard).toBeVisible({ timeout: 30_000 });
    // Its last row is the footer placeholder: a full-width bar + a square kebab,
    // both at the 40px the real controls hold.
    const footerBars = skeletonCard.locator("div.border-t .animate-pulse");
    await expect(footerBars).toHaveCount(2);
    for (const bar of await footerBars.all()) {
      expect((await bar.boundingBox())!.height).toBeGreaterThanOrEqual(40);
    }
    const skeletonHeight = (await skeletonCard.boundingBox())!.height;

    // …and once the data lands the card is not a footer taller than the box that
    // stood in for it (the body's own text can differ by a line; a missing 40px+
    // action row cannot).
    const realCard = card(page, 1);
    await expect(realCard).toBeVisible({ timeout: 30_000 });
    const realHeight = (await realCard.boundingBox())!.height;
    expect(Math.abs(realHeight - skeletonHeight)).toBeLessThan(40);
  });

  // A seller whose grid fails to load must not be dead-ended into a manual page
  // reload — this is the screen they act on.
  test("a failed load shows the house error state with a working retry", async ({
    page,
  }) => {
    // `retry: 1` in the QueryClient means two attempts before the error state.
    let attempts = 0;
    await page.route(
      (url) => url.pathname === "/api/me/my/listings",
      async (route) => {
        attempts += 1;
        if (attempts <= 2) {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: "{}",
          });
          return;
        }
        await route.continue();
      },
    );
    await page.goto("/en/my-listings");
    await expect(page.getByText("Something went wrong")).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByText(/Check your connection and try again/),
    ).toBeVisible();
    // A transport error must never be phrased as an empty shop: the count line is
    // gated on real data (`isPending` is false in the error state, and the list
    // falls back to []), and the filter row — nothing to filter, no counts — is
    // hidden so the error owns the viewport.
    await expect(page.getByText("0 listings")).toHaveCount(0);
    await expect(
      page.getByRole("tablist", { name: "Filter by status" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByText("iPhone 13 Pro")).toBeVisible({
      timeout: 30_000,
    });
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
