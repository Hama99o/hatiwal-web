import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

test.describe("Listing detail", () => {
  test("shows full listing info, seller and description", async ({ page }) => {
    await page.goto("/en/listings/1");
    await expect(page.getByRole("heading", { name: "iPhone 13 Pro" })).toBeVisible();
    await expect(page.getByText("AFN 45,000")).toBeVisible();
    await expect(page.getByText("Barely used iPhone 13 Pro, 256GB.")).toBeVisible();
    await expect(page.getByText("Ahmad Karimi")).toBeVisible();
    await expect(page.getByText("Phones & Tablets")).toBeVisible();
    await expect(page.getByText(/12% price drop/i)).toBeVisible();
  });

  test("gated actions are present (Message Seller / Report)", async ({ page }) => {
    await page.goto("/en/listings/1");
    await expect(page.getByText(/Message Seller/i)).toBeVisible();
    await expect(page.getByText(/Report/i).first()).toBeVisible();
  });

  test("unknown listing id returns a 404", async ({ page }) => {
    const resp = await page.goto("/en/listings/99999");
    expect(resp?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  });

  test("a reserved listing is still viewable by direct id", async ({ page }) => {
    const resp = await page.goto("/en/listings/6");
    expect(resp?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Mountain Bike (Reserved)" })).toBeVisible();
  });

  test("a guest is told the seller is away", async ({ page }) => {
    // Control for the owner case below: seller 1 has a future away date in the
    // fixture, and a buyer must see it — it sets the reply-time expectation
    // before they write.
    await page.goto("/en/listings/1");
    await expect(page.getByText(/Seller is away until/i)).toBeVisible();
  });

  test("meetup safety tips open in a dialog and close", async ({ page }) => {
    await page.goto("/en/listings/1");
    await page
      .getByRole("button", { name: /Meetup safety tips/i })
      .click();
    await expect(
      page.getByRole("heading", { name: "Meetup Safety Tips" }),
    ).toBeVisible();
    await expect(
      page.getByText(/Meet in a busy, public place/i),
    ).toBeVisible();
    await page.getByRole("button", { name: "Got it" }).click();
    await expect(
      page.getByRole("heading", { name: "Meetup Safety Tips" }),
    ).toHaveCount(0);
  });
});

// Two cross-sell rails at the bottom of the page, both rendered by the shared
// <ListingRail>: the seller's other active stock first, then same-category
// "Similar Listings". Fixture map used below:
//   listing 2 = Samsung 4K TV, ACTIVE, seller 2 (Sara Ahmadi), cat Electronics
//               → seller 2's other active stock = Winter Jacket; the same-category
//                 rail rolls Electronics' subcategories up (iPhone, MacBook).
//   listing 4 = Winter Jacket, ACTIVE, seller 2, cat Clothes — the only
//               browsable listing in Clothes → no similar rail at all.
//   listing 7 = Leather Sofa, SOLD, seller 1 (Ahmad Karimi), cat Clothes
//               → both rails render.
test.describe("Listing detail — cross-sell rails", () => {
  test("the seller's other active stock renders as its own rail", async ({
    page,
  }) => {
    await page.goto("/en/listings/2");
    const rail = page.getByTestId("seller-rail");
    await expect(
      rail.getByRole("heading", { name: "More from this Seller" }),
    ).toBeVisible();
    await expect(rail.getByText("Winter Jacket")).toBeVisible();
    // Never re-advertises the listing you are already looking at.
    await expect(rail.getByText("Samsung 4K TV")).toHaveCount(0);
    // An active listing keeps the rail's own "view all" → the seller profile.
    await expect(
      rail.getByRole("link", { name: /View all/i }),
    ).toHaveAttribute("href", "/en/sellers/2");
    // Same-category rail expands to the category's children too (Rails'
    // Listing.by_category → self_and_children), so a listing filed directly
    // under Electronics still cross-sells the phone and the laptop below it.
    const similar = page.getByTestId("similar-rail");
    await expect(similar.getByText("iPhone 13 Pro")).toBeVisible();
    await expect(similar.getByText("MacBook Pro M2")).toBeVisible();
  });

  test("no dangling similar rail when the category has no other stock", async ({
    page,
  }) => {
    // Winter Jacket is the only browsable listing in Clothes.
    await page.goto("/en/listings/4");
    await expect(page.getByTestId("seller-rail")).toBeVisible();
    await expect(page.getByTestId("similar-rail")).toHaveCount(0);
  });

  test("seller stock is ranked above the category rail", async ({ page }) => {
    await page.goto("/en/listings/7");
    const rails = page.locator('[data-testid$="-rail"]');
    await expect(rails).toHaveCount(2);
    // The buyer has just read the seller trust card, so that seller's stock is
    // the first thing offered.
    await expect(rails.nth(0)).toHaveAttribute("data-testid", "seller-rail");
    await expect(rails.nth(1)).toHaveAttribute("data-testid", "similar-rail");
    await expect(
      page.getByTestId("seller-rail").getByText("iPhone 13 Pro"),
    ).toBeVisible();
    await expect(
      page.getByTestId("similar-rail").getByText("Winter Jacket"),
    ).toBeVisible();
  });

  test("a sold listing keeps exactly one seller-profile CTA", async ({
    page,
  }) => {
    // <UnavailableActions> already owns a prominent, name-carrying button to
    // this seller, so the rail below drops its duplicate "view all".
    await page.goto("/en/listings/7");
    await expect(
      page
        .getByTestId("unavailable-actions")
        .getByRole("link", { name: /More from Ahmad Karimi/i }),
    ).toHaveAttribute("href", "/en/sellers/1");
    const rail = page.getByTestId("seller-rail");
    await expect(rail).toBeVisible();
    await expect(rail.getByRole("link", { name: /View all/i })).toHaveCount(0);
  });

  test("same on a reserved listing", async ({ page }) => {
    await page.goto("/en/listings/6");
    await expect(
      page
        .getByTestId("unavailable-actions")
        .getByRole("link", { name: /More from Sara Ahmadi/i }),
    ).toBeVisible();
    await expect(
      page.getByTestId("seller-rail").getByRole("link", { name: /View all/i }),
    ).toHaveCount(0);
  });

  test("rails are localized and keep the locale prefix (ps)", async ({
    page,
  }) => {
    await page.goto("/ps/listings/7");
    await expect(
      page
        .getByTestId("seller-rail")
        .getByRole("heading", { name: "د دې پلورونکي نور توکي" }),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("similar-rail")
        .getByRole("heading", { name: "ورته توکي" }),
    ).toBeVisible();
  });

  test("ps keeps the locale prefix on the rail's view-all", async ({ page }) => {
    await page.goto("/ps/listings/2");
    await expect(
      page.getByTestId("seller-rail").getByRole("link", { name: "ټول وګورئ" }),
    ).toHaveAttribute("href", "/ps/sellers/2");
  });

  test("both rails lay out on the 4-column rail track, capped at 4 cards", async ({
    page,
  }) => {
    // The cap (4) has to divide the rail's column count so a rail never wraps a
    // lone orphan card onto a second row: 4 cards in the page grid's 5 tracks
    // left a hole, 5 cards in 4 tracks left an orphan. `size="sm"` rails use
    // grid-cols-2 md:grid-cols-4 instead.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/en/listings/7");
    for (const testId of ["seller-rail", "similar-rail"]) {
      const rail = page.getByTestId(testId);
      const grid = rail.locator("div.grid");
      const tracks = await grid.evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
      );
      expect(tracks).toBe(4);
      const cards = rail.locator('a[href*="/listings/"]');
      expect(await cards.count()).toBeLessThanOrEqual(4);
    }
  });

  test("a guest sees the seller rail on listing 1", async ({ page }) => {
    // Control for the owner case below: signed out, seller 1's other stock is
    // exactly what a buyer should be offered here.
    await page.goto("/en/listings/1");
    const rail = page.getByTestId("seller-rail");
    await expect(rail).toBeVisible();
    await expect(rail.getByText("Toyota Corolla 2015")).toBeVisible();
    await expect(rail.getByText("MacBook Pro M2")).toBeVisible();
  });
});

// The buyer persona is user 1, who is also the seller of listing 1 — so this
// signed-in visit is a seller opening their OWN listing's public page.
test.describe("Listing detail — viewed by its own seller", () => {
  test.use({ storageState: BUYER_STATE });

  test("shows the owner panel with manage / edit / conversations", async ({
    page,
  }) => {
    await page.goto("/en/listings/1");
    const panel = page.getByTestId("owner-listing-bar");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("This is your listing")).toBeVisible();
    // Lifecycle is legible from here: nothing else on an ACTIVE page says it's
    // live, so this is the only place the "Active" badge appears.
    await expect(page.getByText("Active", { exact: true })).toHaveCount(1);
    await expect(panel.getByText("Active")).toBeVisible();
    // Views/saves belong to the page's meta row, not to this panel — the owner
    // must not read the same two numbers twice in one column.
    await expect(panel.getByText(/views?$|saves?$/i)).toHaveCount(0);

    await expect(
      panel.getByRole("link", { name: /Manage Listing/i }),
    ).toHaveAttribute("href", "/en/my-listings/1");
    await expect(panel.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/en/listings/1/edit",
    );
    await expect(
      panel.getByRole("link", { name: /View Conversations/i }),
    ).toHaveAttribute("href", "/en/conversations?listing=1");
  });

  test("buyer-only affordances stay hidden for the owner", async ({ page }) => {
    await page.goto("/en/listings/1");
    await expect(page.getByTestId("owner-listing-bar")).toBeVisible();
    // Meetup tips are buyer guidance — not shown to the seller of the item.
    await expect(
      page.getByRole("button", { name: /Meetup safety tips/i }),
    ).toHaveCount(0);
    await expect(page.getByText(/Message Seller/i)).toHaveCount(0);
    await expect(page.getByText(/Not interested/i)).toHaveCount(0);
    // "Seller is away until…" is buyer information (a guest on this same
    // listing DOES get it): the away seller must not be told about themselves
    // in the third person.
    await expect(page.getByText(/Seller is away until/i)).toHaveCount(0);
  });

  test("the owner panel sits at the top of the column, not below the map", async ({
    page,
  }) => {
    // The owner is the one viewer the sticky <ListingActionBar> never pins a CTA
    // for, so their controls have to be where they land: directly under the
    // price/meta block, ahead of the location card and the seller card.
    await page.setViewportSize({ width: 390, height: 760 });
    await page.goto("/en/listings/1");
    const panel = page.getByTestId("owner-listing-bar");
    await expect(panel).toBeVisible();

    const panelBox = (await panel.boundingBox())!;
    // The two cards it used to sit behind: the location card (+ its Leaflet map)
    // and the seller trust card.
    for (const label of ["Location", "Seller"]) {
      const cardBox = (await page
        .getByText(label, { exact: true })
        .first()
        .boundingBox())!;
      expect(panelBox.y).toBeLessThan(cardBox.y);
    }
    // Reachable with one short scroll on a phone, i.e. not two screens down.
    expect(panelBox.y).toBeLessThan(760 * 2);
  });

  test("no sticky-bar space is reserved for the owner", async ({ page }) => {
    // The bar self-suppresses for the owner, so its spacer must go with it —
    // otherwise their own listing ends in a strip of dead space (the old
    // page-level `pb-28`).
    await page.setViewportSize({ width: 390, height: 760 });
    await page.goto("/en/listings/1");
    await expect(page.getByTestId("owner-listing-bar")).toBeVisible();
    await expect(page.getByTestId("action-bar-spacer")).toHaveCount(0);
  });

  test("the 'More from this Seller' rail is hidden from that seller", async ({
    page,
  }) => {
    // A guest on this same listing DOES get the rail (see the guest spec above),
    // so this is the owner gate, not an empty result: seller 1 has two other
    // active listings. Cross-selling a seller their own stock under buyer copy —
    // with a "view all" to their own profile — is what mobile gates out too.
    await page.goto("/en/listings/1");
    await expect(page.getByTestId("owner-listing-bar")).toBeVisible();
    await expect(page.getByTestId("seller-rail")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "More from this Seller" }),
    ).toHaveCount(0);
  });

  test("the seller rail still shows on another seller's listing", async ({
    page,
  }) => {
    // Listing 2 belongs to seller 2, so the same signed-in user is a buyer here
    // and the rail is exactly what they should see.
    await page.goto("/en/listings/2");
    const rail = page.getByTestId("seller-rail");
    await expect(rail).toBeVisible();
    await expect(rail.getByText("Winter Jacket")).toBeVisible();
  });

  test("owner panel also works on a non-active listing", async ({ page }) => {
    // Listing 9 is user 1's RESERVED listing: the panel still renders (that's
    // where Manage lives) and the expiry pill stays out — only active listings
    // have a live expiry clock.
    await page.goto("/en/listings/9");
    const panel = page.getByTestId("owner-listing-bar");
    await expect(panel).toBeVisible();
    await expect(panel.getByText(/Expires|Expired/i)).toHaveCount(0);
    await expect(
      panel.getByRole("link", { name: /Manage Listing/i }),
    ).toHaveAttribute("href", "/en/my-listings/9");

    // "Reserved" is stated exactly once, by the page's header row. The panel
    // must not repeat it — two identical badges in one column reads as a bug.
    await expect(page.getByText("Reserved", { exact: true })).toHaveCount(1);
    await expect(panel.getByText("Reserved", { exact: true })).toHaveCount(0);
  });

  test("the sold/reserved recovery card is not shown to the owner", async ({
    page,
  }) => {
    // <UnavailableActions> is buyer recovery: "see similar in Computers" and
    // "more from Ahmad Karimi" would send seller 1 shopping from himself.
    await page.goto("/en/listings/9");
    await expect(page.getByTestId("owner-listing-bar")).toBeVisible();
    await expect(page.getByTestId("unavailable-actions")).toHaveCount(0);
    await expect(page.getByText(/See similar in/i)).toHaveCount(0);
    await expect(page.getByText(/More from Ahmad Karimi/i)).toHaveCount(0);
  });

  test("owner panel is localized and keeps the locale prefix (ps)", async ({
    page,
  }) => {
    await page.goto("/ps/listings/1");
    const panel = page.getByTestId("owner-listing-bar");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("دا ستاسو اعلان دی")).toBeVisible();
    await expect(
      panel.getByRole("link", { name: "اعلان اداره کول" }),
    ).toHaveAttribute("href", "/ps/my-listings/1");
  });

  test("a non-owner still sees the buyer actions and no owner panel", async ({
    page,
  }) => {
    // Listing 2 belongs to seller 2, so the same signed-in user is a buyer here.
    await page.goto("/en/listings/2");
    await expect(page.getByTestId("owner-listing-bar")).toHaveCount(0);
    await expect(page.getByText(/Message Seller/i).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Meetup safety tips/i }),
    ).toBeVisible();
  });
});

