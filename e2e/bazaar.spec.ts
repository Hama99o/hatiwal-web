import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

// The Bazaar feed is fully URL-driven (filter state ⇄ querystring ⇄ Rails query),
// so filtering is asserted via direct navigation (deterministic SSR), and the
// interactive controls (chip click / typing) are asserted by the URL they drive.
test.describe("Bazaar feed", () => {
  test("lists all active listings", async ({ page }) => {
    await page.goto("/en/bazaar");
    for (const title of [
      "iPhone 13 Pro",
      "Samsung 4K TV",
      "Toyota Corolla 2015",
      "Winter Jacket",
      "MacBook Pro M2",
    ]) {
      await expect(page.getByText(title)).toBeVisible();
    }
    // Reserved/sold listings are excluded from the public feed.
    await expect(page.getByText("Mountain Bike (Reserved)")).toHaveCount(0);
    await expect(page.getByText("Leather Sofa (Sold)")).toHaveCount(0);
  });

  test("category filter shows only that category's listings", async ({
    page,
  }) => {
    await page.goto("/en/bazaar?category=vehicles");
    await expect(page.getByText("Toyota Corolla 2015")).toBeVisible();
    await expect(page.getByText("iPhone 13 Pro")).toHaveCount(0);
    await expect(page.getByText("Samsung 4K TV")).toHaveCount(0);
  });

  test("category chip is wired (click updates the feed query)", async ({
    page,
  }) => {
    await page.goto("/en/bazaar");
    await expect(page.getByText("iPhone 13 Pro")).toBeVisible();
    const chip = page.getByRole("button", { name: /Vehicles/ });
    // Retry click+assert to ride out dev-mode client hydration latency.
    await expect(async () => {
      await chip.first().click();
      await expect(page).toHaveURL(/category=vehicles/);
    }).toPass({ timeout: 20_000 });
  });

  test("search filters by title", async ({ page }) => {
    await page.goto("/en/bazaar?q=MacBook");
    await expect(page.getByText("MacBook Pro M2")).toBeVisible();
    await expect(page.getByText("iPhone 13 Pro")).toHaveCount(0);
  });

  test("search box is wired (typing drives the query)", async ({ page }) => {
    await page.goto("/en/bazaar");
    const input = page.getByPlaceholder("Search listings...");
    await expect(async () => {
    // Empty the field before each re-fill: re-filling the SAME text leaves a
    // controlled input's React state unchanged, so if the first attempt landed
    // before hydration (dev compiles chunks on demand) no later attempt could ever
    // commit and the retry would spin out its whole budget. Same reasoning as
    // `search()` in search-history.spec.ts.
      await input.fill("");
      await input.fill("MacBook");
      await expect(page).toHaveURL(/q=MacBook/);
    }).toPass({ timeout: 20_000 });
  });

  test("navbar search filters live (no Enter) when already on the bazaar", async ({
    page,
  }) => {
    // The navbar is search-as-you-type: typing alone drives /bazaar?q=… (debounced),
    // and while already on the bazaar the browse island adopts the new query.
    await page.goto("/en/bazaar");
    await expect(page.getByText("iPhone 13 Pro")).toBeVisible();
    await expect(page.getByText("MacBook Pro M2")).toBeVisible();
    const navbarSearch = page.locator("header form[role=search] input").first();
    await expect(async () => {
    // Empty the field before each re-fill: re-filling the SAME text leaves a
    // controlled input's React state unchanged, so if the first attempt landed
    // before hydration (dev compiles chunks on demand) no later attempt could ever
    // commit and the retry would spin out its whole budget. Same reasoning as
    // `search()` in search-history.spec.ts.
      await navbarSearch.fill("");
      await navbarSearch.fill("MacBook"); // no .press("Enter")
      await expect(page).toHaveURL(/q=MacBook/);
    }).toPass({ timeout: 20_000 });
    await expect(page.getByText("MacBook Pro M2")).toBeVisible();
    await expect(page.getByText("iPhone 13 Pro")).toHaveCount(0);
  });

  test("navbar search jumps to the bazaar live from another page", async ({
    page,
  }) => {
    // Typing in the navbar from the home page navigates to the bazaar on its own.
    await page.goto("/en");
    const navbarSearch = page.locator("header form[role=search] input").first();
    await expect(async () => {
    // Empty the field before each re-fill: re-filling the SAME text leaves a
    // controlled input's React state unchanged, so if the first attempt landed
    // before hydration (dev compiles chunks on demand) no later attempt could ever
    // commit and the retry would spin out its whole budget. Same reasoning as
    // `search()` in search-history.spec.ts.
      await navbarSearch.fill("");
      await navbarSearch.fill("iPhone");
      await expect(page).toHaveURL(/\/bazaar\?q=iPhone/);
    }).toPass({ timeout: 20_000 });
    await expect(page.getByText("iPhone 13 Pro")).toBeVisible();
  });

  test("search with no matches shows the empty state", async ({ page }) => {
    await page.goto("/en/bazaar?q=zzzqqq-nothing");
    await expect(page.getByText("No listings found")).toBeVisible();
  });

  test("sort by price low-to-high orders cheapest first", async ({ page }) => {
    await page.goto("/en/bazaar?sort=price_asc");
    await expect(page.getByText("Winter Jacket")).toBeVisible();
    // Listing cards render in result order; read them in DOM order.
    const titles = await page.locator('a[href*="/listings/"]').allInnerTexts();
    const idx = (s: string) => titles.findIndex((t) => t.includes(s));
    // Cheapest (Winter Jacket, 1,200) before priciest (Toyota, 600,000).
    expect(idx("Winter Jacket")).toBeGreaterThanOrEqual(0);
    expect(idx("Winter Jacket")).toBeLessThan(idx("Toyota Corolla 2015"));
  });
});

