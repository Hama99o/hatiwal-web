import { test, expect } from "@playwright/test";

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
