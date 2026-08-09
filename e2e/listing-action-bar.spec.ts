import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

/**
 * Sticky buyer action bar on the listing detail page (TASK-WEB-B2BAR).
 * Phone/tablet only: it pins price + "Message Seller" + Save to the bottom of
 * the viewport once the inline CTA block scrolls out of sight.
 *
 * Listing 2 (Samsung 4K TV) is owned by seller 2, so the buyer persona (user 1)
 * sees the bar; listing 1 is the persona's OWN listing and listing 6 is
 * reserved — neither may show it.
 */
const PHONE = { width: 390, height: 760 };

test.describe("Listing action bar (mobile)", () => {
  test.use({ storageState: BUYER_STATE, viewport: PHONE });

  test("pins price + CTA, hides over the inline block, and returns", async ({
    page,
  }) => {
    await page.goto("/en/listings/2");
    const bar = page.getByRole("region", { name: "Listing actions" });
    await expect(bar).toHaveClass(/opacity-100/);
    await expect(bar.getByText(/AFN/)).toBeVisible();
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
    // Tall enough to clear the bar, and not a screenful of emptiness. (The
    // border and the safe-area inset make the two differ by a pixel or two.)
    expect(spacerBox.height).toBeGreaterThanOrEqual(barBox.height - 4);
    expect(spacerBox.height).toBeLessThan(barBox.height + 48);

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

  test("mirrors in RTL — price on the right in Pashto", async ({ page }) => {
    await page.goto("/ps/listings/2");
    const bar = page.getByRole("region", { name: "د اعلان کړنې" });
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
