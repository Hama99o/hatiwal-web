import { test, expect, devices } from "@playwright/test";

/*
 * SHOP-1 "Share my shop" (hatiwal-mobile docs/SHOPS.md, owner 2026-10-05).
 * DRAFT by the QA guard: fixme until the shop page and the mock API's
 * /shops/:id land (apps-6a, shop-1-web). Then flip `test.describe.fixme` to
 * `test.describe` and point SHOP_ID at the mock fixture.
 *
 *   - /s/<id> lands on the shop page (next.config redirect → /[locale]/shops/<id>);
 *   - og:title = shop name, og:image = logo (or cover / site card);
 *   - Android UA: the open-in-app bar opens intent://shop/<id>; dismiss is remembered;
 *   - iPhone UA: Apple's Smart App Banner meta;
 *   - the shared link is https, never hatiwal://.
 */
const SHOP_ID = 42;
const SHOP_NAME = "Safi Cosmetics";

function device(name: "Pixel 7" | "iPhone 14") {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { defaultBrowserType, ...rest } = devices[name];
  return rest;
}

test.describe.fixme("Share my shop: links", () => {
  test("/s/<id> lands on the shop page", async ({ page }) => {
    await page.goto(`/s/${SHOP_ID}`);
    await expect(page).toHaveURL(new RegExp(`/shops/${SHOP_ID}$`));
    await expect(page.getByTestId("shop-page")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole("heading", { name: SHOP_NAME })).toBeVisible();
  });

  test("og tags name the shop and show its picture", async ({ page }) => {
    await page.goto(`/en/shops/${SHOP_ID}`);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", new RegExp(SHOP_NAME));
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /^https?:\/\//);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", new RegExp(`/s/${SHOP_ID}|/shops/${SHOP_ID}`));
  });

  test("the share button shares https, never hatiwal://", async ({ page }) => {
    await page.goto(`/en/shops/${SHOP_ID}`);
    const link = await page.getByTestId("shop-share").getAttribute("data-share-url");
    expect(link).toBe(`https://hatiwal.com/s/${SHOP_ID}`);
    expect(link).not.toContain("hatiwal://");
  });
});

test.describe.fixme("Share my shop: Android phone", () => {
  test.use(device("Pixel 7"));

  test("the open-in-app bar targets the shop, and dismiss is remembered", async ({ page, context }) => {
    await page.goto(`/en/shops/${SHOP_ID}`);
    const prompt = page.getByTestId("app-prompt");
    await expect(prompt).toBeVisible({ timeout: 45_000 });
    await expect(prompt.getByRole("link", { name: /open/i })).toHaveAttribute("href", new RegExp(`^intent://shop/${SHOP_ID}#Intent;`));
    await prompt.getByRole("button", { name: /close|dismiss|×/i }).click();
    expect((await context.cookies()).some((c) => c.name === "hatiwal_app_prompt")).toBe(true);
    await page.reload();
    await page.waitForTimeout(3_000);
    await expect(page.getByTestId("app-prompt")).toHaveCount(0);
  });
});

test.describe.fixme("Share my shop: iPhone", () => {
  test.use(device("iPhone 14"));

  test("the Smart App Banner meta points into the shop", async ({ page }) => {
    await page.goto(`/en/shops/${SHOP_ID}`);
    await expect(page.locator('meta[name="apple-itunes-app"]')).toHaveAttribute("content", new RegExp(`app-argument=.*shop.*${SHOP_ID}`));
  });
});
