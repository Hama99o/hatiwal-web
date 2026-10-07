import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import { withSessionUser, shopEntry } from "./session-user";
import ps from "../messages/ps.json";

/*
 * Move to shop / Duplicate to… (owner, 2026-10-12; hatiwal-mobile
 * docs/OWNER_ITEMS_2026-10-12.md, item 5).
 *
 * BUYER_STATE is user 1, the seller of the My listings fixtures. Listing 1
 * ("iPhone 13 Pro") is personal and active. Shops are injected into the
 * session (withSessionUser), as the SHOP-3 specs do.
 */

function card(page: Page, id: number) {
  return page.locator(`a[href="/en/my-listings/${id}"]`).locator("..");
}
async function openKebab(page: Page, id: number) {
  await page.goto("/en/my-listings");
  const c = card(page, id);
  await expect(c).toBeVisible({ timeout: 60_000 });
  await c.getByRole("button", { name: /More options/ }).click();
}

const TWO_SHOPS = [shopEntry(42, "Safi Cosmetics", "active", "owner"), shopEntry(43, "Safi Mobile", "active", "staff")];

test.describe("Without a shop", () => {
  test.use({ storageState: BUYER_STATE });

  test("no Move; Duplicate copies it as Me (photos included, server-side) and opens the draft", async ({ page }) => {
    let sent: unknown = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/my\/listings\/1\/duplicate$/.test(req.url())) sent = req.postDataJSON();
    });
    await openKebab(page, 1);
    await expect(page.getByTestId("move-listing")).toHaveCount(0);
    await page.getByTestId("duplicate-listing").click();
    await expect(page).toHaveURL(/\/listings\/900\/edit$/, { timeout: 30_000 });
    expect(sent).toEqual({ shop_id: null });
    await expect(page.getByText("Copied as a draft, photos included").first()).toBeVisible();
  });
});

test.describe("With shops", () => {
  test.use({ storageState: BUYER_STATE });

  test.beforeEach(async ({ page }) => {
    await withSessionUser(page, { sellerMode: true, shops: TWO_SHOPS });
    // The one-time "Sell as…" question a user with shops gets: already answered.
    await page.addInitScript(() => window.localStorage.setItem("hatiwal.sell-as-asked-1", "1"));
  });

  test("Move to shop: pick a shop, confirm (chats stay), moved", async ({ page }) => {
    let sent: unknown = null;
    page.on("request", (req) => {
      if (req.method() === "PUT" && /\/my\/listings\/1\/move$/.test(req.url())) sent = req.postDataJSON();
    });
    await openKebab(page, 1);
    await page.getByTestId("move-listing").click();
    // A personal listing: both shops, not Me (it is already there).
    await expect(page.getByTestId("move-to-42")).toHaveText("Safi Cosmetics");
    await expect(page.getByTestId("move-to-43")).toBeVisible();
    await expect(page.getByTestId("move-to-me")).toHaveCount(0);

    await page.getByTestId("move-to-42").click();
    const confirm = page.getByRole("dialog");
    await expect(confirm.getByText("Move this listing to Safi Cosmetics?")).toBeVisible();
    await expect(confirm.getByText(/Its chats stay with Me/)).toBeVisible();
    await confirm.getByRole("button", { name: "Move" }).click();
    await expect(page.getByText("Moved to Safi Cosmetics").first()).toBeVisible();
    expect(sent).toEqual({ shop_id: 42 });
  });

  test("Duplicate asks where; another shop gets the copy, switches who you sell as, opens the draft", async ({ page }) => {
    let sent: unknown = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/my\/listings\/1\/duplicate$/.test(req.url())) sent = req.postDataJSON();
    });
    let switchedTo: unknown = "none";
    await page.route("**/api/me/users/me/selling_as", async (route) => {
      switchedTo = route.request().postDataJSON();
      const res = await route.fetch({ url: route.request().url().replace("/selling_as", ""), method: "GET" });
      await route.fulfill({ response: res });
    });
    await openKebab(page, 1);
    await page.getByTestId("duplicate-listing").click();
    await expect(page.getByRole("heading", { name: "Duplicate to…" })).toBeVisible();
    await expect(page.getByTestId("duplicate-to-me")).toHaveText("Here: Me");
    await page.getByTestId("duplicate-to-42").click();
    await expect(page).toHaveURL(/\/listings\/900\/edit$/, { timeout: 30_000 });
    expect(sent).toEqual({ shop_id: 42 });
    expect(switchedTo).toEqual({ shop_id: 42 });
  });

  test("RTL: Pashto labels", async ({ page }) => {
    await page.goto("/ps/my-listings");
    const c = page.locator('a[href="/ps/my-listings/1"]').locator("..");
    await expect(c).toBeVisible({ timeout: 60_000 });
    await c.getByRole("button").last().click();
    await expect(page.getByTestId("move-listing")).toHaveText(ps.listing.move.action);
  });
});

test.describe("The old chat after a move", () => {
  test.use({ storageState: BUYER_STATE });

  const thread = (body: string) => ({
    messages: [
      {
        id: 9, body, kind: "system", read_at: null, created_at: "2026-10-07T12:00:00Z", responds_to_id: null,
        sender: { id: 1, name: "Ahmad Karimi", avatar_url: null }, attachment_url: null, deleted: false,
        notice: { notice: "listing_moved", shop_id: 42, name: "Safi Cosmetics" },
      },
    ],
    meta: { pagination: { current_page: 1, next_page: null, prev_page: null, total_count: 1, total_pages: 1 } },
  });

  test("reads the notice in the viewer's own language, not the stored body", async ({ page }) => {
    // The body is in the BUYER's language (here Dari); an English reader sees English.
    await page.route("**/api/me/conversations/1/messages?*", (route) =>
      route.fulfill({ json: thread("این آگهی به Safi Cosmetics منتقل شد.") }),
    );
    await page.goto("/en/conversations/1");
    await expect(page.getByText("This listing moved to Safi Cosmetics.", { exact: false })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/منتقل شد/)).toHaveCount(0);
  });
});
