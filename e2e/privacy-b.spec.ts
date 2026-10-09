import { test, expect, type Page, type Request } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import { shopEntry, withSessionUser } from "./session-user";
import en from "../messages/en.json";

/**
 * privacy-b (api c178ae9): a SHOP's face never carries its owner's personal id.
 *
 * For a new client — the web sends `X-App-Platform: web` on every Rails request —
 * anyone outside the shop's team gets `seller` / `other_participant` as
 * `{ id: null, shop_id, as_shop: true }`. The web must then link the shop
 * (`/shops/42`, never `/sellers/null`), decide "is this mine" by shop
 * membership, and block / report the SHOP by its id.
 *
 * Mock: shop 42 "Safi Cosmetics" (owner Umair, user 2), its product 9042 and the
 * buyer persona's "Message shop" chat 420. The buyer persona (user 1) is not on
 * shop 42's team, so it gets the face; the mock honours the contract only when
 * the request carries `x-app-platform: web` (e2e/mock-api/server.mjs).
 */

const B = en.chat.block;
const RB = en.report.block;

/** Every request the browser sends to the given method + authed-proxy path. */
function track(page: Page, method: string, pathRe: RegExp): Request[] {
  const calls: Request[] = [];
  page.on("request", (req) => {
    if (req.method() === method && pathRe.test(new URL(req.url()).pathname)) calls.push(req);
  });
  return calls;
}

/** Wait until the session has hydrated (the header avatar carries the user's name). */
async function expectSignedIn(page: Page) {
  await expect(page.getByRole("button", { name: "Ahmad Karimi" })).toBeVisible({ timeout: 15_000 });
}

