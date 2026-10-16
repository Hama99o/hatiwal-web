import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import { withSessionUser, shopEntry } from "./session-user";
import { shopWarnings } from "../src/lib/api/shops";

/**
 * Prohibited-item warnings (1.1.7, api docs/WARNINGS_API.md). The user's own
 * strikes come from GET /me/users/warnings (unchanged shape); a shop's from the
 * members-only owner view of GET /shops/:id (active_warnings_count,
 * warnings_threshold, latest_warning). Fixtures below are that exact JSON.
 */

// GET /me/users/warnings — the real Rails shape (snake_case, meta block).
const USER_WARNINGS = {
  warnings: [
    {
      id: 11,
      category: "prohibited_item",
      reason: "Weapons are not allowed",
      created_at: "2026-10-15T09:00:00Z",
      expires_at: "2027-01-13T09:00:00Z",
      acknowledged_at: null,
      active: true,
    },
  ],
  meta: { active_count: 1, threshold: 3 },
};

// The members-only keys dd added to ShopSerializer :owner.
const SHOP_WARNING_KEYS = {
  active_warnings_count: 2,
  warnings_threshold: 3,
  latest_warning: {
    category: "prohibited_item",
    reason: "Weapons are not allowed",
    created_at: "2026-10-16T08:00:00Z",
    listing_title: "Old pistol",
  },
};

/** Serve the signed-in member's GET /shops/42 as the owner view: the real public payload + role/status (+ keys). */
async function serveOwnerView(page: Page, keys: Record<string, unknown> | null) {
  await page.route(/\/api\/me\/shops\/42$/, async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    json.shop = { ...json.shop, role: "owner", status: "active", phone_public: true, ...(keys ?? {}) };
    await route.fulfill({ response: res, json });
  });
}

test.describe("Warnings — the pure gate", () => {
  test("a shop card only for a member, with keys, above 0", () => {
    expect(shopWarnings({ role: "owner", activeWarningsCount: 1, warningsThreshold: 3, latestWarning: null })).toEqual({
      activeCount: 1,
      threshold: 3,
      warnings: [],
    });
    // A buyer never: no role, whatever the payload carries.
    expect(shopWarnings({ role: null, activeWarningsCount: 2, warningsThreshold: 3, latestWarning: null })).toBeNull();
    // An older API (keys absent), or no strikes.
    expect(shopWarnings({ role: "owner" })).toBeNull();
    expect(shopWarnings({ role: "manager", activeWarningsCount: 0, warningsThreshold: 3, latestWarning: null })).toBeNull();
    expect(shopWarnings(undefined)).toBeNull();
  });
});

test.describe("Warnings — the account card on the profile", () => {
  test.use({ storageState: BUYER_STATE });

  test("N of 3, what was removed, the rule, and the link to what is not allowed", async ({ page }) => {
    await page.route(/\/api\/me\/users\/warnings$/, (route) => route.fulfill({ json: USER_WARNINGS }));
    await page.goto("/en/profile");
    const card = page.getByTestId("warnings-card-account");
    await expect(card.getByTestId("warnings-card-title")).toHaveText("You have 1 of 3 warnings");
    await expect(card).toContainText("A listing was removed for a prohibited item.");
    await expect(card).toContainText("Weapons are not allowed");
    await expect(card.getByTestId("warnings-card-rule")).toHaveText(
      "At 3 warnings your account is suspended and all your listings are hidden. If you own a shop, it is hidden too until your account is restored.",
    );
    await expect(card.getByTestId("warnings-card-rules")).toHaveAttribute("href", "/en/prohibited-items");
  });

  test("Dari: right to left, in Dari digits", async ({ page }) => {
    await page.route(/\/api\/me\/users\/warnings$/, (route) => route.fulfill({ json: USER_WARNINGS }));
    await page.goto("/fa/profile");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const title = page.getByTestId("warnings-card-account").getByTestId("warnings-card-title");
    await expect(title).toHaveText("شما ۱ از ۳ هشدار دارید");
    await expect(page.getByTestId("warnings-card-rules")).toHaveAttribute("href", "/fa/prohibited-items");
  });

  test("no strikes, no card (the default mock answers 0)", async ({ page }) => {
    const answered = page.waitForResponse(/\/api\/me\/users\/warnings$/);
    await page.goto("/en/profile");
    await answered;
    await expect(page.getByTestId("profile-hub")).toBeVisible();
    await expect(page.getByTestId("warnings-card-account")).toHaveCount(0);
  });
});

test.describe("Warnings — the shop card (members only)", () => {
  test.use({ storageState: BUYER_STATE });

  test("a member sees the shop's count, the listing taken down, and the shop rule", async ({ page }) => {
    await withSessionUser(page, { sellerMode: true, shops: [shopEntry(42, "Safi Cosmetics")] });
    await serveOwnerView(page, SHOP_WARNING_KEYS);
    await page.goto("/en/shops/42");
    const card = page.getByTestId("warnings-card-shop");
    await expect(card.getByTestId("warnings-card-title")).toHaveText("This shop has 2 of 3 warnings");
    await expect(card).toContainText("“Old pistol” was removed for a prohibited item.");
    await expect(card.getByTestId("warnings-card-rule")).toHaveText(
      "At 3 warnings the shop is suspended and all its listings are hidden.",
    );
    await expect(card.getByTestId("warnings-card-rules")).toHaveAttribute("href", "/en/prohibited-items");
  });

  test("an older API (owner view without the keys): no card", async ({ page }) => {
    await withSessionUser(page, { sellerMode: true, shops: [shopEntry(42, "Safi Cosmetics")] });
    await serveOwnerView(page, null);
    const answered = page.waitForResponse(/\/api\/me\/shops\/42$/);
    await page.goto("/en/shops/42");
    await answered;
    await expect(page.getByTestId("shop-page-team")).toBeVisible();
    await expect(page.getByTestId("warnings-card-shop")).toHaveCount(0);
  });

  test("a buyer never sees it, and the page never asks for the members' view", async ({ page }) => {
    let asked = false;
    await page.route(/\/api\/me\/shops\/42$/, (route) => {
      asked = true;
      return route.fulfill({ json: { shop: { role: "owner", ...SHOP_WARNING_KEYS } } });
    });
    await page.goto("/en/shops/42");
    await expect(page.getByTestId("shop-message")).toBeVisible();
    await expect(page.getByTestId("warnings-card-shop")).toHaveCount(0);
    expect(asked).toBe(false);
  });
});
