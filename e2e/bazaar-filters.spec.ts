import { test, expect } from "@playwright/test";

// Filters are URL-driven (state ⇄ querystring ⇄ Rails query), so outcomes are
// asserted by navigation (deterministic SSR) and the controls by the URL they drive.
test.describe("Bazaar filters", () => {
  test("condition filter shows only matching listings", async ({ page }) => {
    await page.goto("/en/bazaar?condition=like_new");
    await expect(page.getByText("Samsung 4K TV")).toBeVisible();
    await expect(page.getByText("Winter Jacket")).toBeVisible();
    await expect(page.getByText("iPhone 13 Pro")).toHaveCount(0); // good
    await expect(page.getByText("Toyota Corolla 2015")).toHaveCount(0); // fair
  });

  test("price range narrows the feed by price", async ({ page }) => {
    await page.goto("/en/bazaar?min=40000&max=100000");
    await expect(page.getByText("iPhone 13 Pro")).toBeVisible(); // 45,000
    await expect(page.getByText("MacBook Pro M2")).toBeVisible(); // 90,000
    await expect(page.getByText("Toyota Corolla 2015")).toHaveCount(0); // 600,000
    await expect(page.getByText("Winter Jacket")).toHaveCount(0); // 1,200
  });

  test("condition chip drives the query", async ({ page }) => {
    await page.goto("/en/bazaar");
    await expect(page.getByText("iPhone 13 Pro")).toBeVisible();
    const chip = page.getByRole("button", { name: "Like new", exact: true });
    await expect(async () => {
      await chip.click();
      await expect(page).toHaveURL(/condition=like_new/);
    }).toPass({ timeout: 20_000 });
  });

  test("reset clears active filters", async ({ page }) => {
    await page.goto("/en/bazaar?condition=like_new");
    await expect(page.getByText("Samsung 4K TV")).toBeVisible();
    const reset = page.getByRole("button", { name: /Reset filters/i });
    await expect(async () => {
      await reset.click();
      await expect(page).not.toHaveURL(/condition=/);
    }).toPass({ timeout: 20_000 });
    // Reset cleared the filters → the reset control is no longer rendered.
    await expect(
      page.getByRole("button", { name: /Reset filters/i }),
    ).toHaveCount(0);
  });

  // docs/design/bazaar.md: on a phone, Filters + sort + view are ONE row in every
  // locale (fa was 1px too wide and wrapped before the sort select was capped).
  // ...including with a search + an active filter, whose count badge widens the
  // Filters button (it wrapped the row before the sort select could shrink).
  for (const [locale, qs] of [["en", ""], ["ps", ""], ["fa", ""], ["fa", "?q=iphone&condition=good"], ["en", "?q=iphone&condition=good"]]) {
    test(`phone (${locale}${qs}): Filters, sort and view share one row`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/${locale}/bazaar${qs}`);
      const sort = page.locator("main select").first();
      await expect(sort).toBeVisible({ timeout: 60_000 });
      const filters = page.locator("main .lg\\:hidden > button").first();
      const [a, b] = await Promise.all([filters.boundingBox(), sort.boundingBox()]);
      expect(Math.abs(a!.y + a!.height / 2 - (b!.y + b!.height / 2))).toBeLessThan(4);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    });
  }
});
