import { test, expect, type Browser } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

/**
 * Web 1.1.7 hardening: a form submitted BEFORE React hydrates (slow link, busy
 * device) falls back to the browser's native submit. For the signed-in mutation
 * forms that is a GET with the field values in the URL plus a lost edit, so they
 * are now method="post" with the submit disabled until hydrated. The header
 * search is the opposite case — it SHOULD still work without JS, so it degrades
 * to a real GET that keeps the query (e5 BUG-3: the query used to be dropped).
 *
 * All run with JavaScript disabled, as the authed buyer persona, to inspect the
 * server-rendered HTML before any hydration.
 */
async function noJsAuthedPage(browser: Browser, baseURL: string | undefined) {
  const ctx = await browser.newContext({ javaScriptEnabled: false, baseURL, storageState: BUYER_STATE });
  return { ctx, page: await ctx.newPage() };
}

test("header search degrades to a GET that keeps the query (BUG-3)", async ({ browser }, testInfo) => {
  const { ctx, page } = await noJsAuthedPage(browser, testInfo.project.use.baseURL);
  await page.goto("/en/my-listings");
  const field = page.locator('form[role="search"] input[name="q"]').first();
  await expect(field).toHaveCount(1);
  const form = page.locator('form[role="search"]:has(input[name="q"])').first();
  await expect(form).toHaveAttribute("action", /\/bazaar$/);
  await field.fill("lamp");
  await field.press("Enter");
  await page.waitForLoadState("load");
  // The native GET navigated to the results with the query preserved.
  expect(new URL(page.url()).pathname).toMatch(/\/bazaar$/);
  expect(new URL(page.url()).searchParams.get("q")).toBe("lamp");
  await ctx.close();
});

test.describe("signed-in forms carry method=post (defensive, post-hydration)", () => {
  // These forms sit behind the client-side RequireAuth gate, so they only
  // render after React runs — a native pre-hydration submit cannot reach them.
  // method="post" is defensive hardening; this guards that it stays set and the
  // submit is usable once hydrated.
  test.use({ storageState: BUYER_STATE });

  test("edit-profile form is method=post and save enables after hydration", async ({ page }) => {
    await page.goto("/en/profile/edit");
    const form = page.locator("#edit-profile-form");
    await expect(form).toHaveAttribute("method", "post");
    await expect(page.getByTestId("edit-profile-save")).toBeEnabled();
  });

  test("listing form is method=post and submit enables after hydration", async ({ page }) => {
    await page.goto("/en/listings/new");
    const form = page.locator('form[method="post"]:has(button[type="submit"])').first();
    await expect(form).toHaveCount(1);
    await expect(form.locator('button[type="submit"]').first()).toBeEnabled();
  });
});
