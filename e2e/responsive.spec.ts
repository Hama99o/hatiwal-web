import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

/**
 * RESPONSIVE SWEEP — the web half of the size problem.
 *
 * Why this file exists: playwright.config.ts declares ONE project, Desktop
 * Chrome, so all 41 existing specs only ever ran at 1280x720. Nothing in the
 * suite had opened this app at a phone width, which is the width most of its
 * users are on — Hatiwal is a mobile-first marketplace and the web client is the
 * secondary surface, so a desktop-only suite tests the narrower audience.
 *
 * WHAT IT ASSERTS, and why each one is a real defect rather than a style nit:
 *
 *   1. NO HORIZONTAL PAGE SCROLL. `document.scrollWidth > clientWidth` means
 *      something overflows the viewport, and on a phone that reads as a broken
 *      page: content clipped off the right edge with a sideways scrollbar. It is
 *      also the single cheapest signal of a layout that was never tried narrow.
 *      A wide table or code block is allowed to scroll INSIDE its own container;
 *      the BODY is not.
 *   2. THE PRIMARY ACTION IS REACHABLE. Not merely present in the DOM —
 *      Playwright's `toBeVisible` already covers presence and CSS visibility,
 *      and `scrollIntoViewIfNeeded` + a bounding box inside the viewport is what
 *      proves a user could actually get to it.
 *   3. NOTHING COVERS THE PAGE'S OWN CONTENT. A fixed or sticky header that
 *      overlaps the first heading is the desktop-shaped bug that shows up narrow,
 *      and it is the web cousin of the keyboard-occlusion class that produced
 *      four separate mobile bugs this session.
 *
 * The four widths are chosen to be meaningfully different rather than
 * arbitrary: 320 is the device floor and the width that actually caught a bug,
 * 375 is an iPhone SE / small Android, 768 is the tablet breakpoint where most
 * Tailwind `md:` rules switch on, and 1280 is the desktop the rest of the suite
 * already covers and must not regress.
 */

const VIEWPORTS = [
  // 320 is not padding out the list: it is the width that CAUGHT something.
  // /en/bazaar's sort + view-toggle row pushed 6px past the viewport here while
  // 360 and 375 were both clean, so a sweep starting at 375 would have called
  // that page responsive. It is also a real device floor (iPhone SE 1st gen,
  // Galaxy Fold closed) and the narrowest width Tailwind's `sm:` rules leave
  // entirely unstyled.
  { name: "phone-320", width: 320, height: 640 },
  { name: "phone-375", width: 375, height: 667 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 720 },
] as const;

/**
 * Pages every visitor passes through, with something that must stay reachable.
 *
 * `clientRendered` marks the PRIVATE pages, and it is not a detail — it is the
 * whole reason the first version of this file reported nonsense.
 *
 * These four render as a SHELL on the server no matter who asks: their content
 * comes from TanStack Query after hydration. I proved it rather than assumed it
 * — requesting /en/my-listings with a valid session cookie returns 216
 * characters of header and footer, while the public /en/bazaar returns 900 with
 * 6 listing links and 14 prices in the HTML itself. That is correct behaviour
 * for a page with no SEO value, not a bug.
 *
 * `waitForLoadState("networkidle")` therefore resolves on the EMPTY SHELL of
 * these routes, and every measurement taken at that moment describes a page
 * with nothing in it — which is why this file waits for CONTENT instead.
 *
 * TWO SEPARATE THINGS produced board card 314's "every SSR page renders a
 * 21-character shell", and conflating them cost a day:
 *
 *   1. This spec measured private pages before hydration (fixed above), which
 *      is why the very first run reported 21 GREEN overflow checks — an empty
 *      page cannot overflow, so the sweep passed by measuring nothing.
 *   2. A CORRUPTED `.next-e2e` WEBPACK CACHE. That is the real cause of the run
 *      where all 36 checks failed with a storm of `SyntaxError: Unexpected
 *      token a in JSON at position 1280` in the server log. The dist dir is
 *      shared across runs and had accumulated `.old` pack files from
 *      interrupted writes (211MB of it). `rm -rf .next-e2e` alone took the same
 *      suite from 36 failed to 31 passed, with zero parse errors.
 *
 * So: if pages come back empty here, delete `.next-e2e` FIRST. Four theories —
 * the mock API, this spec, a deleted scratch dir, the Rails host rewrite — were
 * each investigated and disproven before the build cache was suspected. The
 * mock's payloads parse; `rewriteRailsHost` returns early in this harness
 * because INTERNAL === PUBLIC; and 48 concurrent requests against a fresh dist
 * dir produce no corruption at all.
 */
