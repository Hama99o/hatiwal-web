import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import ps from "../messages/ps.json";

/*
 * Listing expiry never hurts the seller (owner, 2026-10-12;
 * hatiwal-mobile docs/OWNER_ITEMS_2026-10-12.md, item 1):
 *
 *   - 90 days; Renew is ONE tap (+90 days, nothing re-posted) — no confirm.
 *   - Expired is not deleted: "Relaunch" (= renew) and "Edit & relaunch" (the
 *     edit form, which relaunches on save: back to the top at most once a week).
 *   - Buyers never see an expiry date; only the seller does.
 *
 * Fixtures (e2e/mock-api): listing 10 = seller 1's expired listing, 11 = seller
 * 1's listing 3 days from its end, 1 = seller 1's ordinary active listing. The
 * BUYER_STATE session is user 1, i.e. their owner.
 */

test.describe("Listing expiry — the seller", () => {
  test.use({ storageState: BUYER_STATE });

  test("an expired listing offers Relaunch and Edit & relaunch on its page", async ({ page }) => {
    await page.goto("/en/listings/10");
    const panel = page.getByTestId("owner-listing-bar");
    await expect(panel.getByText("Expired")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Relaunch" })).toBeVisible();
    await expect(panel.getByTestId("edit-relaunch")).toHaveAttribute(
      "href",
      "/en/listings/10/edit?relaunch=1",
    );
  });

  test("the seller still sees the countdown on their own page (the public payload has no date)", async ({
    page,
  }) => {
    // The RSC payload is anonymous, so it carries `expiresAt: null`; the panel
    // reads the owner's own copy to show "Expires in 3 days".
    await page.goto("/en/listings/11");
    const panel = page.getByTestId("owner-listing-bar");
    await expect(panel.getByText(/Expires in/i)).toBeVisible({ timeout: 20_000 });
  });

  test("My listings → Expired: Relaunch, and Edit & relaunch in the menu", async ({ page }) => {
    await page.goto("/en/my-listings");
    const card = page.locator('a[href="/en/my-listings/10"]').locator("..");
    await expect(card.getByRole("button", { name: /Relaunch/ })).toBeVisible({ timeout: 60_000 });
    await card.getByRole("button", { name: /More options/ }).click();
    await expect(page.getByTestId("edit-relaunch")).toHaveAttribute(
      "href",
      "/en/listings/10/edit?relaunch=1",
    );
  });

  test("Relaunch is one tap: renewed, no confirm dialog", async ({ page }) => {
    await page.goto("/en/my-listings/10");
    await page.getByRole("button", { name: "Relaunch" }).click();
    await expect(page.getByText(/renewed/i).first()).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("Edit & relaunch: saving relaunches it and says it is back at the top", async ({ page }) => {
    let relaunched = false;
    page.on("request", (req) => {
      if (req.method() === "PUT" && /\/my\/listings\/1\/relaunch$/.test(req.url())) relaunched = true;
    });
    await page.goto("/en/listings/1/edit?relaunch=1");
    await page.getByLabel("Title", { exact: true }).fill("iPhone 13 Pro Max");
    await page.getByRole("button", { name: "Save & relaunch" }).click();
    await expect(page.getByText(/back at the top/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/my-listings\/1\/?$/);
    expect(relaunched).toBe(true);
  });

  test("a plain edit never relaunches", async ({ page }) => {
    let relaunched = false;
    page.on("request", (req) => {
      if (/\/relaunch$/.test(req.url())) relaunched = true;
    });
    await page.goto("/en/listings/1/edit");
    await expect(page.getByRole("button", { name: "Save & relaunch" })).toHaveCount(0);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page).toHaveURL(/\/my-listings\/1\/?$/, { timeout: 20_000 });
    expect(relaunched).toBe(false);
  });

  test("RTL: Pashto labels", async ({ page }) => {
    await page.goto("/ps/listings/10");
    const panel = page.getByTestId("owner-listing-bar");
    await expect(panel.getByRole("button", { name: ps.listing.relaunch })).toBeVisible();
    await expect(panel.getByText(ps.listing.editRelaunch)).toBeVisible();
  });
});

test.describe("Listing expiry — buyers never see a date", () => {
  test("a guest sees no expiry on a listing near its end", async ({ page }) => {
    await page.goto("/en/listings/11");
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.getByText(/Expires|Expired/i)).toHaveCount(0);
    await expect(page.getByTestId("owner-listing-bar")).toHaveCount(0);
  });
});
