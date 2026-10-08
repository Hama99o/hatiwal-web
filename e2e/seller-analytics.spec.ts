import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import { withSessionUser, shopEntry } from "./session-user";
import ps from "../messages/ps.json";

/*
 * Seller numbers per identity — Me or one shop, never global (owner,
 * 2026-10-12, item 2; hatiwal-mobile docs/design/SELLER_ANALYTICS.md).
 * Mock numbers (e2e/mock-api): Me = 3 active · 2 sold · 1 expired · 9 total ·
 * 1204 views · 37 chats; shop 42 = 5 active · 2 sold · 0 expired.
 */

test.describe("Seller numbers", () => {
  test.use({ storageState: BUYER_STATE });

  // Profile hub (owner, 2026-10-08): the numbers card is on the Activity page.
  test("Activity (Seller mode): the card says whose numbers they are, and opens the page", async ({ page }) => {
    await page.goto("/en/profile/activity");
    const card = page.getByTestId("profile-seller-numbers");
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("profile-seller-numbers-title")).toHaveText("Numbers · Me");
    await expect(page.getByTestId("profile-seller-numbers-active")).toContainText("3");
    await card.click();
    await expect(page).toHaveURL(/\/analytics\?shop=me$/);
    await expect(page.getByTestId("analytics-identity")).toContainText("Your personal listings");
    await expect(page.getByTestId("analytics-value-active")).toHaveText("3");
    await expect(page.getByTestId("analytics-value-sold")).toHaveText("2");
    await expect(page.getByTestId("analytics-value-expired")).toHaveText("1");
    await expect(page.getByTestId("analytics-value-all")).toHaveText("9");
    await expect(page.getByTestId("analytics-views")).toContainText("1,204");
    await expect(page.getByTestId("analytics-chats")).toContainText("37");
  });

  test("Relaunch all: a confirm, then every expired listing of this identity", async ({ page }) => {
    let sent: unknown = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/my\/listings\/relaunch_expired$/.test(req.url())) sent = req.postDataJSON();
    });
    await page.goto("/en/analytics?shop=me");
    await page.getByTestId("analytics-relaunch-all").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Relaunch 1 expired listing?")).toBeVisible();
    await dialog.getByRole("button", { name: "Relaunch all" }).click();
    await expect(page.getByText("1 listing is live again").first()).toBeVisible();
    expect(sent).toEqual({ shop_id: null });
  });

  test("a tile opens its My listings tab", async ({ page }) => {
    await page.goto("/en/analytics?shop=me");
    await page.getByTestId("analytics-tile-expired").getByRole("button").first().click();
    await expect(page).toHaveURL(/\/my-listings\?status=expired$/);
    await expect(page.getByRole("tab", { name: /^Expired/ })).toHaveAttribute("aria-selected", "true", { timeout: 30_000 });
  });

  test("a shop: its own numbers, its name, for a staff member too; the shop page links there", async ({ page }) => {
    await withSessionUser(page, { sellerMode: true, shops: [shopEntry(42, "Safi Cosmetics", "active", "staff")] });
    await page.addInitScript(() => window.localStorage.setItem("hatiwal.sell-as-asked-1", "1"));
    await page.goto("/en/shops/42");
    await page.getByTestId("shop-page-analytics").click();
    await expect(page).toHaveURL(/\/analytics\?shop=42$/);
    await expect(page.getByTestId("analytics-identity")).toContainText("Safi Cosmetics");
    await expect(page.getByTestId("analytics-identity")).toContainText("This shop's listings");
    await expect(page.getByTestId("analytics-value-active")).toHaveText("5");
    // Nothing expired: no Relaunch all.
    await expect(page.getByTestId("analytics-relaunch-all")).toHaveCount(0);
  });

  test("RTL: Pashto labels and digits", async ({ page }) => {
    await page.goto("/ps/analytics?shop=me");
    await expect(page.getByRole("heading", { name: ps.seller.analytics.title })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("analytics-value-all")).toHaveText("۹");
  });
});