/**
 * The PERSONALISED feed (TASK-WEB-FEED250).
 *
 * `GET /listings` is one endpoint with two payloads: anonymous, and — when a
 * devise bearer is attached — filtered by the caller's hidden listings and
 * carrying their `is_viewed` flag. The web feed used to fetch it only
 * anonymously, so "Not interested" was a no-op and the card's "Seen" pill was
 * unreachable code. The mock API mirrors Rails here: it personalises `/listings`
 * only when the request carries the persona's token, i.e. only when the browser
 * routed it through /api/me.
 *
 * The hearts are NOT part of that payload and these specs must not pretend they
 * are: `is_saved` exists only in the serializer's `:detailed` view, so a feed row
 * never carries it for anyone (TASK-BE-SAVEDLIST would change that, and would
 * change mobile with it). Every feed heart resolves against the separate
 * `['saved-listings']` query instead — which is what the third spec below pins,
 * including the state it must show while that answer is still in flight.
 *
 * Fixture contract (e2e/mock-api/server.mjs): for the buyer persona, listing 2
 * (Samsung 4K TV) is hidden, listing 1 (iPhone 13 Pro) is already viewed, and
 * listings 2 + 4 (Winter Jacket) are in /my/saved_listings.
 */
test.describe("Bazaar feed (signed in — personalised)", () => {
  test.use({ storageState: BUYER_STATE });

  test('a "Not interested" listing drops out once the authed fetch settles', async ({
    page,
  }) => {
    await page.goto("/en/bazaar");
    // The SSR seed is deliberately a GUEST payload (an RSC cannot fetch as the
    // viewer without breaking devise's token rotation), so the hidden listing MAY
    // paint once. What must not survive is the personalised refetch.
    await expect(page.getByText("Samsung 4K TV")).toHaveCount(0, {
      timeout: 30_000,
    });
    // ...and nothing else was lost with it.
    await expect(page.getByText("iPhone 13 Pro")).toBeVisible();
    await expect(page.getByText("Winter Jacket")).toBeVisible();
    await expect(page.getByText("Toyota Corolla 2015")).toBeVisible();
    await expect(page.getByText("MacBook Pro M2")).toBeVisible();
  });

  test('an already-viewed card shows the "Seen" pill in grid AND list view', async ({
    page,
  }) => {
    // The flag can only arrive on an authed payload, so assert the response that
    // carries it as well as the pill it drives. Collected from a listener and
    // polled rather than awaited through `waitForResponse`: that helper starts its
    // own 30s clock the moment it is created, which in dev mode can expire while
    // the navigation it is waiting behind is still compiling the route — the
    // rejection then kills the test with a bogus `page.goto` failure.
    const viewedFlags: boolean[] = [];
    page.on("response", (r) => {
      if (!/\/api\/me\/listings\?/.test(r.url()) || r.status() !== 200) return;
      void r
        .json()
        .then((body: { listings?: { title: string; is_viewed: boolean }[] }) => {
          const iphone = body.listings?.find((l) => l.title === "iPhone 13 Pro");
          if (iphone) viewedFlags.push(iphone.is_viewed);
        })
        .catch(() => {});
    });
    await page.goto("/en/bazaar");
    await expect.poll(() => viewedFlags, { timeout: 30_000 }).toContain(true);

    const card = page.locator('a[href="/en/listings/1"]');
    await expect(card.getByText("Seen", { exact: true })).toBeVisible({
      timeout: 30_000,
    });

    // Same treatment in the dense list layout (the card renders the pill in both
    // photo overlays). The view toggle is the shared SegmentedControl — an ARIA
    // tablist — and its state is client-only, so a click proves hydration too.
    const listTab = page
      .locator("main [role=tablist]")
      .first()
      .getByRole("tab")
      .last();
    await expect(async () => {
      await listTab.click();
      await expect(listTab).toHaveAttribute("aria-selected", "true");
    }).toPass({ timeout: 30_000 });
    await expect(card.getByText("Seen", { exact: true })).toBeVisible();
  });

  test("a saved listing's heart says 'unknown', never 'not saved', until ['saved-listings'] lands", async ({
    page,
  }) => {
    // The personalised feed tells this heart NOTHING: `is_saved` is absent from
    // the :list payload (see the header above), so `initialSaved` is undefined on
    // every Bazaar card and the state comes from the shared ['saved-listings']
    // query, exactly as it did before this card. What must never appear in the
    // meantime is the OUTLINE heart: a buyer who taps that either re-POSTs `save`
    // for something already saved (server-side a no-op via find_or_create_by!, so
    // visibly nothing happens) or spends their first tap flipping the wrong way.
    //
    // So hold the saved list open and make that window deterministic rather than
    // racing the assertion against it.
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/\/api\/me\/my\/saved_listings/, async (route) => {
      await held;
      await route.continue();
    });

    await page.goto("/en/bazaar");
    // Winter Jacket (listing 4) is saved by this persona and is not their own
    // listing, so it carries a heart. While the answer is in flight it is
    // `aria-busy` and — the load-bearing half — publishes no pressed state at all.
    const card = page.locator('a[href="/en/listings/4"]');
    const unsettled = card.getByRole("button", { name: "Save listing" });
    await expect(unsettled).toHaveAttribute("aria-busy", "true", {
      timeout: 30_000,
    });
    expect(
      await unsettled.evaluate((el) => el.hasAttribute("aria-pressed")),
    ).toBe(false);

    release();
    // Then it settles filled — from the list — and stops claiming to be busy.
    const saved = card.getByRole("button", { name: "Remove from saved" });
    await expect(saved).toHaveAttribute("aria-pressed", "true", {
      timeout: 30_000,
    });
    expect(await saved.evaluate((el) => el.hasAttribute("aria-busy"))).toBe(
      false,
    );
  });

  test("a 401 on the authed feed falls back to the anonymous one", async ({
    page,
  }) => {
    // A session that expired mid-browse must cost the buyer personalisation, not
    // their feed. Fulfilled in the browser, so the proxy (and its cookie
    // clearing) is never reached — this is purely the fetch layer's fallback.
    await page.route(/\/api\/me\/listings\?/, (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "unauthenticated" }),
      }),
    );
    await page.goto("/en/bazaar");
    // The full anonymous feed — including the listing they had hidden, which the
    // fallback cannot know about.
    await expect(page.getByText("Samsung 4K TV")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("iPhone 13 Pro")).toBeVisible();
    await expect(page.getByText("MacBook Pro M2")).toBeVisible();
    // Neither the error panel nor the empty state (they share this description).
    await expect(
      page.getByText("Try changing your search or filter."),
    ).toHaveCount(0);
  });

  test("a 502 from the proxy falls back too — a blip is not an error panel", async ({
    page,
  }) => {
    // The other half of the fallback, added after review: `/api/me` answers 502
    // `upstream_failed` whenever its own Rails fetch throws, so a transient blip
    // used to give a SIGNED-IN buyer an error panel on a feed that a guest on the
    // same blip still saw in full. Personalisation is what a blip may cost.
    await page.route(/\/api\/me\/listings\?/, (route) =>
      route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "upstream_failed" }),
      }),
    );
    await page.goto("/en/bazaar");
    await expect(page.getByText("iPhone 13 Pro")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("MacBook Pro M2")).toBeVisible();
    await expect(
      page.getByText("Try changing your search or filter."),
    ).toHaveCount(0);
  });

  test("infinite scroll stays on the authed path", async ({ page }) => {
    // Page 2+ must carry the token too, or the tail of the feed would quietly
    // re-admit hidden listings. The fixture has one page, so assert the transport
    // the load-more path uses rather than a second page of cards: every listings
    // request this island makes while signed in goes through /api/me, never
    // /api/proxy.
    const proxied: string[] = [];
    page.on("request", (r) => {
      if (/\/api\/proxy\/listings\?/.test(r.url())) proxied.push(r.url());
    });
    await page.goto("/en/bazaar?sort=price_asc");
    await expect(page.getByText("Winter Jacket")).toBeVisible();
    await expect(page.getByText("Samsung 4K TV")).toHaveCount(0, {
      timeout: 30_000,
    });
    expect(proxied).toEqual([]);
  });
});

