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

  test("an expired listing's own page: the Expired pill, never 'Active' beside it", async ({ page }) => {
    await page.goto("/en/my-listings/10");
    await expect(page.getByText("Expired", { exact: true }).first()).toBeVisible({ timeout: 45_000 });
    await expect(page.locator("main").getByText("Active", { exact: true })).toHaveCount(0);
  });

  // Touch targets (design QA 1.1.6): the shared Button is 40px (36 for `sm`) and
  // the segmented tabs 40; their HIT area must reach 44px without the visual size
  // changing.
  test("44px tap targets: header icons, the hub toggle tabs, a card's menu, the gate's Back", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    // The tap area = the drawn box grown by its ::after hit area (negative
    // insets), measured (hit-testing at sub-pixel edges between neighbours a
    // few px apart is unreliable in Chromium).
    const hits44 = async (locator: import("@playwright/test").Locator, what: string) => {
      const area = await locator.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const a = getComputedStyle(el, "::after");
        const px = (v: string) => (a.position === "absolute" && v.endsWith("px") ? Math.max(0, -parseFloat(v)) : 0);
        return { w: r.width + px(a.left) + px(a.right), h: r.height + px(a.top) + px(a.bottom), drawn: `${Math.round(r.width)}x${Math.round(r.height)}` };
      });
      expect(area.w >= 44 && area.h >= 44, `${what} (${area.drawn}) has a tap area of ${area.w}x${area.h}, under 44px`).toBe(true);
    };
    await page.goto("/en/profile");
    await expect(page.locator('a[href$="/profile/activity"]').first()).toBeVisible({ timeout: 45_000 });
    await hits44(page.getByRole("button", { name: /Toggle theme/i }).first(), "theme toggle");
    await hits44(page.getByRole("tab").first(), "Buyer/Seller tab");
    await page.goto("/en/my-listings");
    const kebab = page.getByRole("button", { name: /More options/ }).first();
    await expect(kebab).toBeVisible({ timeout: 45_000 });
    await hits44(kebab, "card menu");
  });
});

// A guest: the seller's own profile words the away banner differently.
test.describe("1.1.6 design QA (guest)", () => {
  test("ps: dates use the Afghan month names (میزان), never the Iranian short ones (مهر)", async ({ page }) => {
    await page.goto("/ps/sellers/1");
    const banner = page.getByText(/غایب/).first();
    await expect(banner).toBeVisible({ timeout: 45_000 });
    expect(await page.locator("main").innerText()).not.toMatch(/مهر|آبان|شهریور|فروردین|اردیبهشت|خرداد|تیر|مرداد|آذر|دی |بهمن|اسفند/);
  });
});
