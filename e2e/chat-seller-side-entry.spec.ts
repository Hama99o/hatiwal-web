import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import { shopEntry, withSessionUser } from "./session-user";

/**
 * Owner, 2026-10-06 (mobile 6736017 + 1c4c5af): a thread opened on the SELLER
 * side (e.g. from a direct link) puts the viewer in Seller mode, selling as the
 * chat's shop (or Me), and shows "Replying as …". The buyer never sees the chip.
 * The viewer is the buyer persona (id 1); conversation 1 is re-shaped per test.
 */
test.use({ storageState: BUYER_STATE });

const SHOP_42 = { id: 42, name: "Safi Cosmetics", logo_url: null, verified: false, province: "Kabul", city: "Kabul", status: "active" };
const SHOP_44 = { ...SHOP_42, id: 44, name: "Safi Phones" };

async function thread(page: Page, side: "seller" | "buyer", shop: typeof SHOP_42 | null) {
  await page.route("**/api/me/conversations/1", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    const json = await res.json();
    const me = { id: 1, name: "Ahmad Karimi", avatar_url: null };
    const other = { id: 3, name: "Mariam Hashimi", avatar_url: null };
    json.conversation = {
      ...json.conversation,
      viewer_role: side,
      seller: side === "seller" ? me : other,
      buyer: side === "seller" ? other : me,
      shop,
    };
    await route.fulfill({ response: res, json });
  });
}

/** Records the mode / identity calls; answers them like the API. */
async function recordSwitches(page: Page) {
  const calls: { mode: unknown[]; sellAs: unknown[] } = { mode: [], sellAs: [] };
  await page.route("**/api/me/users/me", async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    calls.mode.push(route.request().postDataJSON());
    await route.continue();
  });
  await page.route("**/api/me/users/me/selling_as", async (route) => {
    calls.sellAs.push(route.request().postDataJSON());
    await route.fulfill({ json: { user: {} } });
  });
  return calls;
}

test("Buyer mode + a link to the current shop's chat → Seller mode, same shop, Replying as the shop", async ({ page }) => {
  await withSessionUser(page, { sellerMode: false, shops: [shopEntry(42, "Safi Cosmetics")], sellingAsShop: { ...SHOP_42, logoUrl: null } });
  await thread(page, "seller", SHOP_42);
  const calls = await recordSwitches(page);
  await page.goto("/en/conversations/1");
  await expect(page.getByTestId("chat-replying-as")).toHaveText("Replying as Safi Cosmetics");
  await expect.poll(() => calls.mode.length).toBe(1);
  expect(calls.mode[0]).toEqual({ user: { seller_mode: true } });
  expect(calls.sellAs).toHaveLength(0);
});

test("a chat of ANOTHER of their shops → switches to it, with the toast", async ({ page }) => {
  await withSessionUser(page, { sellerMode: true, shops: [shopEntry(42, "Safi Cosmetics"), shopEntry(44, "Safi Phones")], sellingAsShop: { ...SHOP_42, logoUrl: null } });
  await thread(page, "seller", SHOP_44);
  const calls = await recordSwitches(page);
  await page.goto("/en/conversations/1");
  await expect(page.getByTestId("chat-replying-as")).toHaveText("Replying as Safi Phones");
  await expect.poll(() => calls.sellAs.length).toBe(1);
  expect(calls.sellAs[0]).toEqual({ shop_id: 44 });
  await expect(page.getByText("Now selling as Safi Phones")).toBeVisible();
  expect(calls.mode).toHaveLength(0);
});

test("a personal selling chat → Replying as Me (switches back to Me)", async ({ page }) => {
  await withSessionUser(page, { sellerMode: true, shops: [shopEntry(42, "Safi Cosmetics")], sellingAsShop: { ...SHOP_42, logoUrl: null } });
  await thread(page, "seller", null);
  const calls = await recordSwitches(page);
  await page.goto("/en/conversations/1");
  await expect(page.getByTestId("chat-replying-as")).toHaveText("Replying as Me");
  await expect.poll(() => calls.sellAs.length).toBe(1);
  expect(calls.sellAs[0]).toEqual({ shop_id: null });
});

test("the buyer sees no chip and nothing switches", async ({ page }) => {
  await withSessionUser(page, { sellerMode: false, shops: [shopEntry(42, "Safi Cosmetics")] });
  await thread(page, "buyer", SHOP_42);
  const calls = await recordSwitches(page);
  await page.goto("/en/conversations/1");
  await expect(page.getByTestId("message-meta").first()).toBeVisible();
  await expect(page.getByTestId("chat-replying-as")).toHaveCount(0);
  expect(calls.mode).toHaveLength(0);
  expect(calls.sellAs).toHaveLength(0);
});

test("a shop they're no longer on → the toast, no switch", async ({ page }) => {
  await withSessionUser(page, { sellerMode: false, shops: [] });
  await thread(page, "seller", SHOP_44);
  const calls = await recordSwitches(page);
  await page.goto("/en/conversations/1");
  await expect(page.getByText("You're no longer on this shop's team")).toBeVisible();
  expect(calls.mode).toHaveLength(0);
  expect(calls.sellAs).toHaveLength(0);
});

test("ps: the chip reads in Pashto", async ({ page }) => {
  await withSessionUser(page, { sellerMode: true, shops: [shopEntry(42, "Safi Cosmetics")], sellingAsShop: { ...SHOP_42, logoUrl: null } });
  await thread(page, "seller", SHOP_42);
  await recordSwitches(page);
  await page.goto("/ps/conversations/1");
  await expect(page.getByTestId("chat-replying-as")).toHaveText("ځواب د Safi Cosmetics په توګه");
});
