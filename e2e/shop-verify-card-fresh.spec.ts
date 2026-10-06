import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import { shopEntry, withSessionUser } from "./session-user";

/**
 * d8: the shop's Verified card said "Post at least 1 product first" next to
 * "Products (1)". The API was right; the client served its cached status for
 * up to 60 s. The card now refetches on every mount.
 */
test.use({ storageState: BUYER_STATE });

test("after a product exists, revisiting the shop page drops the 'post a product' item", async ({ page }) => {
  await withSessionUser(page, { sellerMode: true, shops: [shopEntry(42, "Safi Cosmetics", "active", "owner")] });
  let products = 0;
  await page.route("**/api/me/verification_requests/current?subject=shop:42", (route) =>
    route.fulfill({ json: { verification_status: { status: "none", verified_since: null, missing: products ? [] : ["live_product"], reason: null, name_changed: false, request: null } } }),
  );
  await page.goto("/en/shops/42");
  await expect(page.getByTestId("shop-verify-missing-live_product")).toHaveText("Post at least 1 product first");

  // A product gets posted elsewhere; the owner comes back to the shop page
  // in the same session (client-side navigation, the query cache survives).
  products = 1;
  await page.getByTestId("shop-page-team").click();
  await page.waitForURL("**/shops/42/team");
  await page.goBack();
  await page.waitForURL("**/en/shops/42");
  await expect(page.getByTestId("shop-verify-card")).toBeVisible();
  await expect(page.getByTestId("shop-verify-missing-live_product")).toHaveCount(0);
  await expect(page.getByTestId("shop-verify-start")).toBeVisible();
});