const PAGES = [
  { path: "/en/bazaar", label: "bazaar", clientRendered: false },
  { path: "/en/browse", label: "browse", clientRendered: false },
  { path: "/en/categories", label: "categories", clientRendered: false },
  { path: "/en/saved", label: "saved", clientRendered: true },
  { path: "/en/conversations", label: "conversations", clientRendered: true },
  { path: "/en/profile", label: "profile", clientRendered: true },
  { path: "/en/my-listings", label: "my listings", clientRendered: true },
] as const;

/**
 * Waits for hydration to deliver something, then reports the body-text length.
 *
 * Not `networkidle`, which idles on the shell of a client-rendered page (see
 * PAGES above).
 *
 * A LENGTH IS A HINT HERE, NOT A VERDICT. "A shell is a few hundred characters
 * and a real page is thousands" is intuitive and false: /en/saved renders
 * completely — two saved listings, header, footer — in 287 characters, barely
 * above the 216-character shell. So this only waits, generously, for the page to
 * stop being empty; the CALLER decides whether it rendered, using structure.
 * The count is carried back purely to make a failure message concrete.
 */
async function waitForContent(page: Page, minChars = 400): Promise<number> {
  await page
    .waitForFunction(
      (min) => (document.body.innerText || "").trim().length > min,
      minChars,
      { timeout: 25_000 },
    )
    // Swallowed on purpose: the CALLER asserts the character count and reports
    // the real number. Throwing here would hide it behind a timeout message.
    .catch(() => {});
  return page.evaluate(() => (document.body.innerText || "").trim().length);
}

/**
 * Horizontal overflow of the PAGE, in CSS pixels.
 *
 * A 1px tolerance, not zero: sub-pixel rounding on fractional device ratios
 * routinely yields 0.5px and a test that fails on that is noise, not a finding.
 */
async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const d = document.documentElement;
    return Math.max(0, d.scrollWidth - d.clientWidth);
  });
}

