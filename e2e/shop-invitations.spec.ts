import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import { shopEntry, withSessionUser } from "./session-user";

/**
 * "Invitations to join a shop" (owner, 1.1.6; api GET /my/shop_invites +
 * me.pending_shop_invites_count). One data source, shown on Profile (both
 * modes), in the Selling-as menu, and, for someone with no shop, in a small
 * dialog the Seller-mode toggle opens. The mock serves one invite (id 501,
 * token qa-team-mine, Safi Cosmetics); the count comes from the session.
 */
test.use({ storageState: BUYER_STATE });

const invited = (page: Page, patch: Record<string, unknown> = {}) =>
  withSessionUser(page, { pendingShopInvitesCount: 1, ...patch });

test("Profile lists the invitation; Accept joins the shop with a toast", async ({ page }) => {
  await invited(page, { sellerMode: true, shops: [] });
  await page.goto("/en/profile");
  const card = page.getByTestId("shop-invitation-501");
  await expect(page.getByTestId("shop-invitations")).toBeVisible();
  await expect(card).toContainText("Umair Safi invites you to join Safi Cosmetics as Staff");
  await page.getByTestId("shop-invitation-accept-501").click();
  await expect(page.getByText("You joined Safi Cosmetics")).toBeVisible();
  // The fresh `me` has the shop, and no invitation left.
  await expect(page.getByTestId("shop-invitations")).toHaveCount(0);
  await expect(page.getByTestId("profile-shops")).toBeVisible();
  // Accepting answered "who do you sell as?": no ask-once dialog later (mobile 18bfbbd).
  expect(await page.evaluate(() => window.localStorage.getItem("hatiwal.sell-as-asked-1"))).toBe("1");
});

test("Decline asks first, then the invitation goes", async ({ page }) => {
  await invited(page);
  let declined = false;
  await page.route("**/api/me/shop_invites/qa-team-mine/decline", async (route) => {
    declined = true;
    await route.fulfill({ status: 204, body: "" });
  });
  // After declining, the list is empty (the mock is stateless).
  await page.goto("/en/profile");
  await page.getByTestId("shop-invitation-decline-501").click();
  await expect(page.getByRole("dialog")).toContainText("Decline the invitation to Safi Cosmetics?");
  expect(declined).toBe(false); // nothing sent before the confirm
  await page.route("**/api/me/my/shop_invites", (route) => route.fulfill({ json: { shopInvites: [], shop_invites: [], meta: {} } }));
  await page.getByRole("dialog").getByRole("button", { name: "Decline" }).click();
  await expect(page.getByText("Invitation declined")).toBeVisible();
  expect(declined).toBe(true);
  // Decline re-reads the session in the background; don't let it outlive the test.
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("the Selling-as menu lists the invitation; Accept adds the shop as an identity", async ({ page }) => {
  await invited(page, { sellerMode: true, shops: [shopEntry(77, "Safi Phones")] });
  // The ask-once Sell-as dialog has been answered already (it would cover the pill).
  await page.addInitScript(() => window.localStorage.setItem("hatiwal.sell-as-asked-1", "1"));
  await page.goto("/en/my-listings");
  await page.getByTestId("selling-as-pill").click();
  const sheet = page.getByTestId("sell-as-sheet");
  await expect(sheet.getByTestId("sell-as-invitations")).toBeVisible();
  await expect(sheet.getByTestId("shop-invitation-501")).toContainText("Safi Cosmetics");
  await sheet.getByTestId("shop-invitation-accept-501").click();
  await expect(sheet.getByTestId("sell-as-option-shop-42")).toBeVisible();
  await expect(sheet.getByTestId("sell-as-invitations")).toHaveCount(0);
});

test("no shop yet: the toggle has the dot and opens the invitations first", async ({ page }) => {
  await invited(page, { sellerMode: false, shops: [] });
  await page.goto("/en/profile");
  await expect(page.getByTestId("mode-toggle-invites-dot")).toBeVisible();
  await expect(page.getByTestId("profile-invites-dot")).toBeVisible();
  await page.getByRole("tab", { name: "Seller Mode" }).click();
  const dialog = page.getByTestId("invitations-sheet");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("shop-invitation-501")).toBeVisible();
  await dialog.getByTestId("invitations-continue-seller").click();
  await expect(page).toHaveURL(/\/my-listings/);
});

test("no invitation: nothing shows anywhere", async ({ page }) => {
  await withSessionUser(page, { pendingShopInvitesCount: 0, sellerMode: false, shops: [] });
  let listed = false;
  await page.route("**/api/me/my/shop_invites", async (route) => {
    listed = true;
    await route.continue();
  });
  await page.goto("/en/profile");
  await expect(page.getByRole("tab", { name: "Seller Mode" })).toBeVisible();
  await expect(page.getByTestId("shop-invitations")).toHaveCount(0);
  await expect(page.getByTestId("mode-toggle-invites-dot")).toHaveCount(0);
  await expect(page.getByTestId("profile-invites-dot")).toHaveCount(0);
  expect(listed).toBe(false); // the list is never even read
});

test("ps: the section reads right to left, in Pashto", async ({ page }) => {
  await invited(page);
  await page.goto("/ps/profile");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByTestId("shop-invitations")).toContainText("دوکان ته د یوځای کېدو بلنې");
  await expect(page.getByTestId("shop-invitation-501")).toContainText("Safi Cosmetics");
});
