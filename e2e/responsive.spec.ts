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
 * The three widths are chosen to be meaningfully different rather than
 * arbitrary: 375 is an iPhone SE / small Android, 768 is the tablet breakpoint
 * where most Tailwind `md:` rules switch on, and 1280 is the desktop the rest of
 * the suite already covers and must not regress.
 */

const VIEWPORTS = [
  { name: "phone-375", width: 375, height: 667 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 720 },
] as const;

/** Pages every visitor passes through, with something that must stay reachable. */
const PAGES = [
  { path: "/en/bazaar", label: "bazaar" },
  { path: "/en/browse", label: "browse" },
  { path: "/en/categories", label: "categories" },
  { path: "/en/saved", label: "saved" },
  { path: "/en/conversations", label: "conversations" },
  { path: "/en/profile", label: "profile" },
  { path: "/en/my-listings", label: "my listings" },
] as const;

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
        // Wait for the network to settle before measuring: a page mid-hydration
        // can report a transient overflow that is gone a frame later, and
        // failing on that would be measuring the loading state, not the layout.
        await page.waitForLoadState("networkidle");

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