// A sold/reserved listing used to end the visit in a flat grey notice. These
// pages are indexed and stock turns over fast, so the notice now carries two
// recovery paths (same category + price band, and the seller's other stock).
test.describe("Listing detail — sold/reserved recovery CTAs", () => {
  test("a sold listing keeps the notice and offers both next steps", async ({
    page,
  }) => {
    // Listing 7: sold, AFN 8,000, "Clothes & Fashion" (slug clothes), Ahmad Karimi.
    await page.goto("/en/listings/7");
    const card = page.getByTestId("unavailable-actions");
    await expect(card).toBeVisible();
    await expect(card.getByText("This item has been sold")).toBeVisible();
    // Sold is final — the "may free up" nudge belongs to reserved only.
    await expect(card.getByText(/reservation can fall through/i)).toHaveCount(0);

    // ±30% of 8,000, rounded → 5,600 … 10,400, using the shared browse param
    // names (category/min/max) so the Bazaar sidebar renders them as filters.
    await expect(
      card.getByRole("link", { name: /See similar in Clothes & Fashion/i }),
    ).toHaveAttribute("href", "/en/bazaar?category=clothes&min=5600&max=10400");
    await expect(
      card.getByRole("link", { name: /More from Ahmad Karimi/i }),
    ).toHaveAttribute("href", "/en/sellers/1");

    // The rest of the buyer column survives — saving a sold item is still how
    // you follow the seller, and the safety guidance stays put.
    await expect(page.getByText(/Save listing|Remove from saved/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Meetup safety tips/i }),
    ).toBeVisible();
  });

  test("a reserved listing adds the 'may free up' line", async ({ page }) => {
    // Listing 6: reserved, AFN 5,000, Vehicles, Sara Ahmadi.
    await page.goto("/en/listings/6");
    const card = page.getByTestId("unavailable-actions");
    await expect(card.getByText("This item is reserved")).toBeVisible();
    await expect(card.getByText(/reservation can fall through/i)).toBeVisible();
    await expect(
      card.getByRole("link", { name: /See similar in Vehicles/i }),
    ).toHaveAttribute("href", "/en/bazaar?category=vehicles&min=3500&max=6500");
    await expect(
      card.getByRole("link", { name: /More from Sara Ahmadi/i }),
    ).toHaveAttribute("href", "/en/sellers/2");
  });

  test("'See similar' lands on a pre-filtered Bazaar without the dead listing", async ({
    page,
  }) => {
    // Listing 9: reserved, AFN 70,000, Computers & Laptops → band 49,000–91,000,
    // which the active MacBook Pro M2 (90,000) falls inside.
    await page.goto("/en/listings/9");
    await page
      .getByTestId("unavailable-actions")
      .getByRole("link", { name: /See similar in/i })
      .click();

    await expect(page).toHaveURL(/\/en\/bazaar\?category=laptops&min=49000&max=91000/);
    // Category + min + max are all live filters, so the pill counts three.
    await expect(page.getByText("3 filters active")).toBeVisible();
    await expect(page.getByPlaceholder("Min Price")).toHaveValue("49000");
    await expect(page.getByPlaceholder("Max Price")).toHaveValue("91000");
    // Bazaar only ever queries active stock — the reserved item can't come back.
    await expect(page.getByText("MacBook Pro M2")).toBeVisible();
    await expect(page.getByText("Gaming PC")).toHaveCount(0);
  });

  test("an active listing is untouched (no recovery card)", async ({ page }) => {
    await page.goto("/en/listings/1");
    await expect(page.getByTestId("unavailable-actions")).toHaveCount(0);
    await expect(page.getByText(/Message Seller/i).first()).toBeVisible();
  });

  test("the bottom rail is labelled 'Similar Listings', not 'Recent'", async ({
    page,
  }) => {
    await page.goto("/en/listings/7");
    await expect(
      page.getByRole("heading", { name: "Similar Listings" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Recent listings/i }),
    ).toHaveCount(0);
  });

  test("the card is localized and keeps the locale prefix (ps)", async ({
    page,
  }) => {
    await page.goto("/ps/listings/7");
    const card = page.getByTestId("unavailable-actions");
    await expect(card.getByText("دا توکی خرڅ شوی دی")).toBeVisible();
    await expect(card.getByRole("link").first()).toHaveAttribute(
      "href",
      "/ps/bazaar?category=clothes&min=5600&max=10400",
    );
    await expect(
      card.getByRole("link", { name: /Ahmad Karimi/ }),
    ).toHaveAttribute("href", "/ps/sellers/1");
  });
});
