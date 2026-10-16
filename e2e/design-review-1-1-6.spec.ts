import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import { patchJsonRoute, shopEntry, withSessionUser } from "./session-user";

/**
 * d8's 1.1.6 design review (hatiwal-mobile docs, "Design review — 1.1.6"),
 * the items that exist on the web: one assertion each.
 */
test.use({ storageState: BUYER_STATE });

const LONG_SHOP = { id: 42, name: "Safi Cosmetics and Perfumes of Shahr-e Naw, Kabul", logo_url: null, verified: true, province: "Kabul", city: "Kabul", status: "active" };

async function buyerShopThread(page: Page) {
  await page.route("**/api/me/conversations/1", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    const json = await res.json();
    json.conversation = { ...json.conversation, viewer_role: "buyer", buyer: { id: 1, name: "Ahmad Karimi", avatar_url: null }, shop: LONG_SHOP };
    await route.fulfill({ response: res, json });
  });
}

test("P1: the buyer's shop-chat header — the name truncates, the Shop chip never wraps", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await buyerShopThread(page);
  await page.goto("/en/conversations/1");
  const identity = page.getByTestId("chat-shop-identity");
  const chip = identity.getByTestId("shop-chip");
  await expect(chip).toBeVisible();
  const c = (await chip.boundingBox())!;
  expect(c.height).toBeLessThan(24); // one line: never "S/ho/p"
  const name = (await identity.getByText(LONG_SHOP.name).boundingBox())!;
  expect(name.width).toBeGreaterThan(20); // truncated, never collapsed to 0
});

for (const [locale, one, eight] of [["ps", "۱", "۸"], ["fa", "۱", "۸"]] as const) {
  test(`#3 (${locale}): the step counter uses Persian digits`, async ({ page }) => {
    await page.goto(`/${locale}/profile/verify`);
    const label = page.getByTestId("verify-progress-label");
    await expect(label).toContainText(one);
    await expect(label).toContainText(eight);
    await expect(label).not.toContainText(/[0-9]/);
  });
}

test("#4: the buyer's Message-shop row names the shop once", async ({ page }) => {
  // The buyer's listing-less chat with shop 42, as the API lists it.
  const SHOP_CHAT = {
    id: 420, kind: "listing", status: "open", viewer_role: "buyer", last_message_at: "2026-10-05T12:00:00Z", created_at: "2026-10-05T12:00:00Z",
    listing: null, listing_deleted: true, shop_chat: true,
    shop: { id: 42, name: "Safi Cosmetics", logo_url: null, verified: true, province: "Kabul", city: "Kabul", status: "active" },
    other_participant: { id: 2, name: "Umair Safi", city: "Kabul", verified: true, avatar_url: null },
    buyer: { id: 1, name: "Ahmad Karimi", city: "Kabul", avatar_url: null },
    seller: { id: 2, name: "Umair Safi", city: "Kabul", avatar_url: null },
    unread_count: 0, last_message_body: "Hello", last_message_kind: "text", blocked_with_participant: false,
  };
  await page.route(/\/api\/me\/conversations(\?.*)?$/, (route) =>
    route.fulfill({ json: { conversations: [SHOP_CHAT], meta: { pagination: { current_page: 1, next_page: null, prev_page: null, total_count: 1, total_pages: 1 } } } }),
  );
  await page.goto("/en/conversations");
  const chip = page.getByTestId("conversation-shop-chat-420");
  await expect(chip).toHaveText("Shop");
  const row = page.locator("li", { has: chip });
  expect(((await row.innerText()).match(/Safi Cosmetics/g) ?? []).length).toBe(1);
});

test("#5: the suspended line on Profile wraps instead of being cut", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await withSessionUser(page, { shops: [shopEntry(42, "Safi Cosmetics", "suspended")] });
  await page.goto("/en/profile");
  const line = page.getByTestId("profile-my-shop-status-suspended");
  await expect(line).toContainText("Suspended — contact Support");
  expect(await line.evaluate((el) => getComputedStyle(el).whiteSpace)).not.toBe("nowrap");
});

test("#7: the Team ⋯ buttons are at least 44px", async ({ page }) => {
  await withSessionUser(page, { sellerMode: true, shops: [shopEntry(42, "Safi Cosmetics", "active", "owner")] });
  await patchJsonRoute(page, "**/api/me/shops/42", (json) => ({ ...json, shop: { ...json.shop, role: "owner" } }));
  await page.goto("/en/shops/42/team");
  for (const id of ["team-member-menu-7", "team-invite-menu-31"]) {
    const b = (await page.getByTestId(id).boundingBox())!;
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
  }
});

const req = (over: Record<string, unknown>) => ({
  id: 901, status: "rejected", document_type: "e_tazkira", name_on_document: "Ahmad Karimi", document_last4: "4821",
  files_count: 3, files_purged: false, reason_code: "photo_not_clear", created_at: "2026-10-04T10:00:00Z", decided_at: "2026-10-05T10:00:00Z", ...over,
});
async function serve(page: Page, status: Record<string, unknown>) {
  await page.route(/\/api\/me\/verification_requests\/current\?subject=me$/, (route) =>
    route.fulfill({ json: { verification_status: { verified_since: null, missing: [], reason: null, name_changed: false, request: null, ...status } } }),
  );
}

test("#8 + #9: requested — 'Under review' once, what happens next; Cancel is a 44px button on the text edge", async ({ page }) => {
  await serve(page, { status: "requested", request: req({ status: "requested", decided_at: null, reason_code: null }) });
  await page.goto("/en/profile");
  const card = page.getByTestId("verify-card");
  await expect(card.getByTestId("verify-card-answer-soon")).toHaveText("We usually answer within 2 days.");
  expect(((await card.innerText()).match(/Under review/g) ?? []).length).toBe(1);
  // Wait for it before measuring: boundingBox() does not wait, and returned
  // null under load (full run 2026-10-08; passed solo).
  await expect(card.getByTestId("verify-cancel")).toBeVisible();
  const btn = (await card.getByTestId("verify-cancel").boundingBox())!;
  const text = (await card.getByTestId("verify-card-answer-soon").boundingBox())!;
  expect(btn.height).toBeGreaterThanOrEqual(44);
  expect(Math.abs(btn.x - text.x)).toBeLessThanOrEqual(1);
});

test("#10: a purged decided request keeps its decision and says the photos were deleted", async ({ page }) => {
  await serve(page, { status: "rejected", reason: "x", request: req({ files_count: 0, files_purged: true }) });
  await page.goto("/en/profile");
  await expect(page.getByTestId("verify-card-status-rejected")).toBeVisible();
  await expect(page.getByTestId("verify-card-photos-deleted")).toHaveText("Your photos were deleted after the check, as promised.");
});

test("#10: not purged → no note", async ({ page }) => {
  await serve(page, { status: "rejected", reason: "x", request: req({}) });
  await page.goto("/en/profile");
  await expect(page.getByTestId("verify-card-status-rejected")).toBeVisible();
  await expect(page.getByTestId("verify-card-photos-deleted")).toHaveCount(0);
});
