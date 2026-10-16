import { test, expect } from "@playwright/test";
import en from "../messages/en.json";
import fa from "../messages/fa.json";
import { asStayDetails, cleanStayDetails, stayAmenities, stayTime } from "../src/lib/stays";

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
    // Times in Dari digits, like the rest of the page.
    await expect(page.getByTestId("stay-times")).toContainText("۱۴:۰۰");
  });

  test("an item's page is unchanged: no room facts, no unit", async ({ page }) => {
    await page.goto("/en/listings/1");
    await expect(page.getByTestId("stay-facts")).toHaveCount(0);
    await expect(page.locator("#listing-price")).not.toContainText(en.listing.stays.perNight);
  });
});

// Pure guards (no page): a malformed `details` payload must never crash the
// listing page's SSR or the facts block (security review, dd).
test.describe("Stay details guards", () => {
  test("anything but a plain object reads as no details", () => {
    for (const raw of [null, undefined, "x", 3, ["wifi"], true]) expect(asStayDetails(raw)).toEqual({});
    expect(asStayDetails({ guests: 2 })).toEqual({ guests: 2 });
  });

  test("amenities only from a real array, known ones only", () => {
    for (const amenities of ["wifi", { wifi: true }, 7, null] as never[]) expect(stayAmenities({ amenities })).toEqual([]);
    expect(stayAmenities({ amenities: ["wifi", "sauna", 5, "tv"] as never })).toEqual(["wifi", "tv"]);
    expect(stayAmenities(null)).toEqual([]);
  });

  test("a malformed payload cleans down to what is valid", () => {
    expect(stayTime(1400)).toBeUndefined();
    expect(cleanStayDetails("oops" as never)).toEqual({});
    expect(cleanStayDetails({ guests: 2, amenities: "wifi" as never, checkIn: 1400 as never })).toEqual({ guests: 2 });
  });
});
