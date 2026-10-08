import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import { shopEntry, withSessionUser } from "./session-user";

// Edge pass 1.1.6 (d0): every member manages a shop's products (docs/SHOPS.md;
// the API's Listing#manageable_by? = any member). The web compared the viewer
// with the OWNER's id, so a manager or staff member saw a shop product as a
// buyer (no owner bar, a "Message shop" button) and had no seller tools in its
// chats. Mock: listing 9042 belongs to shop 42 (owner = user 2); the signed-in
// mock user is 1, made a STAFF member of shop 42 here.
test.describe("A shop's staff manage its listing", () => {
  test.use({ storageState: BUYER_STATE });

  test("staff of the shop: the owner bar, no 'Message shop'", async ({ page }) => {
    await withSessionUser(page, { sellerMode: true, shops: [shopEntry(42, "Safi Cosmetics", "active", "staff")] });
    await page.goto("/en/listings/9042");
    await expect(page.getByTestId("owner-listing-bar")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole("button", { name: /Message shop/i })).toHaveCount(0);
  });

  test("not a member: the buyer view (no owner bar)", async ({ page }) => {
    await withSessionUser(page, { shops: [] });
    await page.goto("/en/listings/9042");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("owner-listing-bar")).toHaveCount(0);
  });
});

// Review of b01ea19 (dd, 2026-10-08): the shop context belongs to THIS listing
// only. A member is not the owner of the shop owner's OTHER listings in the
// cross-sell rails (the owner's personal ones share the owner's id): they keep
// their buyer controls there (the save heart).
test.describe("A shop member on the cross-sell rails", () => {
  test.use({ storageState: BUYER_STATE });

  test("staff of shop 42 can still save the owner's personal listing in 'More from this seller'", async ({ page }) => {
    await withSessionUser(page, { sellerMode: true, shops: [shopEntry(42, "Safi Cosmetics", "active", "staff")] });
    await page.goto("/en/listings/9042");
    await expect(page.getByTestId("owner-listing-bar")).toBeVisible({ timeout: 45_000 });
    const ownersPersonalCard = page.locator("a[href='/en/listings/2']").first();
    await ownersPersonalCard.scrollIntoViewIfNeeded();
    await expect(ownersPersonalCard).toBeVisible({ timeout: 20_000 });
    await expect(ownersPersonalCard.getByRole("button")).toHaveCount(1);
  });
});
