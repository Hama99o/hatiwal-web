import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import en from "../messages/en.json";
import fa from "../messages/fa.json";

/**
 * The rebuilt sell flow, web half (SF-W1) — the parts that are new here rather
 * than adjustments to existing specs.
 *
 * What the model asserts, and what each used to be:
 *   - Sell in ONE tap from any live listing; reserve is never a prerequisite.
 *   - THREE presented states (Draft / Live / Sold). A held listing is Live plus
 *     a badge — not a fourth tab, and not a dead end.
 *   - Holds are placed and released from the CHAT thread, because a hold is for
 *     a person.
 *   - UNDO, not correction forms: an Undo on the sold toast, plus editable and
 *     voidable rows in a Sales ledger.
 *   - Quantity is CAP + REASON — capped at stock, and it says why.
 *   - Refusals arrive as machine `code`s and render LOCALIZED; the server's
 *     English prose is never shown.
 *
 * Fixtures (e2e/mock-api/server.mjs):
 *   1  — active, single item, seller 1
 *   14 — active BATCH, 15 total / 4 sold / 11 left, with 2 HELD for Sara Ahmadi
 *        while `status` stays "active" (the shape that makes
 *        `status === "reserved"` the wrong test for "has a hold")
 *   9  — reserved, single item, seller 1, held for Najib Rahimi
 *   6  — reserved, seller 2 (so the signed-in persona is a BUYER there)
 *   Ledger rows 701 (3 units → Sara) and 702 (1 unit, buyer NULL, carries a
 *   review) both belong to listing 14.
 */

function card(page: Page, id: number, locale = "en") {
  return page.locator(`a[href="/${locale}/my-listings/${id}"]`).locator("..");
}

async function openMyShop(page: Page, locale = "en") {
  await page.goto(`/${locale}/my-listings`);
  await expect(
    page.locator(`a[href^="/${locale}/my-listings/"]`).first(),
  ).toBeVisible({ timeout: 60_000 });
}

async function openSales(page: Page, id: number, locale = "en") {
  await page.goto(`/${locale}/my-listings/${id}/sales`);
  await expect(
    page.getByRole("heading", { name: en.listing.salesScreen.title }),
  ).toBeVisible({ timeout: 60_000 });
}

test.describe("Sell flow — three presented states", () => {
  test.use({ storageState: BUYER_STATE });

  test("the seller sees Draft / Live / Sold, never a Reserved tab", async ({
    page,
  }) => {
    await openMyShop(page);
    const tabs = page.getByRole("tablist", { name: en.listing.filter.label });
    // The four values still exist in the database; what changed is that the
    // seller is not asked to navigate by them.
    await expect(
      tabs.getByRole("tab", { name: /^Reserved/ }),
    ).toHaveCount(0);
    for (const name of [/^All/, /^Active/, /^Expired/, /^Draft/, /^Sold/]) {
      await expect(tabs.getByRole("tab", { name })).toBeVisible();
    }
  });

  test("a held listing lives under Active, not in a tab of its own", async ({
    page,
  }) => {
    await openMyShop(page);
    // Listing 9 IS `status: "reserved"`. Under Active is exactly where a seller
    // looks for it — its own tab is what made held stock vanish from the tab
    // they were already on.
    await page
      .getByRole("tablist", { name: en.listing.filter.label })
      .getByRole("tab", { name: /^Active/ })
      .click();
    await expect(card(page, 9)).toBeVisible();
    // And it is still sellable from there in one click.
    await expect(
      card(page, 9).getByRole("button", { name: /^Mark as Sold/ }),
    ).toBeVisible();
  });

  test("a held listing offers Release hold — read off the SALE, not the status", async ({
    page,
  }) => {
    await openMyShop(page);
    // Listing 14 is `status: "active"` and holds 2 units for a buyer. Testing the
    // status would find no hold here at all, which is precisely the bug: a
    // batch's hold would be impossible to release.
    await card(page, 14).getByRole("button", { name: /^More options/ }).click();
    await expect(
      page
        .getByRole("menu")
        .getByRole("menuitem", { name: en.listing.releaseHold }),
    ).toBeVisible();
  });

  test("a listing with no hold offers no Release hold", async ({ page }) => {
    await openMyShop(page);
    await card(page, 1).getByRole("button", { name: /^More options/ }).click();
    await expect(
      page
        .getByRole("menu")
        .getByRole("menuitem", { name: en.listing.releaseHold }),
    ).toHaveCount(0);
  });

  test("the stock pill names the hold, with the buyer's name for the owner", async ({
    page,
  }) => {
    await page.goto("/en/my-listings/14");
    // Owner phrasing: progress through the batch, plus who the hold is for.
    await expect(page.getByText(/11 of 15 left/)).toBeVisible();
    await expect(page.getByText(/2 held for Sara Ahmadi/)).toBeVisible();
  });

  test("a BUYER sees the held count but never the buyer's identity", async ({
    page,
  }) => {
    // Listing 14's public detail page. `held_units` is a base serializer field
    // (public, identity-free); the name lives only on the owner-only `sale`.
    await page.goto("/en/listings/14");
    // 60s like the other first-assertions in this file: a cold dev-mode compile
    // of the listing-detail route (its map island included) can pass the default
    // 15s on a loaded machine, and timing out here reports a flake rather than
    // the feature. It did exactly that once before this timeout was added.
    await expect(page.getByText(/2 held/).first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText(/held for Sara Ahmadi/)).toHaveCount(0);
  });
});

