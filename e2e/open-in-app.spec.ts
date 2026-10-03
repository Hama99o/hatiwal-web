import { test, expect, devices, type Page, type BrowserContext } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import {
  androidIntentUrl,
  appDeepLink,
  appRouteFromPath,
  smartAppBanner,
  webPath,
} from "../src/lib/app-links";

/*
 * The app vs the website (owner, 2026-10-03):
 *
 *   1. On a PHONE, suggest the app ONCE — the store for that phone, plus
 *      "I have the app — open it" (opens the app on the same listing/seller).
 *   2. Closing it is remembered (cookie): never shown again on its own; a small
 *      "Get the app" icon in the header reopens it whenever they want.
 *   3. DESKTOP: nothing at all.
 *   4. iPhone also gets Apple's Smart App Banner on every page.
 *
 * No server can see what is installed on a phone, so the phone decides: the
 * Android "open" link is an intent:// (app if installed, else /download), the
 * iPhone one the app's hatiwal:// deep link.
 */

const PLAY = "https://play.google.com/store/apps/details?id=com.hatiwal.app";
const APP_STORE = "https://apps.apple.com/app/hatiwal/id6789510903";
const COOKIE = "hatiwal_app_prompt";

/** A device preset minus `defaultBrowserType` (test.use() refuses it in a
 *  describe group). The user agent is what the page reads. */
function device(name: "Pixel 7" | "iPhone 14" | "Desktop Chrome") {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { defaultBrowserType, ...rest } = devices[name];
  return rest;
}

/** The sheet waits 1.5s after load; a cold `next dev` compile can add a lot
 *  more under parallel workers, hence the generous timeout. */
const sheet = (page: Page) => page.getByTestId("app-prompt");
async function expectSheet(page: Page) {
  await expect(sheet(page)).toBeVisible({ timeout: 45_000 });
}
/** "Not shown" must survive the 1.5s delay, not just the first frame. */
async function expectNoSheet(page: Page) {
  await expect(page.locator("h1").first()).toBeVisible({ timeout: 45_000 });
  await page.waitForTimeout(3_000);
  await expect(sheet(page)).toHaveCount(0);
}
async function dismissedCookie(ctx: BrowserContext) {
  return (await ctx.cookies()).find((c) => c.name === COOKIE)?.value;
}

// ── Unit: the one route map ──────────────────────────────────────────────────

test.describe("app-links route map", () => {
  test("web and app paths name the same page", () => {
    expect(webPath({ kind: "listing", id: 70 })).toBe("/listings/70");
    expect(webPath({ kind: "seller", id: 42 })).toBe("/sellers/42");
    expect(appDeepLink({ kind: "listing", id: 70 })).toBe("hatiwal://listing/70");
    expect(appDeepLink({ kind: "seller", id: 42 })).toBe("hatiwal://seller/42");
  });

  test("a website path maps back to its app route, in any locale", () => {
    expect(appRouteFromPath("/en/listings/70")).toEqual({ kind: "listing", id: "70" });
    expect(appRouteFromPath("/ps/sellers/42")).toEqual({ kind: "seller", id: "42" });
    expect(appRouteFromPath("/listings/70")).toEqual({ kind: "listing", id: "70" });
    // No app twin: the app is simply opened.
    expect(appRouteFromPath("/en")).toBeNull();
    expect(appRouteFromPath("/en/bazaar")).toBeNull();
    expect(appRouteFromPath("/en/listings/new")).toBeNull();
  });

  test("Android: a page with a twin opens the app ON it, else /download", () => {
    expect(androidIntentUrl({ kind: "listing", id: 70 })).toMatch(
      /^intent:\/\/listing\/70#Intent;scheme=hatiwal;package=com\.hatiwal\.app;S\.browser_fallback_url=[^;]*%2Fdownload;end$/,
    );
  });

  test("Android: a page without a twin just launches the app", () => {
    expect(androidIntentUrl(null)).toMatch(
      /^intent:#Intent;action=android\.intent\.action\.MAIN;category=android\.intent\.category\.LAUNCHER;package=com\.hatiwal\.app;S\.browser_fallback_url=[^;]*%2Fdownload;end$/,
    );
  });

  test("iPhone banner passes the app's own deep link", () => {
    expect(smartAppBanner({ kind: "seller", id: 42 })).toEqual({
      appId: "6789510903",
      appArgument: "hatiwal://seller/42",
    });
  });
});

// ── iPhone: Apple's Smart App Banner metadata, on every page ─────────────────

test.describe("Smart App Banner metadata", () => {
  const meta = (page: Page) => page.locator('meta[name="apple-itunes-app"]');

  test("home: the app id, no argument", async ({ page }) => {
    await page.goto("/en");
    await expect(meta(page)).toHaveAttribute("content", "app-id=6789510903");
  });

  test("listing: lands on the listing in the app", async ({ page }) => {
    await page.goto("/en/listings/1");
    await expect(meta(page)).toHaveAttribute(
      "content",
      "app-id=6789510903, app-argument=hatiwal://listing/1",
    );
  });

  test("seller: lands on the seller in the app", async ({ page }) => {
    await page.goto("/en/sellers/1");
    await expect(meta(page)).toHaveAttribute(
      "content",
      "app-id=6789510903, app-argument=hatiwal://seller/1",
    );
  });
});

// ── Android ──────────────────────────────────────────────────────────────────

