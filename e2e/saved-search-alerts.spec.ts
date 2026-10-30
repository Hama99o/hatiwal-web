import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

/**
 * Saved-search alerts (hatiwal-api docs/SAVED_SEARCH_ALERTS.md, design in
 * hatiwal-mobile docs/design/SAVED_SEARCH_ALERTS.md): a banner on the results
 * follows the current search, a bell on each saved search toggles it, and one
 * switch in Settings turns every alert off. The push itself reaches the phone.
 */
const MOCK_API = `http://localhost:${process.env.E2E_MOCK_API_PORT || 4010}/api/v1`;
const SEARCH_URL = "/en/browse?category=phones&q=iphone&max=50000";

async function state(page: Page): Promise<{ searches: { id: number; query: string | null; alert: boolean }[]; me_saved_search_alerts: boolean }> {
  return (await page.request.get(`${MOCK_API}/__saved_search_alerts`)).json();
}

const banner = (page: Page) => page.getByTestId("search-alert-banner");
const bannerSwitch = (page: Page) => banner(page).getByRole("switch");

test.describe("Saved-search alerts (web)", () => {
  test.use({ storageState: BUYER_STATE });
  test.describe.configure({ mode: "serial" }); // one mock state for the whole file

  test.beforeEach(async ({ page }) => {
    await page.request.post(`${MOCK_API}/__saved_search_alerts/reset`, { data: {} });
  });

  test("the results banner follows THIS search (keyword included); off unfollows it", async ({ page }) => {
    await page.goto(SEARCH_URL);
    await expect(banner(page)).toContainText("Get alerts for new matches");
    await expect(bannerSwitch(page)).toHaveAttribute("aria-checked", "false");

    await bannerSwitch(page).click();
    await expect(bannerSwitch(page)).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("We'll let you know. Turn off any time.")).toBeVisible();
    const followed = (await state(page)).searches.find((s) => s.query === "iphone");
    expect(followed?.alert).toBe(true);

    await bannerSwitch(page).click();
    await expect(bannerSwitch(page)).toHaveAttribute("aria-checked", "false");
    expect((await state(page)).searches.find((s) => s.id === followed!.id)?.alert).toBe(false);
  });

  test("no banner without a search or a filter, nor for a guest", async ({ page, browser }) => {
    await page.goto("/en/browse");
    await expect(page.getByTestId("results-count")).toBeVisible();
    await expect(banner(page)).toHaveCount(0);

    const guest = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const guestPage = await guest.newPage();
    await guestPage.goto(SEARCH_URL);
    await expect(guestPage.getByTestId("results-count")).toBeVisible();
    await expect(banner(guestPage)).toHaveCount(0);
    await guest.close();
  });

  test("a bell on each saved search toggles its alert", async ({ page }) => {
    await page.goto("/en/browse");
    const bell = page.getByTestId("saved-search-alert-1");
    await expect(bell).toHaveAttribute("aria-checked", "false");

    await bell.click();
    await expect(bell).toHaveAttribute("aria-checked", "true");
    expect((await state(page)).searches.find((s) => s.id === 1)?.alert).toBe(true);
  });

  test("a 6th followed search says why, in words, and stays off", async ({ page }) => {
    await page.request.post(`${MOCK_API}/__saved_search_alerts/reset`, { data: { followed: 5 } });
    await page.goto(SEARCH_URL);

    await bannerSwitch(page).click();
    await expect(page.getByText("You can follow up to 5 searches. Turn one off first.")).toBeVisible();
    await expect(bannerSwitch(page)).toHaveAttribute("aria-checked", "false");
  });

  test("Settings: one switch turns every saved-search alert off", async ({ page }) => {
    await page.goto("/en/profile/settings");
    const master = page.getByTestId("saved-search-alerts-switch");
    await expect(master).toHaveAttribute("aria-checked", "true");

    await master.click();
    await expect(master).toHaveAttribute("aria-checked", "false");
    await expect.poll(async () => (await state(page)).me_saved_search_alerts).toBe(false);
  });

  test("in Pashto the banner speaks Pashto", async ({ page }) => {
    await page.goto(SEARCH_URL.replace("/en/", "/ps/"));
    await expect(banner(page)).toContainText("د نویو شیانو خبرتیا ترلاسه کړئ");
    await expect(banner(page)).not.toContainText("Get alerts");
  });
});
