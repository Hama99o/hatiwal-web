import { test, expect } from "@playwright/test";

/**
 * SAFETY-1 — a public listing must not publish the seller's front door.
 *
 * The API snaps public coordinates to a ~500m grid and says so with
 * `location_precision` / `location_radius_m`. These specs pin the CLIENT half:
 * the buyer's map must draw an AREA and say it is approximate, and it must do so
 * even when the payload says nothing — because "absent" has to be read as
 * approximate, or an older/cached payload silently restores an exact pin.
 */
test.describe("Listing location privacy", () => {
  test("the buyer's listing page calls the location approximate", async ({ page }) => {
    await page.goto("/en/listings/1");
    await expect(page.getByTestId("listing-location-approximate")).toBeVisible();
    await expect(page.getByTestId("listing-location-approximate")).toContainText(
      /approximate/i,
    );
  });

  test("the note is translated, not English, in ps and fa", async ({ page }) => {
    // A safety message a Pashto seller cannot read is not a safety message.
    for (const locale of ["ps", "fa"]) {
      await page.goto(`/${locale}/listings/1`);
      const note = page.getByTestId("listing-location-approximate");
      await expect(note).toBeVisible();
      await expect(note).not.toContainText(/approximate/i);
    }
  });

  test("a payload with no precision field is still treated as approximate", async ({
    page,
  }) => {
    // The safe default, asserted: this is what protects a seller when an old
    // client, a cached response, or a partial serializer omits the field.
    await page.route("**/api/v1/listings/1**", async (route) => {
      const res = await route.fetch();
      const body = await res.json().catch(() => null);
      if (!body) return route.fulfill({ response: res });
      const listing = body.listing ?? body;
      delete listing.location_precision;
      delete listing.location_radius_m;
      await route.fulfill({ response: res, json: body });
    });
    await page.goto("/en/listings/1");
    await expect(page.getByTestId("listing-location-approximate")).toBeVisible();
  });
});
