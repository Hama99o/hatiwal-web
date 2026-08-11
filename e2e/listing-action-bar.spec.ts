import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

/**
 * Sticky buyer action bar on the listing detail page (TASK-WEB-B2BAR).
 * Phone/tablet only: it pins "Message Seller" + Save to the bottom of the
 * viewport, and adds the price once the hero price has scrolled away.
 *
 * Listing 2 (Samsung 4K TV) is owned by seller 2, so the buyer persona (user 1)
 * sees the bar; listing 1 is the persona's OWN listing and listing 6 is
 * reserved — neither may show it.
 */
const PHONE = { width: 390, height: 760 };

/**
 * Park the viewport just below the inline actions block: the bar's two hide
 * sentinels (that block, the footer) are both off screen there and so is the
 * hero price, which is the only place the bar carries a price of its own.
 * Computed from the live box rather than a magic offset — the page's height
 * changes with locale and fixtures.
 */
async function scrollBelowInlineActions(page: Page) {
  await page.evaluate(() => {
    const el = document.getElementById("listing-actions");
    if (!el) throw new Error("#listing-actions missing");
    window.scrollTo(0, window.scrollY + el.getBoundingClientRect().bottom + 8);
  });
}

/**
 * Freeze a route until the returned function is called — how the save/unsave
 * specs below make the (normally ~1s) "we don't know yet" window observable.
 */
async function hold(page: Page, pattern: string) {
  let open: () => void = () => {};
  const gate = new Promise<void>((resolve) => (open = resolve));
  await page.route(pattern, async (route) => {
    await gate;
    await route.continue();
  });
  return async () => {
    open();
    await page.unroute(pattern);
  };
}

/** Every save/unsave the browser actually sends, in order, as "METHOD action". */
function watchSaveCalls(page: Page): string[] {
  const calls: string[] = [];
  page.on("request", (req) => {
    const m = new URL(req.url()).pathname.match(
      /^\/api\/me\/listings\/\d+\/(save|unsave)$/,
    );
    if (m) calls.push(`${req.method()} ${m[1]}`);
  });
  return calls;
}

