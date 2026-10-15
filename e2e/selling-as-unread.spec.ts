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

// Web UI/UX QA #26: as ONE string, "Me · <Latin name>" in an RTL row lost the
// START of the name to the ellipsis ("…air Shopkeeper · خودم"). The name is now
// its own isolate in its own direction, so it is cut at its END.
test.describe("Sell as: Latin names truncate at their end in RTL", () => {
  test.use({ storageState: BUYER_STATE, viewport: { width: 390, height: 844 } });

  test("fa: a long Latin shop name keeps its first letters; the label never truncates", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("hatiwal.sell-as-asked-1", "1"));
    const long = "Kabul Qandahar Wholesale Cosmetics And Perfume Corner";
    await withSessionUser(page, {
      sellerMode: true,
      shops: [shopEntry(42, long)],
      sellingAsShop: null,
      unreadCounts: { buying: 0, sellingMe: 0, support: 0, shops: { "42": 0 } },
    });
    await page.goto("/fa/my-listings");
    await page.getByTestId("selling-as-pill").click({ timeout: 60_000 });

    const shopName = page.getByTestId("sell-as-option-shop-42").locator("bdi");
    await expect(shopName).toHaveAttribute("dir", "ltr");
    const m = await shopName.evaluate((el) => ({
      truncated: el.scrollWidth > el.clientWidth,
      direction: getComputedStyle(el).direction,
      overflow: getComputedStyle(el).textOverflow,
    }));
    expect(m).toEqual({ truncated: true, direction: "ltr", overflow: "ellipsis" });

    // The personal row: "خودم · " is its own, never-truncated part.
    const me = page.getByTestId("sell-as-option-me");
    const label = me.locator("bdi").locator("xpath=preceding-sibling::span[1]");
    await expect(label).toContainText("·");
    expect(await label.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  });
});