test.describe("Android phone", () => {
  test.use(device("Pixel 7"));

  test("first visit: offered once — Google Play, and open THIS listing in the app", async ({
    page,
  }) => {
    await page.goto("/en/listings/1");
    await expectSheet(page);
    await expect(page.getByTestId("app-prompt-store")).toHaveAttribute("href", PLAY);
    await expect(page.getByTestId("app-prompt-store")).toHaveText("Google Play");
    await expect(page.getByTestId("app-prompt-open")).toHaveAttribute(
      "href",
      /^intent:\/\/listing\/1#Intent;scheme=hatiwal;package=com\.hatiwal\.app;/,
    );
    // Before it is closed, no icon: the suggestion itself is the way in.
    await expect(page.getByTestId("app-prompt-icon")).toHaveCount(0);
  });

  test("seller page: open lands on the seller", async ({ page }) => {
    await page.goto("/en/sellers/1");
    await expectSheet(page);
    await expect(page.getByTestId("app-prompt-open")).toHaveAttribute(
      "href",
      /^intent:\/\/seller\/1#Intent;scheme=hatiwal;/,
    );
  });

  test("a page with no app twin opens the app itself", async ({ page }) => {
    await page.goto("/en");
    await expectSheet(page);
    await expect(page.getByTestId("app-prompt-open")).toHaveAttribute(
      "href",
      /^intent:#Intent;action=android\.intent\.action\.MAIN;/,
    );
  });

  test("'Not now' is remembered: never offered again, the header icon stays", async ({
    page,
    context,
  }) => {
    await page.goto("/en/listings/1");
    await expectSheet(page);
    await page.getByTestId("app-prompt-not-now").click();
    await expect(sheet(page)).toHaveCount(0);
    expect(await dismissedCookie(context)).toBe("dismissed");
    await expect(page.getByTestId("app-prompt-icon")).toBeVisible();

    // Reload, and another page: not offered again by itself.
    await page.reload();
    await expectNoSheet(page);
    await page.goto("/en/sellers/1");
    await expectNoSheet(page);
    await expect(page.getByTestId("app-prompt-icon")).toBeVisible();
  });

  test("the header icon reopens it; closing with ✕ keeps it closed", async ({ page }) => {
    await page.goto("/en/listings/1");
    await page.evaluate((c) => {
      document.cookie = `${c}=dismissed; path=/; max-age=31536000`;
    }, COOKIE);
    await page.reload();
    await expectNoSheet(page);

    await page.getByTestId("app-prompt-icon").click();
    await expectSheet(page);
    await expect(page.getByTestId("app-prompt-store")).toHaveAttribute("href", PLAY);
    // The ✕ (and the backdrop) count as "not now" too.
    await sheet(page).getByRole("button", { name: "Not now" }).last().click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(page.getByTestId("app-prompt-icon")).toBeVisible();
  });

  test("never on the /download page (it IS the install page)", async ({ page }) => {
    await page.goto("/en/download");
    await expectNoSheet(page);
    await expect(page.getByTestId("app-prompt-icon")).toHaveCount(0);
  });

  test("RTL: translated (ps)", async ({ page }) => {
    await page.goto("/ps/listings/1");
    await expectSheet(page);
    await expect(sheet(page)).toContainText("د هتیوال اپ ترلاسه کړئ");
    await expect(page.getByTestId("app-prompt-open")).toHaveText("اپ لرم — پرانیزئ یې");
  });
});

test.describe("Android, signed in", () => {
  test.use({ ...device("Pixel 7"), storageState: BUYER_STATE });

  test("never stacked on the welcome modal: the welcome goes first", async ({ page }) => {
    // The welcome shows once to a signed-in user who has not seen it.
    await page.addInitScript(() => window.localStorage.removeItem("hatiwal.onboarded"));
    await page.goto("/en/listings/1");
    await expectNoSheet(page);
  });

  test("once the welcome was seen, it is offered", async ({ page }) => {
    await page.goto("/en/listings/1");
    await expectSheet(page);
  });
});

// ── iPhone ───────────────────────────────────────────────────────────────────

test.describe("iPhone", () => {
  test.use(device("iPhone 14"));

  test("first visit: offered once — App Store, and open THIS listing in the app", async ({
    page,
  }) => {
    await page.goto("/en/listings/1");
    await expectSheet(page);
    await expect(page.getByTestId("app-prompt-store")).toHaveAttribute("href", APP_STORE);
    await expect(page.getByTestId("app-prompt-store")).toHaveText("App Store");
    await expect(page.getByTestId("app-prompt-open")).toHaveAttribute(
      "href",
      "hatiwal://listing/1",
    );
  });

  test("closing it shows the header icon instead", async ({ page }) => {
    await page.goto("/en/sellers/1");
    await expectSheet(page);
    await page.getByTestId("app-prompt-not-now").click();
    await expect(page.getByTestId("app-prompt-icon")).toBeVisible();
    await page.reload();
    await expectNoSheet(page);
  });
});

// ── Desktop ──────────────────────────────────────────────────────────────────

test.describe("Desktop", () => {
  test.use(device("Desktop Chrome"));

  test("nothing: no suggestion and no icon, even after waiting", async ({ page }) => {
    await page.goto("/en/listings/1");
    await expectNoSheet(page);
    await expect(page.getByTestId("app-prompt-icon")).toHaveCount(0);
  });

  test("nothing on a narrow desktop window either (the device decides, not the width)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/listings/1");
    await expectNoSheet(page);
    await expect(page.getByTestId("app-prompt-icon")).toHaveCount(0);
  });
});
