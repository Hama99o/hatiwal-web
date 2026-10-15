import { test, expect } from "@playwright/test";

test.describe("Home", () => {
  test("renders hero, categories and recent listings from the API", async ({ page }) => {
    await page.goto("/en");

    await expect(page.getByRole("heading", { name: "Buy and sell locally in Afghanistan" })).toBeVisible();
    // Categories (localized name_en) pulled from the API.
    await expect(page.getByText("Electronics")).toBeVisible();
    await expect(page.getByText("Vehicles")).toBeVisible();
    await expect(page.getByText("Clothes & Fashion")).toBeVisible();
    // Recent listings section + fixture data. The heading, the trailing
    // "View all" and the grid all come from the shared <ListingRail> (the same
    // component as the listing-detail cross-sell rails) — this locks that in.
    await expect(
      page.getByRole("heading", { name: "Recent listings" }),
    ).toBeVisible();
    // Two "View all" links now: the category pill row's (→ /categories) and the
    // rail's (→ /bazaar). Each must point at its own page.
    const viewAll = page.getByRole("link", { name: /View all/i });
    await expect(viewAll).toHaveCount(2);
    await expect(viewAll.first()).toHaveAttribute("href", "/en/categories");
    await expect(viewAll.last()).toHaveAttribute("href", "/en/bazaar");
    await expect(page.getByText("iPhone 13 Pro")).toBeVisible();
    await expect(page.getByText("Toyota Corolla 2015")).toBeVisible();
    // Price-drop badge surfaces. Listing cards render the short variant
    // ("-12%", listing.priceDrop.badgeCardShort) — the long "12% price drop"
    // copy is the detail-page variant.
    await expect(page.getByText("-12%")).toBeVisible();
  });

  test("hero CTA navigates to the listings feed", async ({ page }) => {
    await page.goto("/en");
    // The hero CTA is a submit button on a GET search form pointing at /bazaar.
    await page.getByRole("button", { name: "Explore the Bazaar" }).click();
    await expect(page).toHaveURL(/\/(bazaar|browse)/);
    await expect(page.getByText("iPhone 13 Pro")).toBeVisible();
  });

  test("phone: the hero offers Bazaar + New Listing, and categories are one pill row", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en");
    const hero = page.locator("section").first();
    // The header carries the phone search row, so the hero has no second search box.
    await expect(hero.getByRole("search")).toBeHidden();
    await expect(hero.getByRole("link", { name: "Explore the Bazaar" })).toHaveAttribute("href", "/en/bazaar");
    await expect(hero.getByRole("link", { name: "New Listing" })).toHaveAttribute("href", "/en/listings/new");
    // One row: every pill shares the first pill's top edge (it scrolls sideways).
    const pills = page.getByRole("region", { name: "Shop by category" }).getByRole("listitem");
    const tops = await pills.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(tops.length).toBeGreaterThan(2);
    expect(new Set(tops).size).toBe(1);
    // ...and the page itself never scrolls sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test("header + footer navigation is present", async ({ page }) => {
    await page.goto("/en");
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("link", { name: "Privacy Policy" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Delete account" })).toBeVisible();
  });
});