test.describe("Bazaar feed (guest — unchanged)", () => {
  // No storageState. A logged-out visitor's feed must be exactly what it always
  // was: one anonymous request, no authed call, no personalisation.
  test("never calls the authed feed and sees the whole catalogue", async ({
    page,
  }) => {
    const authedCalls: string[] = [];
    page.on("request", (r) => {
      if (/\/api\/me\/listings/.test(r.url())) authedCalls.push(r.url());
    });
    await page.goto("/en/bazaar");
    // The session probe is what resolves this visitor to a guest; once it has
    // answered, the authed branch is provably not taken.
    await page.waitForResponse((r) => r.url().includes("/api/auth/session"));
    // Nothing is hidden from a guest — not even the listing the buyer persona hid.
    await expect(page.getByText("Samsung 4K TV")).toBeVisible();
    await expect(page.getByText("iPhone 13 Pro")).toBeVisible();
    // ...and an anonymous payload can never claim they have seen anything.
    await expect(page.getByText("Seen", { exact: true })).toHaveCount(0);
    expect(authedCalls).toEqual([]);
  });
});

/**
 * Handing one tab from user A to user B — the normal case on a shared phone or
 * computer in this market, and the reason the feed query is keyed by viewer id
 * (`["listings", viewerId ?? "guest", filters]`) on top of the cache clear in
 * auth-provider.tsx. A personalised payload is now cached per identity, so
 * without that key B's Bazaar would be served A's rows: A's hidden listing still
 * missing and A's "Seen" pills. A's HEARTS leak by a different route — they are
 * not in the feed payload at all, they come from the one global
 * ['saved-listings'] key — which is why this test needs both guards, below.
 *
 * Same discipline (and the same limits) as the saved-listings counterpart in
 * e2e/auth.spec.ts:
 *  • It DOES catch a persistent leak — one cache entry shared by both viewers,
 *    or a key B never triggers a fetch for, leaves A's feed on screen and fails.
 *  • It does NOT catch a transient flash: Playwright's assertions auto-retry, so
 *    a frame of A's data before B's fetch lands would be waited out.
 *  • Every step after the first load is CLIENT-SIDE. A page.goto would tear down
 *    the JS context and the in-memory cache with it, hiding the bug entirely.
 *
 * WHICH GUARD EACH ASSERTION PINS (measured by removing them one at a time, so
 * the next reader doesn't have to guess):
 *  • The rows and the "Seen" pill are held by the VIEWER-SCOPED KEY alone —
 *    with `queryClient.clear()` disabled they still come back correct for B.
 *  • The heart is held by the CACHE CLEAR: `SAVED_LISTINGS_KEY` is a single
 *    global key (see shared/save-button.tsx), so with the clear disabled B is
 *    shown A's filled heart even though the feed itself is clean. Note both
 *    hearts below therefore resolve from ['saved-listings'], not from the feed
 *    payload (which carries no `is_saved`) — the assertions are the settled
 *    state, reached whenever that query lands for the viewer in question.
 * Both guards are required, and the test fails if either half regresses.
 */
