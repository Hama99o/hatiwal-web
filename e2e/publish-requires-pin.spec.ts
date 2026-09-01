import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

/**
 * Publishing requires a real point, not just a location label.
 *
 * `LocationSearch`'s `onTextChange` sets the location STRING on every keystroke
 * and never touches lat/lng — only picking a suggestion or tapping the map does.
 * So typing a place name and pressing Publish used to create a listing with a
 * label and NO coordinates: it renders no map, and it can never appear in a
 * radius or distance search. Production listing 39 is exactly that shape.
 *
 * Mobile has always blocked it (`publishReadiness.ts` lists "location" among its
 * publish blockers). This is web catching up, so the two clients stop
 * disagreeing about what is publishable into shared data.
 */
test.describe("Publish requires a map pin", () => {
  test.use({ storageState: BUYER_STATE });

  test("typing a location without picking a point blocks Publish", async ({ page }) => {
    await page.goto("/en/listings/new");
    // Every OTHER required field must be valid, or zod rejects the form first and
    // `save()` — where the pin check lives — never runs. That is what made the
    // first version of this test fail: it stopped at "Category is required".
    await page.getByLabel("Title", { exact: true }).fill("Pin-less test listing");
    await page.getByLabel("Price", { exact: true }).fill("500");
    await page.getByLabel("Category", { exact: true }).selectOption({ index: 1 });

    // Type the location, never select a suggestion, never touch the map — the
    // exact path that produced pin-less listings.
    await page.locator("#location").fill("Kandahar");

    let created = false;
    await page.route("**/api/v1/my/listings", async (route) => {
      created = true;
      await route.abort();
    });

    await page.getByRole("button", { name: /Publish/i }).click();

    // The refusal is explicit and points at the field…
    await expect(page.getByText(/Pick the spot on the map/i)).toBeVisible();
    // …and nothing was sent.
    expect(created).toBe(false);
    // Still on the form, not navigated away.
    await expect(page).toHaveURL(/\/listings\/new/);
  });
});
