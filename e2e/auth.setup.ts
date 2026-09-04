import { test as setup, expect } from "@playwright/test";

/**
 * Logs in once per persona via the real UI and saves the resulting session
 * (httpOnly token cookies) to a storageState file. Authed specs reuse these via
 * `test.use({ storageState })` so they start already signed in — no re-login per
 * test. Two personas back the populated-vs-empty state coverage (see mock-api).
 */
import { BUYER_STATE, EMPTY_STATE } from "./auth-paths";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/en/login");
  // THE FIRST NAVIGATION OF A RUN MUST BE ALLOWED TO COMPILE.
  //
  // This is the very first request any suite makes, against a dist dir that
  // e2e/global-setup.ts has just emptied, so Next compiles /[locale]/login from
  // nothing while it serves. That reliably exceeds the 20s `actionTimeout` on a
  // loaded machine, and the failure reads
  // "locator.fill: Timeout 20000ms exceeded, waiting for getByLabel(/Email/i)"
  // — which looks like a missing form field rather than a slow compile, and
  // fails BOTH personas and therefore every authed spec after them.
  //
  // Waiting explicitly, with the same 60s budget the redirect below already
  // gets, keeps the tight default action timeout everywhere else.
  await expect(page.getByLabel(/Email/i)).toBeVisible({ timeout: 60_000 });
  await page.getByLabel(/Email/i).fill(email);
  await page.getByLabel(/Password/i).fill("Password123!");
  await page.getByRole("button", { name: /Sign In/i }).click();
  // Login redirects to /profile once authenticated. Generous: the setup runs
  // first and triggers the cold dev-mode compile of /login and /profile.
  await expect(page).not.toHaveURL(/\/login/, { timeout: 60_000 });
  // These personas are returning users — mark onboarding as seen so the
  // first-run welcome modal doesn't cover the page in every authed spec.
  await page.evaluate(() =>
    window.localStorage.setItem("hatiwal.onboarded", "1"),
  );
}

setup("authenticate as buyer (full data)", async ({ page }) => {
  await login(page, "buyer@hatiwal.test");
  await page.context().storageState({ path: BUYER_STATE });
});

setup("authenticate as empty user", async ({ page }) => {
  await login(page, "empty@hatiwal.test");
  await page.context().storageState({ path: EMPTY_STATE });
});
