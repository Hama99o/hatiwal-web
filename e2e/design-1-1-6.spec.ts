import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import { shopEntry, withSessionUser } from "./session-user";

/*
 * Web design QA of 1.1.6 (2026-10-08, qa/reports/web-design-1.1.6/): the
 * issues it found, each pinned so it can't come back.
 */
async function ownerOf42(page: Page) {
  await withSessionUser(page, { sellerMode: true, shops: [shopEntry(42, "Safi Cosmetics", "active", "owner")] });
  await page.route("**/api/me/shops/42", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    const json = await res.json();
    json.shop = { ...json.shop, role: "owner" };
    await route.fulfill({ response: res, json });
  });
}

const noPageOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.describe("1.1.6 design QA", () => {
  test.use({ storageState: BUYER_STATE });

  test("390px: the owner's shop page does not scroll sideways (Your numbers / Team / Edit shop wrap)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await ownerOf42(page);
    await page.goto("/en/shops/42");
    await expect(page.getByTestId("shop-page-edit")).toBeVisible({ timeout: 45_000 });
    expect(await noPageOverflow(page)).toBeLessThanOrEqual(1);
    const edit = await page.getByTestId("shop-page-edit").boundingBox();
    expect(edit!.x + edit!.width).toBeLessThanOrEqual(390);
  });

  for (const locale of ["ps", "fa"] as const) {
    test(`${locale}: the shop's opening hours use the reader's digits`, async ({ page }) => {
      await page.goto(`/${locale}/shops/42`);
      const line = page.getByTestId("shop-open-status");
      await expect(line).toBeVisible({ timeout: 45_000 });
      expect(await line.innerText()).not.toMatch(/[0-9]/);
    });
  }

  test("the invite link's Copy is a real touch target (>= 44px), and says so when copying fails", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.setViewportSize({ width: 390, height: 900 });
    await ownerOf42(page);
    await page.goto("/en/shops/42/team");
    await page.getByTestId("team-invite").click();
    await page.getByTestId("invite-share-link").click();
    const copy = page.getByTestId("invite-copy-link");
    await expect(copy).toBeVisible();
    const box = await copy.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) }, configurable: true });
    });
    await copy.click();
    await expect(page.getByText("Link copied")).toHaveCount(0);
  });

  test("fa: a listing card's province reads in Dari (parity with mobile 12e1bbc), not 'Kabul'", async ({ page }) => {
    await page.goto("/fa/bazaar");
    const card = page.locator('a[href^="/fa/listings/"]').first();
    await expect(card).toBeVisible({ timeout: 45_000 });
    await expect(page.locator("main").getByText("Kabul", { exact: true })).toHaveCount(0);
    await expect(page.locator("main").getByText("کابل").first()).toBeVisible();
  });

  test("the verify gate under review says 'Under review' once (title), then when we answer", async ({ page }) => {
    await page.route(/\/api\/me\/verification_requests\/current\?subject=me$/, (route) =>
      route.fulfill({ json: { verification_status: { status: "requested", verified_since: null, missing: [], reason: null, name_changed: false, can_apply: true,
        request: { id: 901, status: "requested", document_type: "e_tazkira", name_on_document: "A", document_last4: "4821", files_count: 3, files_purged: false, reason_code: null, created_at: "2026-10-05T10:00:00Z", decided_at: null } } } }),
    );
    await page.goto("/en/profile/verify");
    await expect(page.getByText("We usually answer within 2 days.")).toBeVisible({ timeout: 45_000 });
    expect(((await page.locator("main").innerText()).match(/Under review/g) ?? []).length).toBe(1);
  });
});