test.describe("Listing action bar (mobile)", () => {
  test.use({ storageState: BUYER_STATE, viewport: PHONE });

  test("pins the CTA, hides over the inline block, and returns", async ({
    page,
  }) => {
    await page.goto("/en/listings/2");
    const bar = page.getByRole("region", { name: "Listing actions" });
    await expect(bar).toHaveClass(/opacity-100/);
    await expect(bar.getByRole("button", { name: "Message Seller" })).toBeVisible();
    await expect(bar.getByRole("button", { name: /save/i })).toBeVisible();

    // Sits on the bottom edge of the viewport, never off it.
    const box = await bar.boundingBox();
    expect(box!.y + box!.height).toBeGreaterThan(PHONE.height - 10);
    expect(box!.y + box!.height).toBeLessThanOrEqual(PHONE.height + 1);

    // The inline CTA on screen → the bar gets out of the way; back up → returns.
    await page.locator("#listing-actions").scrollIntoViewIfNeeded();
    await expect(bar).toHaveClass(/opacity-0/);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(bar).toHaveClass(/opacity-100/);
  });

  test("carries the price only once the hero price is gone — never two prices", async ({
    page,
  }) => {
    // The bar used to render the price from the first paint, so at the top of a
    // phone page "AFN 30,000" appeared twice ~120px apart (hero at y≈605, bar at
    // y≈727). The price anchor (#listing-price) now governs the bar's own price.
    // It deliberately does NOT hide the whole bar: measured at 390x760 the gap
    // between the price block (ends y=651) and the inline actions (starts y=1201)
    // is 550px inside a 760px viewport, so there is no scroll position where both
    // are off screen — gating the bar on the price would delete the feature.
    await page.goto("/en/listings/2");
    const bar = page.getByRole("region", { name: "Listing actions" });
    const barPrice = bar.getByText(/AFN/);
    await expect(bar).toHaveClass(/opacity-100/);
    // Top of the page: bar pinned, hero price on screen, no price in the bar.
    await expect(page.locator("#listing-price")).toBeInViewport();
    await expect(barPrice).toHaveCount(0);

    // Below the inline block the hero price is long gone → the bar becomes the
    // price anchor, and it must read exactly like the hero one did.
    await scrollBelowInlineActions(page);
    await expect(bar).toHaveClass(/opacity-100/);
    await expect(barPrice).toBeVisible();
    const hero = (
      await page.locator("#listing-price > span").first().textContent()
    )!.trim();
    expect((await barPrice.textContent())!.trim()).toBe(hero);

    // ...and it is never on screen at the same time as the hero price, at any
    // scroll depth.
    for (const y of [0, 200, 400, 600, 900, 1400, 1800]) {
      await page.evaluate((to) => window.scrollTo(0, to), y);
      const both = await page.evaluate(() => {
        const inView = (el: Element | null) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          return r.bottom > 0 && r.top < window.innerHeight;
        };
        const barEl = document.querySelector('[aria-label="Listing actions"]');
        // The bar's price is the row's first child; the CTA's own label span
        // lives inside a <button>, so this can only be the <PriceTag>.
        const barSpan = barEl?.querySelector(":scope > div > span");
        return {
          hero: inView(document.getElementById("listing-price")),
          bar: !!barSpan,
        };
      });
      expect(both, `two prices at scrollY=${y}`).not.toEqual({
        hero: true,
        bar: true,
      });
    }
  });

  test("steps aside over the footer so its links stay reachable", async ({
    page,
  }) => {
    await page.goto("/en/listings/2");
    const bar = page.getByRole("region", { name: "Listing actions" });
    await expect(bar).toHaveClass(/opacity-100/);

    // Bottom of the document: a fixed bar would cover the footer's last rows —
    // privacy / delete-account — with nothing left to scroll.
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await expect(bar).toHaveClass(/opacity-0/);
    const footerLink = page
      .locator("[data-site-footer]")
      .getByRole("link", { name: /delete/i });
    await expect(footerLink).toBeVisible();
    // Nothing on top of it: the point at its centre belongs to the link itself.
    const box = (await footerLink.boundingBox())!;
    const onTop = await page.evaluate(
      ([x, y]) =>
        document
          .elementFromPoint(x as number, y as number)
          ?.closest("a")
          ?.getAttribute("href") ?? null,
      [box.x + box.width / 2, box.y + box.height / 2],
    );
    expect(onTop).toContain("/delete-account");
  });

  test("its Message Seller opens the same dialog, correctly positioned", async ({
    page,
  }) => {
    await page.goto("/en/listings/2");
    const bar = page.getByRole("region", { name: "Listing actions" });
    await expect(bar).toHaveClass(/opacity-100/);

    await expect(async () => {
      await bar.getByRole("button", { name: "Message Seller" }).click();
      await expect(page.getByPlaceholder("Ask about this item...")).toBeVisible({
        timeout: 2000,
      });
    }).toPass({ timeout: 15_000 });

    // Regression guard: a `transform`/`backdrop-filter` on the fixed bar would
    // make it the containing block for the dialog and drag it out of the middle
    // of the viewport (the blur therefore lives on a separate layer).
    const dialogBox = await page.getByRole("dialog").boundingBox();
    expect(dialogBox!.y).toBeLessThan(PHONE.height / 2);
    expect(dialogBox!.width).toBeGreaterThan(250);
  });

  test("its heart and the inline heart are one state", async ({ page }) => {
    // The bar mounts a SECOND <SaveButton> for the same listing beside the inline
    // one, and it is only CSS-hidden, so both live for the whole page. With
    // per-instance optimistic state they diverged permanently: unsave in one
    // place and the other heart stayed filled, then its next tap sent DELETE for
    // an already-unsaved listing. The optimistic flip therefore lives in one
    // shared cache entry both hearts read.
    await page.goto("/en/listings/2"); // saved by this persona in the mock API
    const bar = page.getByRole("region", { name: "Listing actions" });
    await expect(bar).toHaveClass(/opacity-100/);
    const barHeart = bar.getByRole("button", { name: /save/i });
    const inlineHeart = page
      .locator("#listing-actions")
      .getByRole("button", { name: /save/i });
    await expect(barHeart).toHaveAttribute("aria-pressed", "true");
    await expect(inlineHeart).toHaveAttribute("aria-pressed", "true");

    // Unsave from the BAR → the inline heart must empty too.
    await barHeart.click();
    await expect(barHeart).toHaveAttribute("aria-pressed", "false");
    await expect(inlineHeart).toHaveAttribute("aria-pressed", "false");

    // Re-save from the INLINE heart (scrolling it into view hides the bar) → the
    // bar's heart must be filled again when it comes back.
    await inlineHeart.click();
    await expect(inlineHeart).toHaveAttribute("aria-pressed", "true");
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(bar).toHaveClass(/opacity-100/);
    await expect(barHeart).toHaveAttribute("aria-pressed", "true");
  });

  test("keeps its dialog alive when the bar would otherwise slide away", async ({
    page,
  }) => {
    // The shared <Dialog> is portalled to <body>, so hiding the bar can no longer
    // fade/inert the dialog it opened. The bar still holds still while one is
    // open (sliding out from under the scrim only to slide back is noise), and
    // the buyer's half-typed message has to survive whatever reflow unpins it:
    // rotating the phone, an iOS scroll-behind the body scroll-lock doesn't hold,
    // or any reflow that brings the inline block into view. Reproduced here by
    // growing the viewport until the inline block (the bar's hide sentinel) is on
    // screen.
    await page.goto("/en/listings/2");
    const bar = page.getByRole("region", { name: "Listing actions" });
    await expect(bar).toHaveClass(/opacity-100/);
    const composer = page.getByPlaceholder("Ask about this item...");
    await expect(async () => {
      await bar.getByRole("button", { name: "Message Seller" }).click();
      await expect(composer).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15_000 });
    await composer.fill("Is it still available?");

    await page.setViewportSize({ width: 390, height: 2400 });
    await expect(page.locator("#listing-actions")).toBeInViewport();

    // Playwright counts an `opacity-0` element as visible, so assert the two
    // things the hide actually does — the fade class and `inert` — plus that the
    // composer is still usable and has kept what was typed.
    await expect(bar).toHaveClass(/opacity-100/);
    expect(
      await page.getByRole("dialog").evaluate((el) => !!el.closest("[inert]")),
    ).toBe(false);
    await composer.fill("Is it still available? Can we meet in Kabul?");
    await expect(composer).toHaveValue(
      "Is it still available? Can we meet in Kabul?",
    );

    // Closing it hands control back to the observer: the sentinel is on screen
    // now, so the bar must get out of the way rather than stay pinned forever.
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(bar).toHaveClass(/opacity-0/);
    // ...and because the bar is now `inert`, the dialog's focus restore would
    // have dropped the caret at <body> (next Tab restarts at the top of the
    // document). Focus must land on the inline CTA the bar defers to.
    await expect
      .poll(() =>
        page.evaluate(() => document.activeElement?.textContent?.trim() ?? ""),
      )
      .toContain("Message Seller");
  });

  test("survives crossing `lg` mid-compose — the typed message is not lost", async ({
    page,
  }) => {
    // Rotating a tablet into landscape (or dragging a desktop window across
    // 1024px) flips the bar's media query, and the bar's whole subtree — the
    // StartConversationButton and its dialogs — used to unmount with it, taking
    // the half-typed message. The inline block's button is a different instance
    // with empty state, so there was nothing to recover from. The bar now stays
    // mounted while it hosts an open dialog, and the dialog is portalled to
    // <body> so `lg:hidden` on the bar cannot hide it.
    await page.goto("/en/listings/2");
    const bar = page.getByRole("region", { name: "Listing actions" });
    await expect(bar).toHaveClass(/opacity-100/);
    const composer = page.getByPlaceholder("Ask about this item...");
    await expect(async () => {
      await bar.getByRole("button", { name: "Message Seller" }).click();
      await expect(composer).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15_000 });
    await composer.fill("Is it still available?");

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(composer).toBeVisible();
    await expect(composer).toHaveValue("Is it still available?");
    // Portalled: the dialog is not inside the bar, so the bar's `lg:hidden`
    // (`display: none`) cannot take it off screen.
    expect(
      await page
        .getByRole("dialog")
        .evaluate(
          (el) => !!el.closest('[aria-label="Listing actions"]'),
        ),
    ).toBe(false);
    await composer.fill("Is it still available? Can we meet in Kabul?");

    // Closing it lets the bar go for good at this width — no leftover duplicate
    // controls beside the desktop column CTA.
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.locator('[aria-label="Listing actions"]')).toHaveCount(0);
    await expect(page.getByTestId("action-bar-spacer")).toHaveCount(0);
  });

  test("absent on your own listing and on a reserved one", async ({ page }) => {
    await page.goto("/en/listings/1"); // owned by the signed-in persona
    await expect(page.getByRole("heading", { name: "iPhone 13 Pro" })).toBeVisible();
    await expect(page.locator('[aria-label="Listing actions"]')).toHaveCount(0);

    await page.goto("/en/listings/6"); // reserved → inline notice instead
    await expect(
      page.getByRole("heading", { name: "Mountain Bike (Reserved)" }),
    ).toBeVisible();
    await expect(page.locator('[aria-label="Listing actions"]')).toHaveCount(0);
  });

  test("reserves its own space — and only when it renders", async ({ page }) => {
    // The bar is `fixed`; the spacer is what keeps it off the page's last rows.
    // It ships with the bar (it used to be page-level `pb-28`) so that the three
    // cases which get no bar get no dead space either: own listing, non-active
    // listing, desktop.
    await page.goto("/en/listings/2");
    const spacer = page.getByTestId("action-bar-spacer");
    await expect(spacer).toHaveCount(1);
    const spacerBox = (await spacer.boundingBox())!;
    const barBox = (await page
      .getByRole("region", { name: "Listing actions" })
      .boundingBox())!;
    // EXACTLY as tall as the bar: the spacer takes its height from a
    // ResizeObserver on the bar, not from a hand-written calc(). The old
    // `calc(4rem + safe-area)` was 64px against a 65px bar (12 + 40 + 12 + the
    // 1px border) and would have drifted again the next time the row grew.
    expect(Math.abs(spacerBox.height - barBox.height)).toBeLessThanOrEqual(0.5);

    await page.goto("/en/listings/1"); // own listing → no bar, no spacer
    await expect(page.getByRole("heading", { name: "iPhone 13 Pro" })).toBeVisible();
    await expect(page.getByTestId("action-bar-spacer")).toHaveCount(0);

    await page.goto("/en/listings/6"); // reserved → no bar, no spacer
    await expect(
      page.getByRole("heading", { name: "Mountain Bike (Reserved)" }),
    ).toBeVisible();
    await expect(page.getByTestId("action-bar-spacer")).toHaveCount(0);
  });

  test("shows one primary CTA, never a clipped label", async ({ page }) => {
    // The bar carries price + Message + Save and nothing else. A second 40px
    // control here (the inline block's icon-only "Make an Offer") left 98px of
    // button for a 125px label on a 360px phone — the primary CTA, the whole
    // reason the bar exists, was cut mid-word. The price is `shrink-0` (a
    // truncated price would misinform a buyer), so the label is what gives:
    // assert nothing in the row overflows at the widths real phones use.
    for (const width of [360, 390, 430]) {
      await page.setViewportSize({ width, height: 760 });
      await page.goto("/en/listings/2");
      const bar = page.getByRole("region", { name: "Listing actions" });
      const cta = bar.getByRole("button", { name: "Message Seller" });
      await expect(cta).toBeVisible();
      await expect(bar.getByRole("button", { name: "Make an Offer" })).toHaveCount(0);
      const overflow = await cta.evaluate((el) => {
        const label = el.querySelector("span");
        return {
          button: el.scrollWidth > el.clientWidth,
          label: label ? label.scrollWidth > label.clientWidth : false,
        };
      });
      expect(overflow, `clipped at ${width}px`).toEqual({
        button: false,
        label: false,
      });
    }
  });

  test("stays a toolbar on a tablet — the CTA is capped, not a slab", async ({
    page,
  }) => {
    // Between 640px and 1023px `flex-1` alone stretched the primary CTA to a
    // 566x40 banner with the label floating alone in the middle of it. It is now
    // capped and pushed up against the save heart so price-at-the-start /
    // actions-at-the-end reads as one compact group.
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto("/en/listings/2");
    const bar = page.getByRole("region", { name: "Listing actions" });
    const cta = bar.getByRole("button", { name: "Message Seller" });
    const heart = bar.getByRole("button", { name: /save/i });
    await expect(cta).toBeVisible();
    const ctaBox = (await cta.boundingBox())!;
    const heartBox = (await heart.boundingBox())!;
    expect(ctaBox.width).toBeLessThanOrEqual(384); // md:max-w-sm
    expect(ctaBox.width).toBeGreaterThan(160); // still the loudest thing here
    // Grouped: nothing but the row's own gap between the CTA and the heart.
    expect(heartBox.x - (ctaBox.x + ctaBox.width)).toBeLessThanOrEqual(16);
  });

  test("never claims 'not saved' before it knows — and the queued tap unsaves", async ({
    page,
  }) => {
    // The truth about the heart is TWO sequential round-trips away on a cold load
    // (/api/auth/session, then /api/me/my/saved_listings), and `initialSaved` can
    // not bridge it: this page's payload is fetched anonymously, so `isSaved` is
    // false even for a listing the buyer saved months ago. The bar makes it
    // maximally visible — the heart is pinned from the first paint. Hold the list
    // back to make the window observable.
    const calls = watchSaveCalls(page);
    const release = await hold(page, "**/api/me/my/saved_listings**");

    await page.goto("/en/listings/2"); // saved by this persona in the mock API
    const bar = page.getByRole("region", { name: "Listing actions" });
    const heart = bar.getByRole("button", { name: /save/i });
    await expect(heart).toBeVisible();
    // Indeterminate: busy, and claiming NEITHER pressed nor unpressed.
    await expect(heart).toHaveAttribute("aria-busy", "true");
    expect(await heart.evaluate((el) => el.hasAttribute("aria-pressed"))).toBe(
      false,
    );

    // A tap here must not guess. It is accepted (the control says so) and no
    // request goes out yet.
    await heart.click();
    await expect(heart).toHaveAttribute("aria-disabled", "true");
    expect(calls).toEqual([]);

    // Truth lands → the queued tap runs against the RESOLVED value. The listing
    // IS saved, so this must UNSAVE it; a `POST save` here is the defect.
    await release();
    await expect(heart).toHaveAttribute("aria-pressed", "false");
    expect(calls).toEqual(["DELETE unsave"]);
  });

  test("a tap during auth bootstrap is not swallowed", async ({ page }) => {
    // While the session probe was in flight the heart returned early with no
    // request, no toast, no spinner and no style change — a dead control that
    // rendered byte-identical to its ready state. The tap is now queued and
    // replayed.
    const calls = watchSaveCalls(page);
    const release = await hold(page, "**/api/auth/session");

    await page.goto("/en/listings/2");
    const bar = page.getByRole("region", { name: "Listing actions" });
    const heart = bar.getByRole("button", { name: /save/i });
    await expect(heart).toBeVisible();
    await expect(heart).toHaveAttribute("aria-busy", "true");
    await heart.click();
    await expect(heart).toHaveAttribute("aria-disabled", "true");
    expect(calls).toEqual([]);

    await release();
    await expect(heart).toHaveAttribute("aria-pressed", "false");
    expect(calls).toEqual(["DELETE unsave"]);
  });

  test("mirrors in RTL — price on the right in Pashto", async ({ page }) => {
    await page.goto("/ps/listings/2");
    const bar = page.getByRole("region", { name: "د اعلان کړنې" });
    await expect(bar).toHaveClass(/opacity-100/);
    // The bar only carries a price below the hero one (see the two-prices spec).
    await scrollBelowInlineActions(page);
    await expect(bar).toHaveClass(/opacity-100/);
    const price = bar.getByText(/[\d\u06F0-\u06F9\u0660-\u0669]/).first();

    // Price sits on the inline-start side, which is the RIGHT half in Pashto.
    const priceBox = (await price.boundingBox())!;
    expect(priceBox.x).toBeGreaterThan(PHONE.width / 2);

    // The bar is a client island while the hero price is server-rendered, so the
    // two must format identically. V8 ships no `ps` Intl data, so the old
    // `ps-AF` tag gave the bar "AFN 30,000" beside a hero reading "\u060B \u06F3\u06F0\u066C\u06F0\u06F0\u06F0".
    const barPrice = (await price.textContent())!.trim();
    expect(barPrice).not.toContain("AFN");
    // The hero <PriceTag> is the first <span> in the h1's own block.
    const heroPrice = (
      await page.locator("h1").locator("xpath=../span[1]").textContent()
    )!.trim();
    expect(barPrice).toBe(heroPrice);
  });
});

