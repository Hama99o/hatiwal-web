import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import { withSessionUser, shopEntry } from "./session-user";

/*
 * Every unread count on screen is the CURRENT identity's (+ its Support); other
 * identities show only as a DOT on the "Selling as" pill (owner rule,
 * 2026-10-07: the device check saw the pill say 6 next to "Selling as Me" while
 * the inbox said 5). The sheet still names each identity's own count.
 */
test.describe("Selling as: other identities are a dot", () => {
  test.use({ storageState: BUYER_STATE });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("hatiwal.sell-as-asked-1", "1"));
  });

  test("selling as Me with unread in a shop: a dot, no number; the sheet names it", async ({ page }) => {
    await withSessionUser(page, {
      sellerMode: true,
      shops: [shopEntry(42, "Safi Cosmetics")],
      sellingAsShop: null,
      unreadCounts: { buying: 1, sellingMe: 2, support: 3, shops: { "42": 6 } },
    });
    await page.goto("/en/my-listings");
    const pill = page.getByTestId("selling-as-pill");
    await expect(pill).toBeVisible({ timeout: 60_000 });
    await expect(pill.getByTestId("selling-as-other-unread")).toBeVisible();
    await expect(pill).not.toContainText("6");
    await pill.click();
    await expect(page.getByTestId("sell-as-sheet")).toContainText("6");
  });

  test("nothing unread elsewhere: no dot", async ({ page }) => {
    await withSessionUser(page, {
      sellerMode: true,
      shops: [shopEntry(42, "Safi Cosmetics")],
      sellingAsShop: null,
      unreadCounts: { buying: 1, sellingMe: 2, support: 3, shops: { "42": 0 } },
    });
    await page.goto("/en/my-listings");
    await expect(page.getByTestId("selling-as-pill")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("selling-as-other-unread")).toHaveCount(0);
  });
});