test.describe("Sell flow — sell in one tap", () => {
  test.use({ storageState: BUYER_STATE });

  test("selling never requires reserving first", async ({ page }) => {
    await openMyShop(page);
    const footer = card(page, 1);
    // ONE click from the card to the sale. No reserve step exists to take.
    await footer.getByRole("button", { name: /^Mark as Sold/ }).click();
    await expect(page.getByText(en.buyerPicker.soldTitle)).toBeVisible();
  });

  test("marking sold offers an Undo that voids the sale", async ({ page }) => {
    await openMyShop(page);
    await card(page, 1).getByRole("button", { name: /^Mark as Sold/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Sara Ahmadi/ }).first().click();

    const undone = page.waitForRequest(
      (r) =>
        /\/api\/me\/my\/transactions\/\d+$/.test(r.url()) &&
        r.method() === "DELETE",
    );
    await dialog.getByRole("button", { name: en.buyerPicker.confirmSold }).click();

    // The toast is the whole reason a one-tap sale is safe to make the loudest
    // control on the card: a wrong tap costs one click to reverse.
    //
    // Asserted ON THE TOAST, in one wait, rather than as "success text visible"
    // and then "click Undo". Two sequential waits raced the toast's own lifetime
    // on a loaded machine: the first could take 12s to settle, by which point the
    // action it was about to click had already timed out. The toast carries both
    // facts, so it is one locator.
    const sold = page.locator("[data-sonner-toast]").filter({
      hasText: en.listing.markSoldSuccess,
    });
    await expect(sold).toBeVisible();
    await sold.getByRole("button", { name: en.common.undo }).click();

    // It calls the SAME endpoint the ledger row's Delete does — one correction
    // mechanism, not a special short-lived undo path.
    await undone;
    await expect(page.getByText(en.listing.sale.voidedSuccess)).toBeVisible();
  });

  test("a sale with NO buyer prompts for no review", async ({ page }) => {
    // Since an outside sale started recording a real ledger row, the lifecycle
    // response returns a transaction here too — so the review prompt has to gate
    // on the BUYER, not on the transaction. Gating on the transaction opened a
    // review dialog with no counterparty, which read `buyer.name` and crashed.
    await openMyShop(page);
    await card(page, 1).getByRole("button", { name: /^Mark as Sold/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: /Sold to someone not on Hatiwal/ })
      .click();
    await dialog.getByRole("button", { name: en.buyerPicker.confirmSold }).click();

    await expect(page.getByText(en.listing.markSoldSuccess)).toBeVisible();
    // No review prompt, and no crash: the page is still alive and rendering.
    await expect(
      page.getByText(en.reviews.promptSellerTitle.replace("{name}", "")),
    ).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "My Shop" })).toBeVisible();
  });

  test("the final price is offered on an outside sale too", async ({ page }) => {
    // It used to be hidden there, because such a sale "records no transaction so
    // the price has nowhere to attach". It does now — hiding the field just lost
    // the seller the figure they actually got.
    await openMyShop(page);
    await card(page, 14).getByRole("button", { name: /^Mark as Sold/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: /Sold to someone not on Hatiwal/ })
      .click();
    await expect(dialog.locator("#finalPrice")).toBeVisible();
    // The review NUDGE still only applies where there is somebody to review.
    await expect(dialog.getByText(en.buyerPicker.nudge)).toHaveCount(0);
  });
});

test.describe("Sell flow — holds live in the chat thread", () => {
  test.use({ storageState: BUYER_STATE });

  test("the seller's thread leads with Mark sold and offers a hold", async ({
    page,
  }) => {
    // Conversation 1 is about listing 1 (single item, no hold), with the
    // signed-in user as its SELLER.
    await page.goto("/en/conversations/1");
    await expect(
      page.getByRole("button", { name: en.chat.listingActions.markSold }),
    ).toBeVisible({ timeout: 60_000 });
    // Mark sold is the primary; the hold is the quiet secondary beside it. The
    // header used to show "Mark as Reserved" on an active listing and "Mark as
    // Sold" only once reserved — the reserve-then-sold ladder, inside chat.
    await expect(
      page.getByRole("button", { name: /Mark as Reserved/ }),
    ).toHaveCount(0);
    // The hold names the person it is for — that is the whole reason it lives
    // here and not on the listing.
    await expect(
      page.getByRole("button", {
        name: en.chat.listingActions.placeHold.replace("{name}", "Sara Ahmadi"),
      }),
    ).toBeVisible();
  });

  test("a hold for a DIFFERENT buyer is stated, not offered for release", async ({
    page,
  }) => {
    // Conversation 4 is about listing 14 (the batch) with Bilal Nazari, but the
    // batch's 2 held units belong to Sara Ahmadi. Releasing another buyer's hold
    // from the wrong thread is how a seller cancels the wrong deal — so this
    // thread says what is going on and offers no button.
    await page.goto("/en/conversations/4");
    await expect(
      page.getByRole("button", { name: en.chat.listingActions.markSold }),
    ).toBeVisible({ timeout: 60_000 });
    await expect(
      page.getByText(en.chat.listingActions.heldForSomeoneElse),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: en.chat.listingActions.releaseHold }),
    ).toHaveCount(0);
    // …and neither is a second hold offered on top of the existing one.
    await expect(page.getByRole("button", { name: /Place a hold/ })).toHaveCount(
      0,
    );
  });

  test("marking sold from a thread never shows a buyer list", async ({
    page,
  }) => {
    await page.goto("/en/conversations/1");
    await page
      .getByRole("button", { name: en.chat.listingActions.markSold })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // The buyer is whoever the seller is already talking to, so there is nothing
    // to pick — and the "select from your conversations" subtitle would be false.
    await expect(dialog.getByText(en.buyerPicker.subtitle)).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: /Sold to someone not on Hatiwal/ }),
    ).toHaveCount(0);
    // Confirm is live immediately: the decision was made by opening this.
    await expect(
      dialog.getByRole("button", { name: en.buyerPicker.confirmSold }),
    ).toBeEnabled();
  });
});