test.describe("Bazaar feed (one tab, two users)", () => {
  test("B never inherits A's hidden / seen / saved state", async ({ page }) => {
    async function signIn(email: string) {
      await page.getByLabel(/Email/i).fill(email);
      await page.getByLabel(/Password/i).fill("Password123!");
      await page.getByRole("button", { name: /Sign In/i }).click();
      await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
    }
    const openAccountMenu = (name: string) =>
      page.locator(`button[aria-label="${name}"]`).click();
    const gotoBazaar = () =>
      page.locator("header").getByRole("link", { name: "Bazaar" }).click();

    // The ONLY hard load in this test.
    await page.goto("/en/login");
    // Mark onboarding seen BEFORE signing in — the welcome modal opens the moment
    // a user becomes authed and would then cover the account menu for the rest of
    // the test. localStorage survives client-side navigation, so one write covers
    // both users.
    await page.evaluate(() =>
      window.localStorage.setItem("hatiwal.onboarded", "1"),
    );

    // ── User A: fill the feed cache with a PERSONALISED payload ──────────────
    await signIn("buyer@hatiwal.test");
    await gotoBazaar();
    await expect(page.getByText("Samsung 4K TV")).toHaveCount(0, {
      timeout: 30_000,
    });
    await expect(
      page.locator('a[href="/en/listings/1"]').getByText("Seen", { exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page
        .locator('a[href="/en/listings/4"]')
        .getByRole("button", { name: "Remove from saved" }),
    ).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });

    // ── Hand the browser over, without ever reloading ────────────────────────
    await openAccountMenu("Ahmad Karimi");
    await page.getByRole("menuitem", { name: /Sign Out/i }).click();
    await page.getByRole("link", { name: /^Login$/i }).first().click();
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });

    // ── User B: hid nothing, viewed nothing, saved nothing ───────────────────
    await signIn("empty@hatiwal.test");
    await gotoBazaar();
    // A's hidden listing is not hidden from B.
    await expect(page.getByText("Samsung 4K TV")).toBeVisible({
      timeout: 30_000,
    });
    // Not one of A's "Seen" pills anywhere in the grid...
    await expect(page.getByText("Seen", { exact: true })).toHaveCount(0);
    // ...and A's saved listing is an OUTLINE heart for B: settled (it carries a
    // pressed state at all) and false, not A's filled one.
    await expect(
      page
        .locator('a[href="/en/listings/4"]')
        .getByRole("button", { name: "Save listing" }),
    ).toHaveAttribute("aria-pressed", "false", { timeout: 30_000 });
  });
});
