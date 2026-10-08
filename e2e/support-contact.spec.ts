import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import { shopEntry, withSessionUser } from "./session-user";

/*
 * Owner, 2026-10-08: Profile → Help & support → "Contact support" (both modes, like mobile)
 * opens THIS identity's Support thread directly — the person's own, or the
 * shop's when selling as a shop — even when it was archived (the API's
 * POST /support_conversation revives it). A failure is a toast with Retry,
 * never a dead click.
 */

async function stubOpenSupport(page: Page, status = 200) {
  const calls: string[] = [];
  await page.route(/\/api\/me\/support_conversation(\?.*)?$/, (route) => {
    calls.push(route.request().url());
    return status === 200
      ? route.fulfill({ json: { conversation: { id: 1, kind: "support" } } })
      : route.fulfill({ status, json: { error: "boom" } });
  });
  return calls;
}

test.describe("Profile → Contact support", () => {
  test.use({ storageState: BUYER_STATE });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("opens the person's own Support thread", async ({ page }) => {
    const calls = await stubOpenSupport(page);
    await page.goto("/en/profile/help");

    const row = page.getByTestId("profile-row-contact-support");
    await expect(row).toHaveText(/Contact support/);
    await row.click();

    await expect(page).toHaveURL(/\/en\/conversations\/1$/);
    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toContain("shop_id");
  });

  test("selling as a shop, it opens THAT SHOP's thread", async ({ page }) => {
    await withSessionUser(page, {
      sellerMode: true,
      shops: [shopEntry(42, "Safi Cosmetics")],
      sellingAsShop: shopEntry(42, "Safi Cosmetics"),
    });
    const calls = await stubOpenSupport(page);
    await page.goto("/en/profile/help");

    await page.getByTestId("profile-row-contact-support").click();

    await expect(page).toHaveURL(/\/en\/conversations\/1$/);
    expect(calls[0]).toContain("shop_id=42");
  });

  test("a failure says so and stays on Profile", async ({ page }) => {
    await stubOpenSupport(page, 500);
    await page.goto("/en/profile/help");

    await page.getByTestId("profile-row-contact-support").click();

    await expect(page.getByText("Couldn't open Support. Please try again.")).toBeVisible();
    await expect(page).toHaveURL(/\/en\/profile\/help$/);
  });

  test("in Pashto the row reads in Pashto", async ({ page }) => {
    await page.goto("/ps/profile/help");
    await expect(page.getByTestId("profile-row-contact-support")).toHaveText(/له ملاتړ سره اړیکه/);
  });
});
