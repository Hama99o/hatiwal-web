import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

/**
 * The Bazaar feed must not remount after its first paint (owner, 1.1.6: "a
 * tap at that instant can be lost"). Signed in, the session probe and then
 * `me` (home) change the feed's query key; it used to arrive with no data,
 * the grid became the skeleton and every card unmounted a moment after load.
 */
const cards = (page: import("@playwright/test").Page) =>
  page.locator("a[href*='/listings/']").and(page.locator("a:not([href$='/listings/new'])"));

test.describe("signed in (the session probe and home change the feed key)", () => {
  test.use({ storageState: BUYER_STATE });
  test("the first card painted is the SAME node once everything has loaded (no remount)", async ({ page }) => {
    await page.goto("/en/bazaar");
    const first = cards(page).first();
    await expect(first).toBeVisible();
    const node = await first.elementHandle();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    expect(await node!.evaluate((n) => n.isConnected), "the card painted first was replaced after load").toBe(true);
  });

  test("a card tapped right after the first paint opens its listing", async ({ page }) => {
    await page.goto("/en/bazaar");
    const first = cards(page).first();
    await expect(first).toBeVisible();
    await first.click(); // no waiting for the network on purpose
    await expect(page).toHaveURL(/\/listings\/\d+/);
  });
});

test.describe("guest", () => {
  test("the first card painted is the SAME node once everything has loaded (no remount)", async ({ page }) => {
    await page.goto("/en/bazaar");
    const first = cards(page).first();
    await expect(first).toBeVisible();
    const node = await first.elementHandle();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    expect(await node!.evaluate((n) => n.isConnected), "the card painted first was replaced after load").toBe(true);
  });

  test("a card tapped right after the first paint opens its listing", async ({ page }) => {
    await page.goto("/en/bazaar");
    const first = cards(page).first();
    await expect(first).toBeVisible();
    await first.click(); // no waiting for the network on purpose
    await expect(page).toHaveURL(/\/listings\/\d+/);
  });
});
