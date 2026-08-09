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

  test("mirrors in RTL — price on the right in Pashto", async ({ page }) => {
    await page.goto("/ps/listings/2");
    const bar = page.getByRole("region", { name: "د اعلان کړنې" });
    await expect(bar).toHaveClass(/opacity-100/);
    const priceBox = await bar.getByText(/[\d\u06F0-\u06F9\u0660-\u0669]/).first().boundingBox();
    expect(priceBox!.x).toBeGreaterThan(PHONE.width / 2);
  });
});

test.describe("Listing action bar (desktop)", () => {
  test.use({ storageState: BUYER_STATE, viewport: { width: 1280, height: 720 } });

  test("never renders at lg and above", async ({ page }) => {
    await page.goto("/en/listings/2");
    await expect(page.getByRole("button", { name: "Message Seller" })).toBeVisible();
    await expect(page.locator('[aria-label="Listing actions"]')).toHaveCount(0);
  });
});