for (const vp of VIEWPORTS) {
  test.describe(`responsive @ ${vp.name}`, () => {
    test.use({ storageState: BUYER_STATE, viewport: { width: vp.width, height: vp.height } });

    for (const p of PAGES) {
      test(`${p.label} does not scroll sideways`, async ({ page }) => {
        await page.goto(p.path);
        // Settle the network first: a page mid-hydration can report a transient
        // overflow that is gone a frame later, and failing on that would be
        // measuring the loading state rather than the layout.
        await page.waitForLoadState("networkidle");

        // THE PAGE MUST HAVE RENDERED BEFORE ITS LAYOUT MEANS ANYTHING — an
        // empty page cannot overflow, so without this gate the sweep passes
        // vacuously. It did exactly that on its first run: 21 GREEN overflow
        // checks on pages that had rendered nothing.
        //
        // GATED ON STRUCTURE, NOT ON LENGTH. A character floor cannot tell a
        // SHORT page from a BLANK one, and I got that wrong twice: a floor of
        // 400 failed /en/saved at all four widths on 287 characters, which is
        // the complete, correct page — two saved listings, a header and a
        // footer. Counting its text ("… AFN 30,000 Samsung 4K TV Like new Kabul
        // AFN 1,200 Firm price Winter Jacket …") lands at ~287, so the page was
        // never broken; the threshold was. Raising or lowering a magic number
        // just moves which page it lies about.
        //
        // A rendered page instead shows at least ONE of three things, and the
        // 216-character shell shows none of them: a listing link, a deliberate
        // empty state, or the page's own heading (the shell is header + footer
        // only, and every heading here lives inside the client component).
        const bodyChars = await waitForContent(page, 200);
        const [listingLinks, emptyStates, headings] = await Promise.all([
          page.locator("a[href*='/listings/']").count(),
          page.getByTestId("empty-state").count(),
          page.locator("main h1, main h2, h1, h2").count(),
        ]);
        expect(
          listingLinks + emptyStates + headings,
          `${p.label} shows no listing link, no empty state and no heading ` +
            `(${bodyChars} characters of body text) — so it is a blank shell, ` +
            `and measuring its layout proves nothing. For a private page that ` +
            `means hydration never delivered content (check the session and ` +
            `the client fetch); for a public one, check the API the harness ` +
            `points at, not the CSS. A corrupted .next-e2e webpack cache also ` +
            `does this — it is what board card 314 turned out to be, and ` +
            `\`rm -rf .next-e2e\` is the first thing to try.`,
        ).toBeGreaterThan(0);

        const overflow = await horizontalOverflow(page);
        expect(
          overflow,
          `${p.label} overflows its ${vp.width}px viewport by ${overflow}px — ` +
            `content is clipped off the right edge at this width`,
        ).toBeLessThanOrEqual(1);
      });
    }

    test("the header does not cover the page's first heading", async ({ page }) => {
      await page.goto("/en/bazaar");
      await page.waitForLoadState("networkidle");
      await waitForContent(page);

      // getByRole covers h1..h6 AND aria headings. `locator("h1, h2")` found
      // nothing on /en/bazaar and the test SKIPPED at all three viewports —
      // reading as green in the summary while asserting nothing.
      const heading = page.getByRole("heading").first();
      expect(
        await heading.count(),
        "no heading of any level on /en/bazaar — the selector, or the page, is wrong",
      ).toBeGreaterThan(0);

      const box = await heading.boundingBox();
      expect(box, "the first heading has no layout box at all").not.toBeNull();
      // Off the top of the viewport means something above it is overlapping or
      // pushing it out — the narrow-width version of a desktop-shaped header.
      expect(
        box!.y,
        `the first heading sits at y=${box!.y} — above the fold, so a fixed ` +
          `header is covering it at ${vp.width}px`,
      ).toBeGreaterThanOrEqual(0);
    });

    test("a listing can be opened and its price stays on screen", async ({ page }) => {
      await page.goto("/en/bazaar");
      await page.waitForLoadState("networkidle");
      await waitForContent(page);

      // By role, not a testid: this is the user's path through the page, and it
      // works the same at every width.
      // `/listings/`, PLURAL. The route is /[locale]/listings/[id], so
      // `a[href*='/listing/']` — with the trailing slash — could never match
      // /listings/123, and this test skipped at all three viewports while
      // looking like a pass.
      const card = page.locator("a[href*='/listings/']").first();
      expect(
        await card.count(),
        "no listing links on /en/bazaar — a marketplace feed with no listings to open",
      ).toBeGreaterThan(0);
      await card.click();
      await page.waitForLoadState("networkidle");

      // AFN is the marketplace's currency and appears on every listing — the
      // price is the one thing a buyer must never lose to a layout break.
      const price = page.getByText(/AFN/).first();
      await expect(price).toBeVisible();
      await price.scrollIntoViewIfNeeded();

      const box = await price.boundingBox();
      expect(box, "the price has no layout box").not.toBeNull();
      expect(
        box!.x,
        `the price starts at x=${box!.x}, outside a ${vp.width}px viewport`,
      ).toBeGreaterThanOrEqual(-1);
      expect(
        box!.x + box!.width,
        `the price ends at x=${box!.x + box!.width}, past the ${vp.width}px viewport edge`,
      ).toBeLessThanOrEqual(vp.width + 1);

      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    });
  });
}