test.describe("privacy-b: a buyer meets the shop, never its owner", () => {
  test.use({ storageState: BUYER_STATE });

  test("the API answers the web with the shop's face (the header reaches Rails)", async ({ page }) => {
    // Observe the proxied payload: the mock only hides the owner when the
    // server-side fetch carried X-App-Platform: web.
    const seen: Array<Record<string, unknown>> = [];
    await page.route("**/api/me/conversations/420", async (route) => {
      const res = await route.fetch();
      const json = await res.json();
      seen.push(json.conversation.other_participant);
      await route.fulfill({ response: res, json });
    });
    await page.goto("/en/conversations/420");
    await expect(page.getByTestId("chat-shop-identity")).toContainText("Safi Cosmetics");
    await expect.poll(() => seen.length).toBeGreaterThan(0);
    expect(seen[0]).toMatchObject({ id: null, shop_id: 42, as_shop: true });
  });

  test("a shop listing links the shop, never /sellers/, and shows no owner-only panel", async ({ page }) => {
    await page.goto("/en/listings/9042");
    await expectSignedIn(page);
    const shopLink = page.getByTestId("listing-shop-link").getByRole("link").first();
    await expect(shopLink).toHaveAttribute("href", "/en/shops/42");
    await expect(page.locator('a[href*="/sellers/"]')).toHaveCount(0);
    await expect(page.locator('a[href*="null"]')).toHaveCount(0);
    // The buyer keeps every buyer CTA, and gets none of the owner's.
    await expect(page.getByTestId("listing-message-shop").first()).toBeVisible();
    await expect(page.getByTestId("owner-listing-bar")).toHaveCount(0);
  });

  test("a member of the shop gets the owner's panel instead of 'Message shop'", async ({ page }) => {
    // Membership, not the (null) seller id, decides ownership of a shop listing.
    await withSessionUser(page, { shops: [shopEntry(42, "Safi Cosmetics", "active", "staff")] });
    await page.goto("/en/listings/9042");
    await expectSignedIn(page);
    await expect(page.getByTestId("owner-listing-bar")).toBeVisible();
    await expect(page.getByTestId("listing-message-shop")).toHaveCount(0);
  });

  test("blocking the shop from its chat calls POST /shops/42/block", async ({ page }) => {
    const shopBlocks = track(page, "POST", /^\/api\/me\/shops\/42\/block$/);
    const userBlocks = track(page, "POST", /^\/api\/me\/users\/[^/]+\/block$/);
    await page.goto("/en/conversations/420");
    await expect(page.getByTestId("chat-shop-identity")).toContainText("Safi Cosmetics");
    // No person profile behind a shop face.
    await expect(page.locator('a[href*="/sellers/"]')).toHaveCount(0);

    const toggle = page.getByTestId("chat-block-toggle");
    await expect(toggle).toHaveAttribute("aria-label", B.blockShop);
    await expect(async () => {
      await toggle.click();
      await expect(page.getByRole("heading", { name: B.blockShopConfirmTitle })).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15_000 });
    await page.getByRole("button", { name: B.blockShop, exact: true }).last().click();

    await expect(page.getByText(B.shopBlockSuccess)).toBeVisible();
    await expect.poll(() => shopBlocks.length).toBe(1);
    expect(userBlocks).toHaveLength(0);
  });

  test("reporting from a shop chat sends reportable_type Shop with the shop id", async ({ page }) => {
    const reports = track(page, "POST", /^\/api\/me\/reports$/);
    await page.goto("/en/conversations/420");
    await expect(page.getByTestId("chat-shop-identity")).toContainText("Safi Cosmetics");

    const trigger = page.getByRole("button", { name: en.report.title, exact: true }).first();
    await expect(async () => {
      await trigger.click();
      await expect(page.getByText(en.report.reasonLabel)).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15_000 });
    await page.getByRole("button", { name: en.report.reasons.spam }).click();
    await page.getByRole("button", { name: en.report.submit }).click();
    await expect(page.getByText(en.report.success)).toBeVisible();

    await expect.poll(() => reports.length).toBe(1);
    const body = reports[0].postDataJSON() as { report: Record<string, unknown> };
    expect(body.report).toMatchObject({ reportable_type: "Shop", reportable_id: 42 });

    // The follow-up offers to block the SHOP, by its id.
    const shopBlocks = track(page, "POST", /^\/api\/me\/shops\/42\/block$/);
    await expect(page.getByRole("heading", { name: RB.titleShop })).toBeVisible();
    await page.getByRole("button", { name: RB.confirmCta }).click();
    await expect(page.getByText(RB.successShop)).toBeVisible();
    await expect.poll(() => shopBlocks.length).toBe(1);
  });

  test("the blocked-users page shows a blocked shop and unblocks it by shop id", async ({ page }) => {
    // The shared mock is stateless (the suite runs fullyParallel against one
    // server), so the row a shop block produces is added here, in the exact
    // shape GET /blocks sends it.
    await page.route("**/api/me/blocks", async (route) => {
      const res = await route.fetch();
      const json = await res.json();
      json.users = [
        ...(json.users ?? []),
        { id: null, shop_id: 42, as_shop: true, name: "Safi Cosmetics", avatar_url: null, city: "Kabul", verified: true, blocked: true },
      ];
      await route.fulfill({ response: res, json });
    });
    const shopUnblocks = track(page, "DELETE", /^\/api\/me\/shops\/42\/block$/);
    const userUnblocks = track(page, "DELETE", /^\/api\/me\/users\/[^/]+\/block$/);

    await page.goto("/en/settings/blocked-users");
    const row = page.getByTestId("blocked-shop-row");
    await expect(row).toContainText("Safi Cosmetics");
    await expect(page.locator('a[href*="/sellers/null"]')).toHaveCount(0);
    // The person row is unchanged.
    await expect(page.getByTestId("blocked-user-row")).toContainText("Najib Rahimi");

    const unblock = row.getByRole("button", { name: B.unblockShop });
    await expect(async () => {
      await unblock.click();
      await expect(page.getByText(B.shopUnblockSuccess)).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 20_000 });
    expect(shopUnblocks.length).toBeGreaterThanOrEqual(1);
    expect(userUnblocks).toHaveLength(0);
  });
});