test.describe("Listing action bar (breakpoint)", () => {
  test.use({ storageState: BUYER_STATE, viewport: PHONE });

  test("switches over exactly where `lg` does, not a px either side", async ({
    page,
  }) => {
    // The JS gate and the `lg:hidden` class must agree: a hardcoded px query
    // drifted from Tailwind's rem breakpoint under a restyled root font-size /
    // text-only zoom, and in the gap the layout was single-column with no
    // sticky CTA at all. 1023 = last compact width, 1024 = first `lg` width.
    for (const [width, expected] of [
      [1023, 1],
      [1024, 0],
    ] as const) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/en/listings/2");
      // The inline Save button is a client island — once it is on screen the
      // page has hydrated and the bar's media-query effect has run.
      await expect(
        page.getByRole("button", { name: /save|saved/i }).first(),
      ).toBeVisible();
      const bar = page.locator('[aria-label="Listing actions"]');
      if (expected) await expect(bar).toHaveCount(1);
      else await expect(bar).toHaveCount(0);
      // The spacer ships with the bar, so it must switch over at the same width.
      await expect(page.getByTestId("action-bar-spacer")).toHaveCount(expected);
    }
  });
});

test.describe("Listing action bar (desktop)", () => {
  test.use({ storageState: BUYER_STATE, viewport: { width: 1280, height: 720 } });

  test("never renders at lg and above", async ({ page }) => {
    await page.goto("/en/listings/2");
    await expect(page.getByRole("button", { name: "Message Seller" })).toBeVisible();
    await expect(page.locator('[aria-label="Listing actions"]')).toHaveCount(0);
    // No bar → no reserved space above the footer either.
    await expect(page.getByTestId("action-bar-spacer")).toHaveCount(0);
  });
});
