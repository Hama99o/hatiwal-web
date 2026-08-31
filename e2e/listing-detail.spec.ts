import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import en from "../messages/en.json";
import ps from "../messages/ps.json";
import fa from "../messages/fa.json";

/**
 * The buyer CTA's label, READ FROM THE CATALOG rather than retyped (the pattern
 * `listing-action-bar.spec.ts` set): the key is `listing.detail.contactSeller`,
 * this suite asserts it six times — present for a buyer, absent for the owner,
 * present with JS off — and a copy change must fail here loudly instead of
 * leaving every one of them asserting a string the UI no longer shows.
 * A bare string locator is a case-insensitive substring match, i.e. exactly what
 * the `/Contact Seller/i` regexes it replaces did.
 */
const CTA_LABEL = en.listing.detail.contactSeller;

/** Every locale catalog, for the cross-locale copy invariants below. */
const CATALOGS = { en, ps, fa } as const;

/** WCAG 2.1 relative luminance of an `rgb()`/`rgba()` computed style value. */
function luminance(color: string): number {
  const [r, g, b] = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two computed-style colors (both opaque). */
function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

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

  test("renders the :detailed fields the fixture used to omit entirely", async ({
    page,
  }) => {
    // Three pieces of shipped UI that were unreachable in E2E until
    // TASK-WEB-MOCKSHAPE brought the mock's `detailView` onto `view :detailed`
    // field for field. Each one is rendered from a key the merged fixture simply
    // did not send, so each rendered its "nothing to say" branch on every page.
    //
    // The seller trust score (`avg_rating`/`review_count` on the :detailed seller
    // block — see docs/MOBILE_WEB_PARITY.md's 2026-07-20 sweep, which added them
    // to the serializer for exactly this card).
    await page.goto("/en/listings/1");
    await expect(page.getByText("4.7")).toBeVisible();
    await expect(page.getByText("3 reviews")).toBeVisible();
    // …and `negotiable` + `saves_count`, on the one firm-price, saved-by-others row.
    await page.goto("/en/listings/4");
    await expect(page.getByText("Firm price")).toBeVisible();
    await expect(page.getByText("Saved by 3 people")).toBeVisible();
  });

  test("gated actions are present (Contact Seller / Report)", async ({ page }) => {
    await page.goto("/en/listings/1");
    await expect(page.getByText(CTA_LABEL)).toBeVisible();
    await expect(page.getByText(/Report/i).first()).toBeVisible();
  });

  test("Report lines up with the description column", async ({ page }) => {
    // The trigger carries its own `px-2` for the 40px hit box, which optically
    // indented it 8px past every other element in the `max-w-3xl` column (and
    // mirrored in ps/fa). `-ms-2` at the call site pulls the box back out, so the
    // flag starts exactly where the "Description" heading and the body copy do.
    await page.goto("/en/listings/1");
    const heading = page.getByRole("heading", { name: "Description" });
    const flag = page
      .getByRole("button", { name: "Report", exact: true })
      .locator("svg");
    await expect(heading).toBeVisible();
    await expect(flag).toBeVisible();
    const headingBox = (await heading.boundingBox())!;
    const flagBox = (await flag.boundingBox())!;
    expect(Math.abs(flagBox.x - headingBox.x)).toBeLessThanOrEqual(1);
  });

  test("Share clears the same 40px target as the other actions", async ({
    page,
  }) => {
    // The component defaults to `sm` (36px); on this page it is one of the
    // header actions, so it is passed `default` — under 40px it was the only
    // control on the page below the touch-target floor.
    await page.goto("/en/listings/1");
    const share = page.getByRole("button", { name: /Share|Copy link/i });
    await expect(share).toBeVisible();
    const box = (await share.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(40);
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

  test("a visitor's buyer actions are in the server HTML", async ({
    browser,
  }, testInfo) => {
    // The counterpart of the owner's no-JS spec below: the SSR ownership hint
    // must never make a signed-out visitor wait for JS to see the actions. No
    // viewer cookie → the page renders exactly the buyer version it always did.
    const ctx = await browser.newContext({
      javaScriptEnabled: false,
      baseURL: testInfo.project.use.baseURL,
    });
    const noJs = await ctx.newPage();
    await noJs.goto("/en/listings/1");
    await expect(noJs.getByText(CTA_LABEL)).toBeVisible();
    await expect(noJs.getByText(/Meetup safety tips/i)).toBeVisible();
    await expect(noJs.getByTestId("owner-listing-bar")).toHaveCount(0);
    await ctx.close();
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
// "Similar Listings" (the dedicated GET /listings/:id/similar endpoint — the one
// definition of "similar" this client shares with mobile). Fixture map used below:
//   listing 2 = Samsung 4K TV, ACTIVE, seller 2 (Sara Ahmadi), cat Electronics
//               → seller 2's other active stock = Winter Jacket; the similar
//                 endpoint rolls Electronics' subcategories up (iPhone, MacBook).
//   listing 4 = Winter Jacket, ACTIVE, seller 2, cat Clothes — the only
//               browsable listing in Clothes → no similar rail at all.
//   listing 7 = Leather Sofa, SOLD, seller 1 (Ahmad Karimi), cat Clothes
//               → both rails render.
//   listing 9 = Gaming PC, RESERVED, seller 1, cat Computers & Laptops → both
//               rails resolve to the same single card (MacBook), so it is the
//               dedupe case.
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
    // The similar endpoint expands to the category's children (Rails'
    // Listing.similar_to → by_category → self_and_children), so a listing filed
    // directly under Electronics still cross-sells the phone and the laptop
    // below it.
    const similar = page.getByTestId("similar-rail");
    await expect(similar.getByText("iPhone 13 Pro")).toBeVisible();
    await expect(similar.getByText("MacBook Pro M2")).toBeVisible();
    // ...and it is not a dead end either: "view all" lands on the category hub.
    await expect(
      similar.getByRole("link", { name: /View all/i }),
    ).toHaveAttribute("href", "/en/categories/electronics");
  });

  test("a card is never offered twice under two headings", async ({ page }) => {
    // Seller 1's only other active laptop IS the similar-category match, so the
    // seller rail (which runs first) keeps it and the similar rail — left with
    // nothing else — does not render at all.
    await page.goto("/en/listings/9");
    const seller = page.getByTestId("seller-rail");
    await expect(seller.getByText("MacBook Pro M2")).toBeVisible();
    await expect(page.getByText("MacBook Pro M2")).toHaveCount(1);
    await expect(page.getByTestId("similar-rail")).toHaveCount(0);
  });

  test("a rule separates the two rails, and never dangles alone", async ({
    page,
  }) => {
    // Both rails on listing 7 → the boundary is drawn.
    await page.goto("/en/listings/7");
    await expect(page.getByTestId("rail-divider")).toBeVisible();
    // Only one rail on listing 4 (Clothes has no other stock) → no rule.
    await page.goto("/en/listings/4");
    await expect(page.getByTestId("seller-rail")).toBeVisible();
    await expect(page.getByTestId("rail-divider")).toHaveCount(0);
  });

  test("each rail is a named region with a self-describing view-all", async ({
    page,
  }) => {
    // "View all" repeated verbatim on two adjacent rails is meaningless in a
    // screen reader's link list, so the section title is appended invisibly
    // after the visible words.
    await page.goto("/en/listings/2");
    await expect(
      page.getByRole("region", { name: "More from this Seller" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Similar Listings" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View all More from this Seller" }),
    ).toHaveAttribute("href", "/en/sellers/2");
    await expect(
      page.getByRole("link", { name: "View all Similar Listings" }),
    ).toHaveAttribute("href", "/en/categories/electronics");
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
    // this seller AND one to the category, so both rails below drop their
    // duplicate "view all" — one destination, one CTA.
    await page.goto("/en/listings/7");
    await expect(
      page
        .getByTestId("unavailable-actions")
        .getByRole("link", { name: /More from Ahmad Karimi/i }),
    ).toHaveAttribute("href", "/en/sellers/1");
    const rail = page.getByTestId("seller-rail");
    await expect(rail).toBeVisible();
    await expect(rail.getByRole("link", { name: /View all/i })).toHaveCount(0);
    await expect(
      page.getByTestId("similar-rail").getByRole("link", { name: /View all/i }),
    ).toHaveCount(0);
  });

  /**
   * REPLACES "same on a reserved listing", which asserted a held listing behaves
   * like a sold one here.
   *
   * It no longer does, and the inversion is the assertion worth having. The rails
   * drop their "view all" only because <UnavailableActions> already owns those
   * links — so on a listing that renders NO such card, the rails must keep them.
   * A reserved listing is live and renders no card, so it owns its own links
   * exactly like an unheld one. (Reading the raw status in <CrossSellRails> would
   * have silently stripped both links off every held listing — which is why that
   * prop is named for LIVE now, not "active".)
   */
  test("a reserved listing keeps its rails' own view-all links", async ({
    page,
  }) => {
    await page.goto("/en/listings/6");
    await expect(page.getByTestId("unavailable-actions")).toHaveCount(0);
    await expect(
      page.getByTestId("seller-rail").getByRole("link", { name: /View all/i }),
    ).toHaveAttribute("href", "/en/sellers/2");
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
    // Name is a prefix match, not exact: the accessible name is the visible
    // "ټول وګورئ" plus the section title, appended sr-only.
    await expect(
      page.getByTestId("seller-rail").getByRole("link", { name: /^ټول وګورئ/ }),
    ).toHaveAttribute("href", "/ps/sellers/2");
    await expect(
      page.getByTestId("similar-rail").getByRole("link", { name: /^ټول وګورئ/ }),
    ).toHaveAttribute("href", "/ps/categories/electronics");
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

  test("shows the owner panel with manage / edit / chats", async ({ page }) => {
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
    // "Chats", the same word as the nav and the manage screen — not a second
    // name ("Conversations") for the same destination.
    await expect(
      panel.getByRole("link", { name: /View Chats/i }),
    ).toHaveAttribute("href", "/en/conversations?listing=1");
  });

  test("the chats link carries how many buyers are waiting", async ({
    page,
  }) => {
    // conversations_count rides free on the detail payload (2 in the fixture);
    // an unnumbered link is one a seller has no reason to click. The digit is
    // aria-hidden and spelled out (pluralized) for screen readers.
    await page.goto("/en/listings/1");
    const link = page
      .getByTestId("owner-listing-bar")
      .getByRole("link", { name: /View Chats/i });
    await expect(link).toBeVisible();
    await expect(link.getByText("2", { exact: true })).toBeVisible();
    await expect(link).toHaveAccessibleName(/2 chats/i);
  });

  test("a listing with no chats shows the link without a 0 badge", async ({
    page,
  }) => {
    // Listing 5 is seller 1's listing that nobody has messaged about — the
    // majority case for an owner view. Rails always emits conversations_count,
    // so gating the pill on `!= null` printed "View Chats 0": noise at best,
    // discouraging at worst. The link itself must still be there.
    await page.goto("/en/listings/5");
    const panel = page.getByTestId("owner-listing-bar");
    const link = panel.getByRole("link", { name: /View Chats/i });
    await expect(link).toBeVisible();
    await expect(link.getByText("0")).toHaveCount(0);
    await expect(link).toHaveAccessibleName("View Chats");
  });

  // The panel must be able to fix what it reports. Every status resolves its
  // most likely next transition through the SHARED brain (actionsFor +
  // useListingLifecycle), so the panel, /my-listings and the manage screen offer
  // the same move under the same label — and the same move MOBILE offers
  // (useListingLifecycle.ts's `primaryAction`).
  test("the panel offers the listing's next lifecycle action", async ({
    page,
  }) => {
    // BOTH live statuses lead with Mark as Sold. This used to assert the
    // opposite for an `active` listing — "hold it for the buyer you are
    // meeting", on the grounds that sold is terminal and the loudest control
    // must not be the one with no path back. Both halves of that are retired
    // deliberately: selling never requires reserving first, and a mistaken sale
    // is now reversible (the toast's Undo, then the Sales ledger), so the sale
    // IS the safe primary.
    await page.goto("/en/listings/1");
    const panel = page.getByTestId("owner-listing-bar");
    await expect(
      panel.getByRole("button", { name: "Mark as Sold" }),
    ).toBeVisible();
    // Reserving is not offered from a listing at all — a hold belongs to a
    // person, and is placed from the chat thread with that person.
    await expect(
      panel.getByRole("button", { name: /Mark as Reserved|Place a hold/ }),
    ).toHaveCount(0);

    await page.goto("/en/listings/9"); // reserved → the SAME primary
    await expect(
      page
        .getByTestId("owner-listing-bar")
        .getByRole("button", { name: "Mark as Sold" }),
    ).toBeVisible();

    await page.goto("/en/listings/7"); // sold → terminal, nothing to transition
    const soldPanel = page.getByTestId("owner-listing-bar");
    await expect(soldPanel).toBeVisible();
    await expect(soldPanel.getByRole("button")).toHaveCount(0);
    // …so managing it becomes the panel's own primary action.
    await expect(
      soldPanel.getByRole("link", { name: /Manage Listing/i }),
    ).toBeVisible();
  });

  test("an unpublished draft can be published from its own public URL", async ({
    page,
  }) => {
    // The one status the panel had no spec for, on the assumption that a draft's
    // public URL 404s for its own seller. It does not: `GET /listings/:id` runs
    // through `ListingPolicy::Scope#resolve`, which is `scope.all` (only blocked
    // pairs and admin-removed listings are filtered) — so a seller who opens the
    // link to their unpublished item lands right here, and this panel is the only
    // thing on the page that can publish it.
    await page.goto("/en/listings/8");
    const panel = page.getByTestId("owner-listing-bar");
    await expect(panel).toBeVisible();
    // Stated once, by the page's header row — the panel never repeats a badge.
    await expect(page.getByText("Draft", { exact: true })).toHaveCount(1);
    // A draft has no clock running: expiry is an ACTIVE-only concern.
    await expect(panel.getByText(/Expires|Expired/i)).toHaveCount(0);

    await panel.getByRole("button", { name: "Publish" }).click();
    // The shared confirm copy + mutation + success toast, same as /my-listings.
    await expect(page.getByText("Publish this listing?")).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Publish" })
      .click();
    await expect(page.getByText("Listing published!")).toBeVisible();
  });

  test("marking your own listing sold from the panel picks a buyer, then invites a review", async ({
    page,
  }) => {
    // Identical flow to /my-listings and the manage screen: the shared buyer
    // picker records the Transaction, and a real buyer is immediately rateable.
    // Listing 9 is the RESERVED one — the status whose primary is Mark as Sold
    // (an active listing's primary is Reserve; see the spec above).
    //
    // The picker lists this listing's own threads, and the fixture's two
    // conversations hang off listings 1 and 3 — so the buyer is injected here
    // rather than in the fixture, where a third conversation would shift the
    // inbox specs. It is the one authed call the picker makes.
    await page.route("**/api/me/conversations?listing_id=9", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          conversations: [
            {
              id: 91,
              status: "open",
              last_message_at: "2026-06-21T15:00:00Z",
              created_at: "2026-06-20T10:00:00Z",
              listing: {
                id: 9,
                title: "Gaming PC",
                thumbnail_url: null,
                status: "reserved",
                price: 70000,
                currency: "AFN",
                location: "Kabul",
              },
              other_participant: {
                id: 2,
                name: "Sara Ahmadi",
                city: "Herat",
                verified: false,
                avatar_url: null,
              },
              buyer: { id: 2, name: "Sara Ahmadi", city: "Herat", avatar_url: null },
              seller: { id: 1, name: "Ahmad Karimi", city: "Kabul", avatar_url: null },
              unread_count: 0,
              last_message_body: "I'll take it.",
              last_message_kind: "text",
              blocked_with_participant: false,
            },
          ],
        }),
      }),
    );
    await page.goto("/en/listings/9");
    await page
      .getByTestId("owner-listing-bar")
      .getByRole("button", { name: "Mark as Sold" })
      .click();
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
  });

  test("the owner panel is server-rendered, so no buyer UI flashes first", async ({
    browser,
  }, testInfo) => {
    // Ownership used to be resolved only in the browser, after
    // /api/auth/session came back — and the server HTML (fetched anonymously)
    // had already painted by then, so the seller of the item watched "Message
    // Seller", the save heart and the buyer meetup tips flash past before their
    // own panel replaced them. With JavaScript disabled we see exactly what the
    // server sent: if this passes, there is nothing left to flash.
    const ctx = await browser.newContext({
      storageState: BUYER_STATE,
      javaScriptEnabled: false,
      baseURL: testInfo.project.use.baseURL,
    });
    const noJs = await ctx.newPage();
    await noJs.goto("/en/listings/1");
    await expect(noJs.getByTestId("owner-listing-bar")).toBeVisible();
    await expect(noJs.getByText(CTA_LABEL)).toHaveCount(0);
    await expect(noJs.getByText(/Meetup safety tips/i)).toHaveCount(0);
    await expect(noJs.getByText(/Not interested/i)).toHaveCount(0);
    await expect(noJs.getByText(/Seller is away until/i)).toHaveCount(0);
    await ctx.close();
  });

  test("an expired listing is not also labelled Active", async ({ page }) => {
    // Listing 10 is user 1's ACTIVE-but-lapsed listing: Rails keeps
    // `status: active` until a renew, so the panel used to print "Active" right
    // next to the red "Expired" pill — two contradictory badges, with the one
    // thing the owner has to act on presented as fine.
    await page.goto("/en/listings/10");
    const panel = page.getByTestId("owner-listing-bar");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Expired")).toBeVisible();
    await expect(page.getByText("Active", { exact: true })).toHaveCount(0);
    await expect(
      panel.getByRole("link", { name: /Manage Listing/i }),
    ).toHaveAttribute("href", "/en/my-listings/10");
  });

  test("an expired listing can be renewed from the panel", async ({ page }) => {
    // The status the panel could name but not fix: it showed the red "Expired"
    // pill and then offered navigation only, so the owner still had to travel to
    // /my-listings/10 to do the one thing that mattered.
    await page.goto("/en/listings/10");
    const panel = page.getByTestId("owner-listing-bar");
    await panel.getByRole("button", { name: "Renew" }).click();
    // The shared confirm copy, the shared mutation, the shared success toast.
    await expect(page.getByText("Renew this listing?")).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Renew" })
      .click();
    await expect(page.getByText(/renewed/i).first()).toBeVisible();
  });

  test("an expiring listing can be renewed too, not just an expired one", async ({
    page,
  }) => {
    // Listing 11 is user 1's active listing 3 days from the end of its run: the
    // amber "Expires in 3 days" pill. The panel renders only the PRIMARY
    // transition, and for a not-yet-lapsed listing Renew sits in `secondary` —
    // so the pill used to state urgency whose fix was a navigation away, the same
    // "names a status it can't fix" gap that justified wiring Renew for the
    // already-expired case. Renew now joins the row while the clock is running
    // out, WITHOUT displacing the status's own next step (Mark as Sold).
    await page.goto("/en/listings/11");
    const panel = page.getByTestId("owner-listing-bar");
    await expect(panel).toBeVisible();
    await expect(panel.getByText(/Expires in/i)).toBeVisible();
    await expect(
      panel.getByRole("button", { name: "Mark as Sold" }),
    ).toBeVisible();

    await panel.getByRole("button", { name: "Renew" }).click();
    await expect(page.getByText("Renew this listing?")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Renew" }).click();
    await expect(page.getByText(/renewed/i).first()).toBeVisible();
  });

  test("a listing with weeks left offers no Renew (it isn't a fix for anything)", async ({
    page,
  }) => {
    // The counterpart of the spec above: listing 1 has no expiry pill, so a
    // Renew button there would be a control with nothing to answer.
    await page.goto("/en/listings/1");
    const panel = page.getByTestId("owner-listing-bar");
    await expect(panel).toBeVisible();
    await expect(panel.getByText(/Expires|Expired/i)).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "Renew" })).toHaveCount(0);
  });

  test("the waiting-chats count clears AA in light AND dark", async ({
    page,
  }) => {
    // This is the one number the panel exists to make a seller act on, and it is
    // 12px — so the 4.5:1 AA floor applies. It used to be a solid `--primary`:
    // 4.9:1 in light but 3.6:1 in dark, i.e. failing for half the app's users at
    // night. The `count` badge now fills with `--primary-strong`; asserting the
    // ratio (rather than the class) is what stops the next palette tweak from
    // silently re-breaking it.
    //
    // A count pill has TWO contrast jobs and they pull opposite ways, so both are
    // asserted here. The first fix darkened `--primary-strong` in dark to win the
    // digits (~6.6:1) and left the FILL at 3.0:1 against `--background` / 2.6:1
    // against `--card` — under the 3:1 non-text floor, and darker than the dark
    // theme's own `--primary`, so "3 buyers are waiting on you" receded into the
    // page at night while passing an AA-only spec. Legible but no longer loud is
    // a regression of the pill's entire purpose, so the salience gets a floor too.
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto("/en/listings/1");
      const pill = page
        .getByTestId("owner-listing-bar")
        .getByTestId("count-badge");
      await expect(pill).toBeVisible();
      const { bg, fg, surface } = await pill.evaluate((el) => {
        const s = getComputedStyle(el);
        // The surface the pill actually sits ON: the nearest ancestor with an
        // OPAQUE background. Anything translucent (this panel's own
        // `bg-primary/10`) is skipped rather than composited, so the number the
        // assertion reports is a real painted colour. Here that resolves to the
        // Chats button's `bg-secondary` — the strictest of the surfaces this
        // pill appears on (the page background is a full stop lighter/darker).
        let node: HTMLElement | null = el.parentElement;
        let found = "";
        while (node) {
          const c = getComputedStyle(node).backgroundColor;
          if (c && !/rgba\([^)]*,\s*(0|0?\.\d+)\)/.test(c)) {
            found = c;
            break;
          }
          node = node.parentElement;
        }
        return { bg: s.backgroundColor, fg: s.color, surface: found };
      });
      // Opaque by construction: an alpha fill would make the real ratio depend
      // on whatever the pill happens to be sitting on (it moves — header,
      // thumbnail, tinted panel), which is exactly what made the old
      // `bg-primary/…` suggestion unverifiable.
      expect(bg, `${colorScheme}: the count pill must be opaque`).not.toMatch(
        /rgba\([^)]*,\s*0?\.\d+\)/,
      );
      const ratio = contrastRatio(bg, fg);
      expect(
        ratio,
        `${colorScheme}: count pill ${fg} on ${bg} is ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(4.5);
      // Salience: the fill against the surface it is painted on. 3:1 is the WCAG
      // non-text floor (1.4.11), the right one for "can you see the pill at all".
      expect(surface, `${colorScheme}: no opaque surface under the pill`).not.toBe(
        "",
      );
      const fillRatio = contrastRatio(bg, surface);
      expect(
        fillRatio,
        `${colorScheme}: count fill ${bg} on ${surface} is ${fillRatio.toFixed(2)}:1 — the pill has stopped standing out`,
      ).toBeGreaterThanOrEqual(3);
    }
    await page.emulateMedia({ colorScheme: "light" });
  });

  test("buyer-only affordances stay hidden for the owner", async ({ page }) => {
    await page.goto("/en/listings/1");
    await expect(page.getByTestId("owner-listing-bar")).toBeVisible();
    // Meetup tips are buyer guidance — not shown to the seller of the item.
    await expect(
      page.getByRole("button", { name: /Meetup safety tips/i }),
    ).toHaveCount(0);
    await expect(page.getByText(CTA_LABEL)).toHaveCount(0);
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

  // The panel's longest label, and the only one followed by a pill. `truncate`
  // used to eat the verb ("View Cha…", "مشاهده گفت…") — a defect every
  // visibility/href spec above happily passes. The buttons are now
  // `h-auto min-h-10 whitespace-normal`, so a label too wide for its box wraps
  // and grows the button instead of disappearing.
  //
  // fa is the BINDING locale, not en: "مشاهده گفتگوها" needs ~184px of button
  // against 72px for en and ps. The three widths are chosen around the 2-up
  // split, because `min-w-40 flex-1` only clipped INSIDE that window:
  //   375 — the row is still stacked 1-up (full-width buttons); nothing clips
  //         even with `truncate`, which is why the old en/ps-at-375 spec was
  //         green while the bug was live.
  //   412 · 430 — the panel's inner width has passed 328px, so the row splits
  //         2-up at ~150px a cell. Measured on the pre-fix build: fa scrollWidth
  //         96 vs clientWidth 84 (412px) and 96 vs 93 (430px) — CLIPPED, and
  //         clean again only from ~480px.
  // Mutation-checked: putting `truncate` back fails fa at 412 and 430.
  for (const width of [375, 412, 430]) {
    test(`the chats label is not clipped at ${width}px, in en / ps / fa`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const locale of ["en", "ps", "fa"]) {
        await page.goto(`/${locale}/listings/1`);
        const label = page
          .getByTestId("owner-listing-bar")
          .getByTestId("owner-chats-label");
        await expect(label).toBeVisible();
        // Both axes, on the label AND on the button that boxes it: a wrapped
        // line cut off by a fixed height is the same defect one dimension over
        // (which is why the button is `h-auto min-h-10`, not `h-10`).
        for (const [what, target] of [
          ["label", label],
          ["button", label.locator("xpath=ancestor::a[1]")],
        ] as const) {
          const box = await target.evaluate((el) => ({
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
          }));
          expect(
            box.scrollWidth,
            `${locale} @${width}px: the chats ${what} is clipped horizontally`,
          ).toBeLessThanOrEqual(box.clientWidth + 1);
          expect(
            box.scrollHeight,
            `${locale} @${width}px: the chats ${what} is clipped vertically`,
          ).toBeLessThanOrEqual(box.clientHeight + 1);
        }
        // The wrap must not cost the row its tap target either.
        const buttonBox = (await label
          .locator("xpath=ancestor::a[1]")
          .boundingBox())!;
        expect(
          buttonBox.height,
          `${locale} @${width}px: the chats button is under the 40px floor`,
        ).toBeGreaterThanOrEqual(40);
      }
    });
  }

  test("no sticky-bar space is reserved for the owner", async ({ page }) => {
    // The bar self-suppresses for the owner, so its spacer must go with it —
    // otherwise their own listing ends in a strip of dead space (the old
    // page-level `pb-28`).
    await page.setViewportSize({ width: 390, height: 760 });
    await page.goto("/en/listings/1");
    await expect(page.getByTestId("owner-listing-bar")).toBeVisible();
    await expect(page.getByTestId("action-bar-spacer")).toHaveCount(0);
  });

  test("no empty buyer-action block collecting the column's gaps", async ({
    page,
  }) => {
    // The same dead-space defect one block over. Every control inside
    // `#listing-actions` self-hides for the owner, but the block still rendered
    // its wrapper AND an inner `space-y-2` div — two zero-height boxes, so the
    // column's `space-y-5` paid 20px on each side of nothing: ~40px of blank
    // page between the seller card and the description.
    await page.setViewportSize({ width: 390, height: 760 });
    await page.goto("/en/listings/1");
    await expect(page.getByTestId("owner-listing-bar")).toBeVisible();
    // The block is now gated as a whole, so nothing of it survives. (Buyers keep
    // it — see "a non-owner still sees the buyer actions", which finds the CTA
    // inside it on listing 2.)
    await expect(page.locator("#listing-actions")).toHaveCount(0);

    // …and the general form of the rule, so re-adding an always-rendered wrapper
    // (under any id) fails here too: a child of the detail column either has
    // height or is `display:none`. Only a `display:none` box forfeits the
    // sibling margin, which is exactly why the safety-tips row uses
    // `empty:hidden` rather than rendering empty.
    const strays = await page
      .getByTestId("owner-listing-bar")
      .evaluate((el) =>
        // The panel is a direct child of the column (Card `asChild` keeps it a
        // <section>), so this is that column.
        [...el.parentElement!.children]
          .filter(
            (c) =>
              getComputedStyle(c).display !== "none" &&
              c.getBoundingClientRect().height === 0,
          )
          .map((c) => `<${c.tagName.toLowerCase()} class="${c.className}">`),
      );
    expect(
      strays,
      "zero-height boxes still collect the column's 20px gaps",
    ).toEqual([]);
  });

  test("Edit is demoted out of the action stack, not spending a band", async ({
    page,
  }) => {
    // On a phone every member of the action stack is a full-width 40px band, and
    // an expiring active listing has the most members (next transition + Renew +
    // Manage + Chats). Edit used to make it five — ~240px of chrome between the
    // price block and the location card — for a second route into the manage area
    // that the Manage screen already offers an Edit of its own. Chats is the one
    // that keeps its band: it carries the number that pulls a seller back in.
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto("/en/listings/11"); // active, 3 days left → the widest stack
    const panel = page.getByTestId("owner-listing-bar");
    await expect(panel).toBeVisible();
    const panelWidth = (await panel.boundingBox())!.width;

    const edit = panel.getByRole("link", { name: "Edit" });
    const editBox = (await edit.boundingBox())!;
    // Demoted, not removed, and still a house-standard tap target.
    await expect(edit).toHaveAttribute("href", "/en/listings/11/edit");
    expect(
      editBox.height,
      "the demoted Edit is under the 40px tap floor",
    ).toBeGreaterThanOrEqual(40);
    expect(
      editBox.width,
      "Edit must not spend a full-width band",
    ).toBeLessThan(panelWidth * 0.6);

    // The bands that remain are the four that earn one.
    for (const [name, loc] of [
      ["Renew", panel.getByRole("button", { name: "Renew" })],
      ["Manage", panel.getByRole("link", { name: /Manage Listing/i })],
      ["Chats", panel.getByRole("link", { name: /View Chats/i })],
    ] as const) {
      const box = (await loc.boundingBox())!;
      expect(box.width, `${name} should be a full-width band`).toBeGreaterThan(
        panelWidth * 0.8,
      );
    }
    const bands = await panel.evaluate(
      (el, w) =>
        [...el.querySelectorAll("a, button")].filter(
          (n) => n.getBoundingClientRect().width > w * 0.8,
        ).length,
      panelWidth,
    );
    expect(bands, "the stack has grown past four bands again").toBeLessThanOrEqual(
      4,
    );
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

  // The loudest control in this panel is a lifecycle ACTION, and in both RTL
  // locales it used to be labelled with a STATE. fa `listing.markReserved` was
  // "رزرو شده" — byte-identical to `listing.status.reserved` — and `markSold`
  // was "فروخته شده" = `status.sold`; both are passive participles, so the owner
  // of an ACTIVE listing got a filled primary button reading "Reserved" beside
  // an "Active" pill, with no verb anywhere in the panel. ps had the same defect
  // against a different word: "خوندي ښودل" borrows the save/favourite root, so a
  // Pashto seller's primary read "mark as saved". Asserting the SHAPE of the copy
  // — an action is never its own status — is what stops the next translation pass
  // from reintroducing it in a locale nobody reviewing this repo reads.
  test("no locale labels a lifecycle action with its own status word", () => {
    for (const [locale, m] of Object.entries(CATALOGS)) {
      // The reserve ACTION is now hold language, reached from the chat thread —
      // `placeHold` / `releaseHold` in place of the old "Mark as Reserved". The
      // rule is unchanged and now covers both halves of it: neither may collapse
      // into the reserved STATUS word.
      expect(
        m.listing.placeHold,
        `${locale}: the place-hold ACTION must not be the reserved STATUS`,
      ).not.toBe(m.listing.status.reserved);
      expect(
        m.listing.releaseHold,
        `${locale}: the release-hold ACTION must not be the reserved STATUS`,
      ).not.toBe(m.listing.status.reserved);
      expect(
        m.listing.markSold,
        `${locale}: the sold ACTION must not be the sold STATUS`,
      ).not.toBe(m.listing.status.sold);
    }
    // ps also has to keep away from the save/favourite vocabulary, which is a
    // different concept entirely (`sidebar.saved` is the buyer's wishlist). The
    // first assertion anchors the root to the save word, so rewording that key
    // can't quietly turn the other two into no-ops.
    const SAVE_ROOT = "خوندي";
    expect(ps.common.save).toContain(SAVE_ROOT);
    expect(ps.listing.placeHold).not.toContain(SAVE_ROOT);
    expect(ps.listing.releaseHold).not.toContain(SAVE_ROOT);
    expect(ps.listing.markSold).not.toContain(SAVE_ROOT);
    expect(ps.listing.status.reserved).not.toContain(SAVE_ROOT);
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
    // The chats link uses the nav's Pashto word (چټونه), not a second one.
    await expect(
      panel.getByRole("link", { name: /چټونه وګورئ/ }),
    ).toHaveAttribute("href", "/ps/conversations?listing=1");
    // The lifecycle action is translated too — the panel is not English-only.
    // "خرڅ ښودل" = Mark as Sold, a live listing's one next step. This used to
    // assert the ps reserve label ("ریزرو کول"), which was itself a correction of
    // "خوندي ښودل" (literally "mark safe") — the save/favourite root. That
    // vocabulary rule is still enforced, on the labels that exist now, by "no
    // locale labels a lifecycle action with its own status word" below.
    await expect(
      panel.getByRole("button", { name: ps.listing.markSold }),
    ).toBeVisible();
    // RTL: the panel's own content flows right-to-left with the document.
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("owner panel is localized in fa too, action-labelled not state-labelled", async ({
    page,
  }) => {
    // fa is the locale the copy defect above actually shipped in, and the one
    // whose labels are widest (see the clipping loop), so it gets its own render
    // rather than riding on ps. Read from the catalog, not retyped: this asserts
    // that the PANEL shows what the catalog says, while the invariant above
    // asserts the catalog says something usable as a button.
    await page.goto("/fa/listings/1");
    const panel = page.getByTestId("owner-listing-bar");
    await expect(panel).toBeVisible();
    await expect(
      panel.getByText(fa.listing.detail.ownListingNotice),
    ).toBeVisible();
    await expect(
      panel.getByRole("link", { name: fa.listing.ownerDetail.actions }),
    ).toHaveAttribute("href", "/fa/my-listings/1");
    await expect(
      panel.getByRole("link", { name: fa.common.edit }),
    ).toHaveAttribute("href", "/fa/listings/1/edit");
    // The primary on a LIVE listing is now Mark sold — one tap, no reserving
    // first. It still has to read as a MOVE ("ثبت فروش" = record a sale) rather
    // than as the "فروخته شده" state, which the "Active" pill one line up would
    // contradict. Same rule as before, applied to the button that is actually
    // the primary now.
    await expect(
      panel.getByRole("button", { name: fa.listing.markSold }),
    ).toBeVisible();
    await expect(
      panel.getByText(fa.listing.status.sold, { exact: true }),
    ).toHaveCount(0);
    // And reserving is no longer offered from the listing at all — a hold is
    // placed from the chat thread, for the person it is for.
    await expect(
      panel.getByRole("button", { name: fa.listing.placeHold }),
    ).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("a non-owner still sees the buyer actions and no owner panel", async ({
    page,
  }) => {
    // Listing 2 belongs to seller 2, so the same signed-in user is a buyer here.
    await page.goto("/en/listings/2");
    await expect(page.getByTestId("owner-listing-bar")).toHaveCount(0);
    await expect(page.getByText(CTA_LABEL).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Meetup safety tips/i }),
    ).toBeVisible();
  });
});

// A sold/reserved listing used to end the visit in a flat grey notice. These
// pages are indexed and stock turns over fast, so the notice now carries two
// recovery paths: the same category (plus a price band when that band provably
// holds stock) and the seller's other stock. The hard rule these specs enforce
// is that a recovery CTA NEVER lands on an empty page — a second, emptier dead
// end is worse than the notice on its own.
test.describe("Listing detail — sold/reserved recovery CTAs", () => {
  const D = en.listing.detail;

  test("a sold listing keeps the notice and offers both next steps", async ({
    page,
  }) => {
    // Listing 7: sold, AFN 8,000, "Clothes & Fashion" (slug clothes), Ahmad Karimi.
    // The category's only live stock is the Winter Jacket at AFN 1,200, which is
    // OUTSIDE a +/-30% band of 8,000 (5,600-10,400) — so the band is dropped and
    // the CTA falls back to the category, which that jacket proves is non-empty.
    await page.goto("/en/listings/7");
    const card = page.getByTestId("unavailable-actions");
    await expect(card).toBeVisible();
    await expect(card.getByText(D.soldNotice)).toBeVisible();
    // Sold is final. The "it may still come back" line belongs to a HELD
    // listing, which is live and never reaches this card at all — so it must not
    // appear here either.
    await expect(
      page.getByText(D.reservedStillAvailableNote),
    ).toHaveCount(0);

    await expect(
      card.getByRole("link", { name: /See similar in Clothes & Fashion/i }),
    ).toHaveAttribute("href", "/en/bazaar?category=clothes");
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

  /**
   * REPLACES "a reserved listing adds the 'may free up' line".
   *
   * That test asserted a reserved listing renders the dead-end recovery card
   * with a "this may free up" nudge. The premise is deliberately retired: a hold
   * no longer takes a listing off the market, so routing a held item to "see
   * similar instead" is showing a buyer a dead end for something they can still
   * ask about. The assertion is not dropped — it is inverted, which is a
   * stronger claim about the same fixture: the card must NOT be there, and the
   * contact path must be.
   */
  test("a reserved listing is NOT a dead end — it keeps the contact path", async ({
    page,
  }) => {
    // Listing 6: reserved, AFN 5,000, Vehicles, Sara Ahmadi (not the viewer).
    await page.goto("/en/listings/6");

    // No recovery card, and neither of its CTAs anywhere on the page.
    await expect(page.getByTestId("unavailable-actions")).toHaveCount(0);
    await expect(page.getByText(/See similar in/i)).toHaveCount(0);

    // The buyer can still reach the seller — the whole point.
    //
    // A LINK, not a button: this describe block carries no storageState, so it
    // runs as a GUEST, and <StartConversationButton> gives a guest a real
    // sign-in link (in the server HTML) rather than a button that needs React.
    // That is the case worth pinning here anyway — search traffic landing on an
    // indexed listing page is mostly guests, and it was exactly those visitors
    // who used to hit the dead end.
    await expect(
      page.getByRole("link", { name: en.listing.detail.contactSeller }),
    ).toBeVisible();

    // The RIBBON stays: the listing says "Reserved" while remaining live.
    await expect(page.getByText(en.listing.status.reserved).first()).toBeVisible();

    // And it explains why a "Reserved" item still has a Message button.
    await expect(
      page.getByText(en.listing.detail.reservedStillAvailableNote),
    ).toBeVisible();

    // OFFERS, unlike messaging, stay paused while a hold is in place — the two
    // signals are deliberately split (a second buyer must not bid against a
    // hold that is already agreed in principle).
    await expect(
      page.getByRole("button", { name: en.listing.detail.makeOffer }),
    ).toHaveCount(0);
  });

  test("the price band rides along when it holds stock", async ({ page }) => {
    // Listing 15: SOLD, AFN 70,000, Computers & Laptops -> band 49,000-91,000,
    // which the active MacBook Pro M2 (90,000) falls inside, so the band stays.
    //
    // Was listing 9 (reserved) until the sell-flow rework. A reserved listing is
    // live now and renders no recovery card at all, so the band fixture has to be
    // a real dead end — see the mock's own note beside listing 15.
    await page.goto("/en/listings/15");
    await page
      .getByTestId("unavailable-actions")
      .getByRole("link", { name: /See similar in/i })
      .click();

    await expect(page).toHaveURL(
      /\/en\/bazaar\?category=laptops&min=49000&max=91000/,
    );
    // Category + min + max are all live filters, so the pill counts three.
    await expect(page.getByText("3 filters active")).toBeVisible();
    await expect(page.getByPlaceholder("Min Price")).toHaveValue("49000");
    await expect(page.getByPlaceholder("Max Price")).toHaveValue("91000");
    // Bazaar only ever queries live stock — the sold item can't come back.
    await expect(page.getByText("MacBook Pro M2")).toBeVisible();
    await expect(page.getByText("Gaming Rig")).toHaveCount(0);
  });

  test("'See similar' never lands on an empty Bazaar", async ({ page }) => {
    // The band around listing 7 contains nothing, so following its CTA must
    // still arrive on real stock rather than "No listings found".
    await page.goto("/en/listings/7");
    await page
      .getByTestId("unavailable-actions")
      .getByRole("link", { name: /See similar in/i })
      .click();

    await expect(page).toHaveURL(/\/en\/bazaar\?category=clothes$/);
    await expect(page.getByText("1 filter active")).toBeVisible();
    await expect(page.getByText(en.browse.noResults)).toHaveCount(0);
    await expect(page.getByText("Winter Jacket")).toBeVisible();
    // No band means no price inputs to pre-fill.
    await expect(page.getByPlaceholder("Min Price")).toHaveValue("");
    await expect(page.getByPlaceholder("Max Price")).toHaveValue("");
  });

  test("a listing priced in USD gets no price band", async ({ page }) => {
    // Listing 12: sold, USD 900, Computers & Laptops. Rails' price filter is
    // currency-blind, so a band of 630-1,170 would query the AFN feed with
    // dollar numbers — the CTA keeps the category and drops the band.
    await page.goto("/en/listings/12");
    const card = page.getByTestId("unavailable-actions");
    await expect(
      card.getByRole("link", { name: /See similar in Computers & Laptops/i }),
    ).toHaveAttribute("href", "/en/bazaar?category=laptops");
  });

  test("no 'See similar' CTA when the category has nothing live", async ({
    page,
  }) => {
    // Listing 13: sold, AFN 2,500, Furniture — a category with zero active
    // stock. Sending the buyer there would just be a second dead end, so only
    // the seller CTA renders, and it takes the primary weight as the sole action.
    await page.goto("/en/listings/13");
    const card = page.getByTestId("unavailable-actions");
    await expect(card.getByText(D.soldNotice)).toBeVisible();
    await expect(card.getByText(/See similar in/i)).toHaveCount(0);
    const links = card.getByRole("link");
    await expect(links).toHaveCount(1);
    await expect(links).toHaveAttribute("href", "/en/sellers/2");
  });

  test("a sold listing is dimmed, a live one is not", async ({ page }) => {
    await page.goto("/en/listings/7");
    await expect(page.getByTestId("listing-gallery")).toHaveCSS(
      "opacity",
      "0.7",
    );
    // Reserved can still fall through, so it keeps its full-strength photo.
    await page.goto("/en/listings/6");
    await expect(page.getByTestId("listing-gallery")).toHaveCSS("opacity", "1");
  });

  test("an active listing is untouched (no recovery card)", async ({ page }) => {
    await page.goto("/en/listings/1");
    await expect(page.getByTestId("unavailable-actions")).toHaveCount(0);
    await expect(page.getByText(CTA_LABEL).first()).toBeVisible();
    await expect(page.getByTestId("listing-gallery")).toHaveCSS("opacity", "1");
  });

  test("the bottom rail is labelled 'Similar Listings', not 'Recent'", async ({
    page,
  }) => {
    await page.goto("/en/listings/7");
    await expect(
      page.getByRole("heading", { name: D.similarListings }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: en.home.recent }),
    ).toHaveCount(0);
  });

  test("the card is localized and keeps the locale prefix (ps)", async ({
    page,
  }) => {
    await page.goto("/ps/listings/7");
    const card = page.getByTestId("unavailable-actions");
    await expect(card.getByText(ps.listing.detail.soldNotice)).toBeVisible();
    await expect(card.getByRole("link").first()).toHaveAttribute(
      "href",
      "/ps/bazaar?category=clothes",
    );
    await expect(
      card.getByRole("link", { name: /Ahmad Karimi/ }),
    ).toHaveAttribute("href", "/ps/sellers/1");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("the card fits a 375px phone in en and ps", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    for (const path of ["/en/listings/7", "/ps/listings/7"]) {
      await page.goto(path);
      await expect(page.getByTestId("unavailable-actions")).toBeVisible();
      // The card's buttons must wrap/ellipsize inside the column, never widen
      // the document — a page that scrolls sideways on a phone is the state this
      // whole column is laid out to avoid.
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow, `${path} must not scroll horizontally`).toBeLessThanOrEqual(1);
    }
  });

  /**
   * REPLACES "the reserved line is localized in fa too", which asserted the fa
   * copy inside the dead-end card. Same intent — the reserved wording is
   * localized, not English — against the surface that now carries it.
   */
  test("a held listing's live-reserved copy is localized in fa", async ({
    page,
  }) => {
    await page.goto("/fa/listings/6");
    await expect(page.getByTestId("unavailable-actions")).toHaveCount(0);
    await expect(
      page.getByText(fa.listing.detail.reservedStillAvailableNote),
    ).toBeVisible();
    await expect(
      page.getByText(fa.listing.status.reserved).first(),
    ).toBeVisible();
    // The English must not leak into an RTL locale.
    await expect(
      page.getByText(en.listing.detail.reservedStillAvailableNote),
    ).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });
});

/**
 * Multi-quantity (docs/SPIKE_LISTING_QUANTITY.md) — its own block, because none
 * of this is about the sold/reserved recovery CTAs above.
 */
test.describe("Listing detail — multi-quantity", () => {
  // ── Multi-quantity (docs/SPIKE_LISTING_QUANTITY.md) ───────────────────────
  //
  // Listing 14 (Phone Cases Wholesale) is the batch fixture: 15 total, 4 sold. What matters
  // is that a buyer learns there are several BEFORE they message — that moment
  // is the one the spike identifies as where the harm happens today — and that
  // the price says which number it is.

  test("a multi-unit listing shows the per-unit price and what is left", async ({
    page,
  }) => {
    await page.goto("/en/listings/14");

    // "each" beside the price, so 14,000 cannot be read as the price of all 15.
    const priceBlock = page.locator("#listing-price");
    await expect(priceBlock).toContainText(en.listing.stock.each);
    // 11 LEFT, never the seller's original 15 — a stale count is the feature's
    // top risk (spike §0).
    await expect(priceBlock).toContainText("11");
    await expect(priceBlock).not.toContainText("15");
  });

  test("a single-item listing shows no quantity UI at all", async ({ page }) => {
    // The governing rule, asserted rather than assumed: the majority case must
    // look exactly as it did before this feature existed.
    await page.goto("/en/listings/1");
    const priceBlock = page.locator("#listing-price");
    await expect(priceBlock).toBeVisible();
    await expect(priceBlock).not.toContainText(en.listing.stock.each);
    await expect(priceBlock).not.toContainText("in stock");
  });

  test("the stock line is localized in ps and fa", async ({ page }) => {
    for (const [locale, catalog] of [
      ["ps", ps],
      ["fa", fa],
    ] as const) {
      await page.goto(`/${locale}/listings/14`);
      const priceBlock = page.locator("#listing-price");
      await expect(priceBlock).toContainText(catalog.listing.stock.each);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    }
  });
});