test.describe("Sell flow — the Sales ledger", () => {
  test.use({ storageState: BUYER_STATE });

  test("lists every buyer of a batch, the outside sale included", async ({
    page,
  }) => {
    await openSales(page, 14);
    // MANY BUYERS PER BATCH, each its own row.
    await expect(page.getByTestId("sale-row")).toHaveCount(2);
    await expect(page.getByText("Sara Ahmadi")).toBeVisible();
    // A sale with no counterparty account is a real sale, labelled as one —
    // not an empty identity and not a missing row.
    await expect(page.getByText(en.listing.sale.outsideBuyer)).toBeVisible();
    // The tally counts UNITS (3 + 1), not rows.
    await expect(page.getByText("4 of 15 sold")).toBeVisible();
  });

  test("a row's quantity is capped at what the batch can hold, and says why", async ({
    page,
  }) => {
    await openSales(page, 14);
    await page.getByTestId("sale-row").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(en.listing.sale.editSale)).toBeVisible();

    const units = dialog.getByTestId("quantity-input");
    // Row 701 sold 3 of a 15-batch whose other row took 1, so this row may grow
    // to 14 — and no further.
    await expect(units).toHaveValue("3");
    await units.fill("99");
    await expect(units).toHaveValue("14");
    await expect(dialog.getByTestId("quantity-cap-reason")).toBeVisible();
  });

  test("a reviewed sale refuses to be voided — LOCALIZED, never Rails' English", async ({
    page,
  }) => {
    await openSales(page, 14);
    // Row 702 (the outside sale) carries a review in the fixture.
    await page.getByText(en.listing.sale.outsideBuyer).click();
    // Both dialogs are `role="dialog"` and both carry a "Delete", so each is
    // addressed by its own accessible name — the edit sheet, then the confirm it
    // opens on top.
    const dialog = page.getByRole("dialog", { name: en.listing.sale.editSale });
    await dialog.getByRole("button", { name: en.common.delete }).click();
    await page
      .getByRole("dialog", { name: en.listing.sale.voidConfirm })
      .getByRole("button", { name: en.common.delete })
      .click();

    // The localized sentence, from the machine `code`.
    await expect(dialog.getByTestId("sale-edit-error")).toHaveText(
      en.listing.sale.voidBlockedReviewed,
    );
    // NOT the server's English prose, which the 422 also carries as a fallback.
    await expect(page.getByText(/Sale has a review and cannot/)).toHaveCount(0);

    // And the refusal is STRUCTURAL, not just a sentence: the controls that
    // cannot work are withdrawn, while quantity and price stay editable —
    // fixing a typo'd count harms no review.
    await expect(
      dialog.getByRole("button", { name: en.common.delete }),
    ).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: en.listing.sale.changeBuyer }),
    ).toHaveCount(0);
    await expect(dialog.getByTestId("quantity-input")).toBeEnabled();
  });

  test("the ledger is reachable from the listing the moment a unit has sold", async ({
    page,
  }) => {
    await page.goto("/en/my-listings/14");
    await expect(
      page.getByRole("link", { name: en.listing.viewSales }),
    ).toHaveAttribute("href", "/en/my-listings/14/sales");

    // Nothing has sold on listing 1, so there is no ledger to offer.
    await page.goto("/en/my-listings/1");
    await expect(
      page.getByRole("link", { name: en.listing.viewSales }),
    ).toHaveCount(0);
  });

  test("the ledger is localized and RTL in fa", async ({ page }) => {
    await page.goto("/fa/my-listings/14/sales");
    await expect(
      page.getByRole("heading", { name: fa.listing.salesScreen.title }),
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(fa.listing.sale.outsideBuyer)).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    // The page must not scroll sideways in RTL at phone width.
    await page.setViewportSize({ width: 375, height: 800 });
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
