import { test, expect } from "@playwright/test";
import en from "../messages/en.json";
import fa from "../messages/fa.json";

/**
 * Stays (api STAYS_DESIGN): a hotel room's page — "AFN 1,500 / night", the
 * room's facts (guests · beds · bathroom), what the place offers, check-in /
 * check-out, and no item condition. The mock's room (9901) is reachable by id
 * only, so no other spec sees it. Form + filters run against the real API in
 * e2e-real/11-stays.spec.ts.
 */
test.describe("A hotel room's page", () => {
  test("reads per night, with the room's facts and no condition", async ({ page }) => {
    await page.goto("/en/listings/9901");
    await expect(page.getByRole("heading", { level: 1, name: "Double room, Shahr-e Naw" })).toBeVisible();
    await expect(page.locator("#listing-price")).toContainText(en.listing.stays.perNight);

    const facts = page.getByTestId("stay-facts");
    await expect(facts.getByRole("heading", { name: en.listing.stays.detailsTitle })).toBeVisible();
    await expect(facts.getByTestId("stay-facts-line")).toContainText("2 guests");
    await expect(facts.getByTestId("stay-facts-line")).toContainText("1 bed");
    await expect(facts.getByTestId("stay-facts-line")).toContainText(en.listing.stays.bathroomPrivate);
    for (const a of ["wifi", "hot_water", "breakfast"] as const)
      await expect(facts.getByTestId("stay-amenities")).toContainText(en.listing.stays.amenities[a]);
    await expect(facts.getByTestId("stay-times")).toContainText("Check-in from 14:00");
    await expect(facts.getByTestId("stay-times")).toContainText("Check-out until 11:00");
    // A room has no condition badge (scoped to the listing's own info column —
    // the similar-listings cards further down are items with conditions).
    const info = page.getByRole("heading", { level: 1 }).locator("xpath=ancestor::div[contains(@class,'order-2')][1]");
    for (const [key, c] of Object.entries(en.listing.condition))
      if (key !== "label" && typeof c === "string") await expect(info.getByText(c, { exact: true })).toHaveCount(0);
  });

  test("speaks Dari right to left", async ({ page }) => {
    await page.goto("/fa/listings/9901");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("#listing-price")).toContainText(fa.listing.stays.perNight);
    await expect(page.getByTestId("stay-facts")).toContainText(fa.listing.stays.bathroomPrivate);
    await expect(page.getByTestId("stay-amenities")).toContainText(fa.listing.stays.amenities.wifi);
  });

  test("an item's page is unchanged: no room facts, no unit", async ({ page }) => {
    await page.goto("/en/listings/1");
    await expect(page.getByTestId("stay-facts")).toHaveCount(0);
    await expect(page.locator("#listing-price")).not.toContainText(en.listing.stays.perNight);
  });
});
