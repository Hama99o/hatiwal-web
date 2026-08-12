import { test, expect, type Locator, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import { hold } from "./route-gate";
import en from "../messages/en.json";
import ps from "../messages/ps.json";
import fa from "../messages/fa.json";

/**
 * Sticky buyer action bar on the listing detail page (TASK-WEB-B2BAR).
 * Phone/tablet only: it pins the seller CTA + Save to the bottom of the
 * viewport, and adds the price once the hero price has scrolled away.
 *
 * Listing 2 (Samsung 4K TV) is owned by seller 2, so the buyer persona (user 1)
 * sees the bar; listing 1 is the persona's OWN listing and listing 6 is
 * reserved — neither may show it.
 */
const PHONE = { width: 390, height: 760 };

/**
 * The pinned CTA's label, per locale — READ FROM THE CATALOGS rather than
 * retyped. The label is `listing.detail.contactSeller` (the same key mobile's
 * CTA uses, parity rule 2), and this suite asserts it a dozen times plus once
 * per locale in the overflow loop; a copy change would otherwise leave every one
 * of them asserting a string the UI no longer shows.
 */
const CTA = {
  en: en.listing.detail.contactSeller,
  ps: ps.listing.detail.contactSeller,
  fa: fa.listing.detail.contactSeller,
} as const;
/**
 * The composer's placeholder (`chat.startConversation.placeholder`), from the
 * catalog for the same reason as the labels above.
 */
const COMPOSER = en.chat.startConversation.placeholder;
/** Same for the bar's own accessible name (`listing.detail.actionBarLabel`). */
const BAR = {
  en: en.listing.detail.actionBarLabel,
  ps: ps.listing.detail.actionBarLabel,
} as const;

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
    const bar = page.getByRole("region", { name: BAR.en });
    await expect(bar).toHaveClass(/opacity-100/);
    await expect(bar.getByRole("button", { name: CTA.en })).toBeVisible();
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
    const bar = page.getByRole("region", { name: BAR.en });
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

    // ...and at every scroll depth there is EXACTLY ONE price on screen: the
    // bar carries one if and only if the hero one is gone. Asserted as that
    // biconditional rather than a weaker "not both", which a moment where
    // NEITHER is on screen would also satisfy.
    //
    // Retried until it settles, and deliberately so: an IntersectionObserver
    // gate cannot be frame-exact — the callback is delivered after the scroll
    // has already happened and React renders after that, so there is always a
    // sub-frame where the DOM still describes the previous scroll position. It
    // is the settled state a buyer can actually read; measured here, the bar
    // drops (or adds) its price within ~25ms of the scroll, and asserting the
    // raw first sample instead made this spec fail 2 runs in 3.
    for (const y of [0, 200, 400, 600, 900, 1400, 1800]) {
      await page.evaluate((to) => window.scrollTo(0, to), y);
      await expect(async () => {
        // `barLabel` is passed in, not closed over: this function is stringified
        // and run in the browser, where the module scope of this file does not
        // exist.
        const seen = await page.evaluate((barLabel) => {
          const inView = (el: Element | null) => {
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return r.bottom > 0 && r.top < window.innerHeight;
          };
          const barEl = document.querySelector(`[aria-label="${barLabel}"]`);
          // The bar's price is the row's first child; the CTA's own label span
          // lives inside a <button>, so this can only be the <PriceTag>.
          const barSpan = barEl?.querySelector(":scope > div > span");
          return {
            hero: inView(document.getElementById("listing-price")),
            bar: !!barSpan,
          };
        }, BAR.en);
        expect(
          seen.bar,
          `bar price vs hero price at scrollY=${y} (hero on screen: ${seen.hero})`,
        ).toBe(!seen.hero);
      }).toPass({ timeout: 5_000 });
    }
  });

  test("steps aside over the footer so its links stay reachable", async ({
    page,
  }) => {
    await page.goto("/en/listings/2");
    const bar = page.getByRole("region", { name: BAR.en });
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

  test("its seller CTA opens the same dialog, correctly positioned", async ({
    page,
  }) => {
    await page.goto("/en/listings/2");
    const bar = page.getByRole("region", { name: BAR.en });
    await expect(bar).toHaveClass(/opacity-100/);

    await expect(async () => {
      await bar.getByRole("button", { name: CTA.en }).click();
      await expect(page.getByPlaceholder(COMPOSER)).toBeVisible({
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
    const bar = page.getByRole("region", { name: BAR.en });
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
    const bar = page.getByRole("region", { name: BAR.en });
    await expect(bar).toHaveClass(/opacity-100/);
    const composer = page.getByPlaceholder(COMPOSER);
    await expect(async () => {
      await bar.getByRole("button", { name: CTA.en }).click();
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
      .toContain(CTA.en);
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
    const bar = page.getByRole("region", { name: BAR.en });
    await expect(bar).toHaveClass(/opacity-100/);
    const composer = page.getByPlaceholder(COMPOSER);
    await expect(async () => {
      await bar.getByRole("button", { name: CTA.en }).click();
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
        // Passed in, not closed over — this runs in the browser (see above).
        .evaluate(
          (el, barLabel) => !!el.closest(`[aria-label="${barLabel}"]`),
          BAR.en,
        ),
    ).toBe(false);
    await composer.fill("Is it still available? Can we meet in Kabul?");

    // Closing it lets the bar go for good at this width — no leftover duplicate
    // controls beside the desktop column CTA.
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.locator(`[aria-label="${BAR.en}"]`)).toHaveCount(0);
    await expect(page.getByTestId("action-bar-spacer")).toHaveCount(0);
  });

  test("absent on your own listing and on a reserved one", async ({ page }) => {
    await page.goto("/en/listings/1"); // owned by the signed-in persona
    await expect(page.getByRole("heading", { name: "iPhone 13 Pro" })).toBeVisible();
    await expect(page.locator(`[aria-label="${BAR.en}"]`)).toHaveCount(0);

    await page.goto("/en/listings/6"); // reserved → inline notice instead
    await expect(
      page.getByRole("heading", { name: "Mountain Bike (Reserved)" }),
    ).toBeVisible();
    await expect(page.locator(`[aria-label="${BAR.en}"]`)).toHaveCount(0);
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
      .getByRole("region", { name: BAR.en })
      .boundingBox())!;
    // EXACTLY as tall as the bar: the spacer takes its height from a
    // ResizeObserver on the bar, not from a hand-written calc(). The old
    // `calc(4rem + safe-area)` was 64px against a 65px bar (12 + 40 + 12 + the
    // 1px border) and drifted again the moment the row grew — the controls went
    // from 40px to the 44px touch floor, so the bar is 69px now.
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

  test("shows one primary CTA, never a clipped label — in the crowded row too", async ({
    page,
  }) => {
    // The bar carries price + Message + Save and nothing else. A second 40px
    // control here (the inline block's icon-only "Make an Offer") left 98px of
    // button for a 125px label on a 360px phone — the primary CTA, the whole
    // reason the bar exists, was cut mid-word. The price is `shrink-0` (a
    // truncated price would misinform a buyer), so the label is what gives.
    //
    // Measured BELOW the inline actions, not at scrollY=0. The two-prices spec
    // above proves the bar carries NO price at the top of the page, so an overflow
    // read there only ever exercised the roomy two-item row — while the row the
    // 98px-for-125px measurement was about (price + CTA + heart) is the one a
    // buyer meets after scrolling past the hero price, and was untested at every
    // width. ps/fa are included because ps is the widest label of the three
    // ("پلورونکي سره اړیکه", 18 characters against 14 for "Contact Seller", and no
    // Latin-narrow glyphs among them) and 360px is the commonest Android portrait
    // width — the real worst case, and the one this suite must keep measuring
    // every time the copy changes.
    for (const { locale, width } of [
      { locale: "en", width: 360 },
      { locale: "en", width: 390 },
      { locale: "en", width: 430 },
      { locale: "ps", width: 360 },
      { locale: "fa", width: 360 },
    ] as const) {
      const label = CTA[locale];
      const where = `${locale} @ ${width}px`;
      await page.setViewportSize({ width, height: 760 });
      await page.goto(`/${locale}/listings/2`);
      const bar = page.getByTestId("listing-action-bar");
      await expect(bar).toHaveClass(/opacity-100/);
      // Two controls, never three: the offer affordance stays in the inline block.
      await expect(bar.getByRole("button")).toHaveCount(2);

      await scrollBelowInlineActions(page);
      await expect(bar).toHaveClass(/opacity-100/);
      // The price is the row's only direct-child <span>; its presence is what
      // makes this the crowded row rather than the roomy one.
      await expect(bar.locator(":scope > div > span")).toHaveCount(1);

      const cta = bar.locator("button").first();
      await expect(cta).toHaveText(label);
      const overflow = await cta.evaluate((el) => {
        const span = el.querySelector("span");
        return {
          button: el.scrollWidth > el.clientWidth,
          label: span ? span.scrollWidth > span.clientWidth : false,
        };
      });
      expect(overflow, `clipped label in ${where}`).toEqual({
        button: false,
        label: false,
      });
      // ...and the row itself fits the bar, so nothing is pushed off the edge.
      const rowOverflow = await bar
        .locator(":scope > div")
        .first()
        .evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(rowOverflow, `row overflows in ${where}`).toBeLessThanOrEqual(1);
    }
  });

  test("stays a grouped toolbar on a tablet — with and without the price", async ({
    page,
  }) => {
    // Between 640px and 1023px `flex-1` alone stretched the primary CTA to a
    // 566x40 banner with its label floating alone in the middle of it. Capping the
    // BUTTON fixed that and broke the other state: with no price — which is
    // exactly what this viewport shows at the top of the page — the row became
    // ~300px of empty frosted strip, then the CTA, then the heart. The cap lives
    // on the ROW now, so the group is compact, centred and the same shape whether
    // or not the price is there. Both states are measured, because pinning only
    // one is how the first fix passed while looking wrong.
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto("/en/listings/2");
    const bar = page.getByTestId("listing-action-bar");
    const row = bar.locator(":scope > div").first();
    const cta = bar.getByRole("button", { name: CTA.en });
    const heart = bar.getByRole("button", { name: /save/i });
    await expect(cta).toBeVisible();

    for (const state of ["no price", "with price"] as const) {
      if (state === "with price") {
        await scrollBelowInlineActions(page);
        await expect(bar.locator(":scope > div > span")).toHaveCount(1);
      } else {
        await expect(bar.locator(":scope > div > span")).toHaveCount(0);
      }
      await expect(bar).toHaveClass(/opacity-100/);
      const rowBox = (await row.boundingBox())!;
      const ctaBox = (await cta.boundingBox())!;
      const heartBox = (await heart.boundingBox())!;
      // Capped (sm:max-w-md) — a toolbar, not a full-bleed slab.
      expect(rowBox.width, state).toBeLessThanOrEqual(448);
      // Centred, so neither side of the strip is the conspicuously empty one.
      const startGap = rowBox.x;
      const endGap = 768 - (rowBox.x + rowBox.width);
      expect(Math.abs(startGap - endGap), state).toBeLessThanOrEqual(2);
      // Still the loudest thing in the bar, and never wider than its row.
      expect(ctaBox.width, state).toBeGreaterThan(160);
      expect(ctaBox.width, state).toBeLessThanOrEqual(rowBox.width);
      // Grouped: nothing but the row's own gap between the CTA and the heart.
      expect(heartBox.x - (ctaBox.x + ctaBox.width), state).toBeLessThanOrEqual(16);
    }
  });

  test("its controls clear the 44px touch floor", async ({ page }) => {
    // docs/DESIGN_SYSTEM.md mandates ≥44px. 40px is the house default for chrome a
    // mouse can reach, but this bar is `lg:hidden` — the one touch-only surface on
    // the site — and its heart is an icon-only target 12px from the screen edge.
    await page.goto("/en/listings/2");
    const bar = page.getByTestId("listing-action-bar");
    await expect(bar).toHaveClass(/opacity-100/);
    for (const [name, control] of [
      ["CTA", bar.getByRole("button", { name: CTA.en })],
      ["heart", bar.getByRole("button", { name: /save/i })],
    ] as const) {
      const box = (await control.boundingBox())!;
      expect(box.height, name).toBeGreaterThanOrEqual(44);
      expect(box.width, name).toBeGreaterThanOrEqual(44);
    }
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
    const bar = page.getByRole("region", { name: BAR.en });
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
    const bar = page.getByRole("region", { name: BAR.en });
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

  test("its CTA never bounces a signed-in buyer to /login mid-bootstrap", async ({
    page,
  }) => {
    // The other half of the same defect as the heart above, and the louder one:
    // until the session probe answers, `useAuth()` says "loading", and the CTA
    // used to render the GUEST branch — an <a href="/login"> labelled with the
    // same CTA copy, pinned from the first paint. A signed-in buyer who tapped it in
    // that window was navigated off the listing to a login page they don't need.
    // The page's SSR viewer hint says a session came with this request, so the
    // guest branch is not even a candidate here (see the guest suite below for
    // the other direction).
    const release = await hold(page, "**/api/auth/session");

    await page.goto("/en/listings/2");
    const bar = page.getByRole("region", { name: BAR.en });
    const cta = bar.getByRole("button", { name: CTA.en });
    // A button that says it is not ready — never a link to /login.
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("aria-busy", "true");
    await expect(bar.getByRole("link", { name: CTA.en })).toHaveCount(0);

    // The tap is held, not honoured against a guessed identity: no navigation.
    // COUNTED, not sampled: `expect(page).toHaveURL(/listings\/2$/)` right after
    // the click polls and passes on its first sample, because the URL already
    // matches — a navigation that begins a tick later slips straight through it.
    let navigations = 0;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigations++;
    });
    await cta.click();
    await expect(cta).toHaveAttribute("aria-disabled", "true");
    // A real window for a navigation to show up in, rather than one raw sample.
    await page.waitForTimeout(500);
    expect(navigations).toBe(0);
    await expect(page).toHaveURL(/\/en\/listings\/2$/);

    // Auth lands → the held tap opens the composer, on the listing, as if the
    // buyer had waited for it.
    await release();
    await expect(page.getByPlaceholder(COMPOSER)).toBeVisible();
    expect(navigations).toBe(0);
    await expect(page).toHaveURL(/\/en\/listings\/2$/);
  });

  test("...and it keeps its primary fill the whole time it waits", async ({
    page,
  }) => {
    // The unsettled cue must not cost the bar the thing it exists for. A
    // `secondary` variant here dropped fill-vs-bar contrast from 4.97:1 to
    // 1.19:1 light / 1.35:1 dark, so on every signed-in cold load the pinned
    // primary action rendered as bare text with no button shape and then popped
    // to blue when the probe answered. `aria-busy` carries "not ready" (asserted
    // in the spec above) and the spinner arrives when a tap is held; the fill
    // never changes. See src/lib/unsettled.ts, where that is decided once for
    // every labelled control.
    const release = await hold(page, "**/api/auth/session");
    await page.goto("/en/listings/2");
    const cta = page
      .getByRole("region", { name: BAR.en })
      .getByRole("button", { name: CTA.en });
    await expect(cta).toHaveAttribute("aria-busy", "true");
    const fill = (el: Locator) =>
      el.evaluate((n) => getComputedStyle(n).backgroundColor);
    const waiting = await fill(cta);
    // Not the bar's own frosted surface, i.e. a real button is on screen.
    expect(waiting).not.toBe("rgba(0, 0, 0, 0)");

    await release();
    await expect(cta).not.toHaveAttribute("aria-busy", "true");
    expect(await fill(cta)).toBe(waiting);
  });

  test("waits a slow session probe out instead of cutting it off", async ({
    page,
  }) => {
    // `/api/auth/session` ROTATES the devise access-token: Rails issues a new one
    // and it only reaches the browser in that response's Set-Cookie. An
    // `AbortSignal.timeout(8_000)` on it therefore discarded a token Rails had
    // already replaced, and the retry 1.5s later presented the stale one —
    // outside devise_token_auth's 5s batch buffer, so Rails answered 401 and the
    // route cleared the cookies: a VALID session signed out, on exactly the slow
    // network the timeout was meant to help. (It was also a synchronous
    // `TypeError` on Safari <16 / WebView <103, where the method does not exist,
    // which made every visitor on those browsers a guest.) So the probe now runs
    // to completion however long it takes, and a hang costs the UI nothing worse
    // than "still waiting".
    const probes: number[] = [];
    const t0 = Date.now();
    page.on("request", (req) => {
      if (new URL(req.url()).pathname === "/api/auth/session")
        probes.push(Date.now() - t0);
    });
    const release = await hold(page, "**/api/auth/session");
    await page.goto("/en/listings/2");
    const cta = page
      .getByRole("region", { name: BAR.en })
      .getByRole("button", { name: CTA.en });
    await expect(cta).toBeVisible();
    await cta.click(); // held, exactly as in the spec above

    // Past the 8s the abort used to fire at, plus its first 1.5s backoff.
    await page.waitForTimeout(10_000);
    // Nothing was RE-issued — that retry is what presented the stale token.
    // Measured from the first probe rather than from the navigation, and with a
    // window rather than a count: dev-mode Strict Mode double-invokes the mount
    // effect, and a cold compile can put that mount seconds after `goto`. What
    // matters is that nothing fires LATER, where the abort's 1500ms backoff would
    // have put it.
    expect(probes.length).toBeGreaterThan(0);
    expect(probes.filter((at) => at - probes[0] > 2_000)).toEqual([]);
    // ...and the viewer the server already identified is never demoted to guest
    // by a slow probe: still waiting, still holding the tap, still no /login.
    await expect(cta).toHaveAttribute("aria-busy", "true");
    await expect(
      page.getByRole("region", { name: BAR.en }).getByRole("link"),
    ).toHaveCount(0);

    await release();
    await expect(page.getByPlaceholder(COMPOSER)).toBeVisible();
  });

  test("an unsettled heart signals with colour, never a dim", async ({
    page,
  }) => {
    // `opacity-70` stacked on the muted glyph measured 2.64:1 against the bar's
    // `bg-background/95` — under WCAG's 3:1 non-text floor — and 2.56:1 light /
    // 2.47:1 dark once a tap flips the heart to `fill-destructive`. Undimmed, the
    // colour swap alone clears it (4.52:1 / 3.62:1), so the colour is the cue and
    // nothing touches opacity. Worst case was here: the heart is this bar's
    // pinned state indicator on the site's one touch-only surface.
    const release = await hold(page, "**/api/me/my/saved_listings**");
    await page.goto("/en/listings/2"); // saved by this persona in the mock API
    const heart = page
      .getByRole("region", { name: BAR.en })
      .getByRole("button", { name: /save/i });
    await expect(heart).toHaveAttribute("aria-busy", "true");
    const opacity = await heart.evaluate((el) => getComputedStyle(el).opacity);
    expect(opacity).toBe("1");
    const glyphColor = () =>
      heart.locator("svg").evaluate((el) => getComputedStyle(el).color);
    const unknownColor = await glyphColor();

    await release();
    await expect(heart).toHaveAttribute("aria-pressed", "true");
    expect(await heart.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    // The one cue that is left has to actually be visible.
    expect(await glyphColor()).not.toBe(unknownColor);
  });

  test("a held tap says so by swapping the glyph — with animations off", async ({
    page,
  }) => {
    // The cue for "I have your tap, I can't run it yet" was `animate-pulse`, which
    // is two failures in one: it troughs at `opacity: .5` (the muted heart bottoms
    // out at 1.90:1, worse than the static `opacity-70` it replaced for missing
    // WCAG's 3:1 non-text floor), and `motion-reduce:animate-none` left a
    // `prefers-reduced-motion` viewer with NO feedback at all — tap, nothing, tap
    // again, silently swallowed by the `if (busy) return` guard. So the cue is the
    // GLYPH: `Heart` → `Loader2`, the same 16/20px box, no contrast cost, and
    // visible with animation disabled. Emulated here precisely because that is the
    // viewer who had nothing.
    await page.emulateMedia({ reducedMotion: "reduce" });
    const release = await hold(page, "**/api/me/my/saved_listings**");
    await page.goto("/en/listings/2"); // saved by this persona in the mock API
    const heart = page
      .getByRole("region", { name: BAR.en })
      .getByRole("button", { name: /save/i });
    await expect(heart).toHaveAttribute("aria-busy", "true");
    // The MARK itself, not a class or a colour — the assertion has to fail if the
    // cue ever goes back to being an opacity or an animation.
    const glyph = () => heart.locator("svg").evaluate((el) => el.innerHTML);
    const idle = await glyph();

    await heart.click();
    await expect(heart).toHaveAttribute("aria-disabled", "true");
    await expect.poll(glyph).not.toBe(idle);
    expect(await heart.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");

    // Truth lands → the queued tap runs and the heart comes back.
    await release();
    await expect(heart).toHaveAttribute("aria-pressed", "false");
    expect(await glyph()).toBe(idle);
  });

  test("mirrors in RTL — price on the right in Pashto", async ({ page }) => {
    await page.goto("/ps/listings/2");
    const bar = page.getByRole("region", { name: BAR.ps });
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

test.describe("Listing action bar (guest)", () => {
  // No storageState — the shape MOST listing-detail visits have, since search
  // traffic is the bulk of them.
  test.use({ storageState: { cookies: [], origins: [] }, viewport: PHONE });

  test("the CTA is a real sign-in link, in the server HTML", async ({ page }) => {
    // Regression guard for the worst state this bar has been in: the "session not
    // resolved" branch swallowed the guest case, so a cookie-less request got
    // `<button aria-busy>Contact Seller</button>` and the page contained ZERO
    // /login hrefs. The page's primary action therefore did nothing at all until
    // React attached — a tap at first paint was simply lost — and the whole action
    // column announced itself pending (5 × aria-busy: this CTA, both hearts and the
    // 3 cross-sell hearts) even though the server had already answered "guest" one
    // line up in the same tree. It now picks the real branch during SSR.
    //
    // The href carries `?next=` (src/components/auth/login-href.ts), and that is
    // asserted here rather than left to the login page's own suite: a bare
    // `/login` costs a guest the listing they were reading — `login-form.tsx`
    // (`safeNextPath`) lands them on /profile — so this ONE funnel, the pinned CTA
    // the whole bar exists for, would end with the buyer signed in and the listing
    // gone. Without the query string on purpose: this href is RENDERED, and the
    // live query is unreadable during SSR, so including it would make the server
    // HTML and the first client render disagree on the site's primary action.
    const res = await page.request.get("/en/listings/2");
    const html = await res.text();
    expect(html).toContain('href="/en/login?next=%2Flistings%2F2"');
    expect(html).not.toContain('aria-busy="true"');

    await page.goto("/en/listings/2");
    const bar = page.getByTestId("listing-action-bar");
    await expect(bar).toHaveClass(/opacity-100/);
    await expect(
      bar.getByRole("link", { name: CTA.en }),
    ).toHaveAttribute("href", "/en/login?next=%2Flistings%2F2");
    // The heart is settled too: a guest's saved state needs no probe, so it must
    // not sit in the indeterminate "we don't know yet" state either.
    const heart = bar.getByRole("button", { name: /save/i });
    await expect(heart).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  });

  test("...and it still works when the session probe never answers", async ({
    page,
  }) => {
    // The unbounded case, which is why the SSR hint matters more than the ~1s
    // happy path: `AuthProvider.refresh()` had no timeout and its backoff only
    // covered REJECTIONS, so a request that merely hangs (dead mobile network,
    // captive portal — normal in this market) left the pinned CTA dimmed and dead
    // forever, with no path to sign in, where it used to be a working link. The
    // guest branch no longer waits on the probe at all.
    await hold(page, "**/api/auth/session"); // never released
    await page.goto("/en/listings/2");
    const cta = page
      .getByTestId("listing-action-bar")
      .getByRole("link", { name: CTA.en });
    await expect(cta).toBeVisible();
    await cta.click();
    // ...and it still brings them BACK: signing in from here returns the buyer to
    // this listing, not to /profile (see the spec above for why `next` is on the
    // href rather than added on click).
    await expect(page).toHaveURL(/\/en\/login\?next=%2Flistings%2F2$/);
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
      const bar = page.locator(`[aria-label="${BAR.en}"]`);
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
    await expect(page.getByRole("button", { name: CTA.en })).toBeVisible();
    await expect(page.locator(`[aria-label="${BAR.en}"]`)).toHaveCount(0);
    // No bar → no reserved space above the footer either.
    await expect(page.getByTestId("action-bar-spacer")).toHaveCount(0);
  });
});
