import { test, expect } from "@playwright/test";

test.describe("Home", () => {
  test("renders hero, categories and recent listings from the API", async ({ page }) => {
    await page.goto("/en");

    await expect(page.getByRole("heading", { name: "Buy and sell locally in Afghanistan" })).toBeVisible();
    // Categories (localized name_en) pulled from the API.
    await expect(page.getByText("Electronics")).toBeVisible();
    await expect(page.getByText("Vehicles")).toBeVisible();
    await expect(page.getByText("Clothes & Fashion")).toBeVisible();
    // Recent listings section + fixture data.
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

  test("header + footer navigation is present", async ({ page }) => {
    await page.goto("/en");
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("link", { name: "Privacy Policy" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Delete account" })).toBeVisible();
  });
});
