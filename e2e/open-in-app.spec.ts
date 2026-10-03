import { test, expect, devices } from "@playwright/test";
import {
  androidIntentUrl,
  appDeepLink,
  smartAppBanner,
  webPath,
} from "../src/lib/app-links";

/*
 * "Open the app if it is installed, otherwise the web" (owner, 2026-10-03).
 *
 * No server can see what is installed on a phone, so the page the link opens
 * decides, on the phone:
 *   • Android: the "Open in the Hatiwal app" bar's button is an intent:// link —
 *     Chrome opens the app if installed, else follows the /download fallback.
 *   • iPhone: Apple's Smart App Banner (apple-itunes-app meta) — "Open" or "Get".
 */

// ── Unit: the one route map ──────────────────────────────────────────────────

test.describe("app-links route map", () => {
  test("web and app paths name the same page", () => {
    expect(webPath({ kind: "listing", id: 70 })).toBe("/listings/70");
    expect(webPath({ kind: "seller", id: 42 })).toBe("/sellers/42");
    expect(appDeepLink({ kind: "listing", id: 70 })).toBe("hatiwal://listing/70");
    expect(appDeepLink({ kind: "seller", id: 42 })).toBe("hatiwal://seller/42");
  });

  test("the Android intent opens the app, else our /download page", () => {
    const url = androidIntentUrl({ kind: "listing", id: 70 });
    expect(url.startsWith("intent://listing/70#Intent;")).toBe(true);
    expect(url).toContain("scheme=hatiwal;");
    expect(url).toContain("package=com.hatiwal.app;");
    expect(url).toMatch(/S\.browser_fallback_url=[^;]*%2Fdownload;end$/);
  });

  test("the iPhone banner passes the app's own deep link", () => {
    expect(smartAppBanner({ kind: "seller", id: 42 })).toEqual({
      appId: "6789510903",
      appArgument: "hatiwal://seller/42",
    });
  });
});

// ── Pages ────────────────────────────────────────────────────────────────────

/** A device preset minus `defaultBrowserType`, which test.use() refuses in a
 *  describe group. The user agent is what the page reads. */
function phone(name: "Pixel 7" | "iPhone 14") {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { defaultBrowserType, ...rest } = devices[name];
  return rest;
}

test.describe("iPhone: Smart App Banner metadata", () => {
  test("the listing page carries apple-itunes-app with the listing deep link", async ({
    page,
  }) => {
    await page.goto("/en/listings/1");
    await expect(page.locator('meta[name="apple-itunes-app"]')).toHaveAttribute(
      "content",
      "app-id=6789510903, app-argument=hatiwal://listing/1",
    );
  });

  test("the seller page carries it with the seller deep link", async ({ page }) => {
    await page.goto("/en/sellers/1");
    await expect(page.locator('meta[name="apple-itunes-app"]')).toHaveAttribute(
      "content",
      "app-id=6789510903, app-argument=hatiwal://seller/1",
    );
  });
});

test.describe("Android: Open in the Hatiwal app", () => {
  test.use(phone("Pixel 7"));

  test("the listing page shows the bar, and its button is the intent link", async ({
    page,
  }) => {
    await page.goto("/en/listings/1");
    // The bar mounts only after hydration (it reads the user agent in the
    // browser), and a cold `next dev` compile of this page under parallel
    // workers can take longer than the default 15s — seen once in a CI-shaped run.
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.getByTestId("open-in-app-bar")).toBeVisible({ timeout: 45_000 });
    // The fallback host is the server's SITE_URL, which the test process does
    // not share — so match the structure, not the exact host.
    await expect(page.getByTestId("open-in-app-open")).toHaveAttribute(
      "href",
      /^intent:\/\/listing\/1#Intent;scheme=hatiwal;package=com\.hatiwal\.app;S\.browser_fallback_url=[^;]*%2Fdownload;end$/,
    );
  });

  test("the seller page shows it too, for the seller", async ({ page }) => {
    await page.goto("/en/sellers/1");
    await expect(page.getByTestId("open-in-app-open")).toHaveAttribute(
      "href",
      /^intent:\/\/seller\/1#Intent;scheme=hatiwal;package=com\.hatiwal\.app;S\.browser_fallback_url=[^;]*%2Fdownload;end$/,
    );
  });

  test("closing it is remembered", async ({ page }) => {
    await page.goto("/en/listings/1");
    await page.getByTestId("open-in-app-bar").getByRole("button", { name: "Close" }).click();
    await expect(page.getByTestId("open-in-app-bar")).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("listing-title").or(page.locator("h1")).first()).toBeVisible();
    await expect(page.getByTestId("open-in-app-bar")).toHaveCount(0);
  });

  test("RTL: the bar is translated (ps)", async ({ page }) => {
    await page.goto("/ps/listings/1");
    await expect(page.getByTestId("open-in-app-bar")).toContainText("په هتیوال اپ کې پرانیزئ");
  });
});

test.describe("No bar where Android's intent does not apply", () => {
  test("iPhone (it has Apple's own banner)", async ({ browser }) => {
    const ctx = await browser.newContext(phone("iPhone 14"));
    const page = await ctx.newPage();
    await page.goto("/en/listings/1");
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.getByTestId("open-in-app-bar")).toHaveCount(0);
    await ctx.close();
  });

  test("desktop", async ({ page }) => {
    await page.goto("/en/listings/1");
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.getByTestId("open-in-app-bar")).toHaveCount(0);
  });
});
