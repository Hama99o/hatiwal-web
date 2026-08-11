import { test, expect } from "@playwright/test";

test.describe("Auth", () => {
  test("login page renders the form", async ({ page }) => {
    await page.goto("/en/login");
    await expect(page.getByRole("heading", { name: /Welcome to Hatiwal/i })).toBeVisible();
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Sign In/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Register/i })).toBeVisible();
  });

  test("invalid credentials show an error", async ({ page }) => {
    await page.goto("/en/login");
    await page.getByLabel(/Email/i).fill("wrong@example.com");
    await page.getByLabel(/Password/i).fill("badpassword");
    await page.getByRole("button", { name: /Sign In/i }).click();
    // The mock returns 401 → the form surfaces auth.loginError and stays on /login.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/Couldn.t sign in/i).first()).toBeVisible();
  });

  test("a guest visiting Saved is sent to login", async ({ page }) => {
    await page.goto("/en/saved");
    await expect(page.getByRole("button", { name: /Sign In/i })).toBeVisible();
  });

  test("valid credentials log in and leave the login page", async ({ page }) => {
    await page.goto("/en/login");
    await page.getByLabel(/Email/i).fill("buyer@hatiwal.test");
    await page.getByLabel(/Password/i).fill("Password123!");
    await page.getByRole("button", { name: /Sign In/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
  });

  // Cross-user contamination guard for a shared browser: user A signs out, user B
  // signs in, WITHOUT a page reload — the normal case on a shared phone or
  // computer, which is common in this market. B's Saved page must show B's data.
  //
  // Companion to the cache clear in auth-provider.tsx (clearCacheForIdentityChange).
  // Until that landed, logout reset only React state and nothing in the app ever
  // evicted the TanStack cache, so ['saved-listings'] / ['my-listings'] /
  // ['conversations'] still held A's rows when B arrived.
  //
  // WHAT THIS TEST DOES AND DOES NOT PROVE — read before trusting it:
  //  • It DOES catch a PERSISTENT leak: if the cache were never refreshed for B
  //    (staleTime raised, refetch-on-mount disabled, a query keyed so B never
  //    triggers a fetch), A's rows would stay on screen and this fails.
  //  • It does NOT catch the TRANSIENT flash that the unfixed code produced —
  //    A's cached rows rendering for the instant before B's refetch lands.
  //    Playwright's assertions auto-retry, so they wait the flash out; verified
  //    empirically, this test passes with the cache clear removed. Expressing
  //    "was never visible at any frame" is not something these assertions can do.
  //  • Two navigation notes, both learned the hard way: every step after the
  //    first load must be CLIENT-SIDE (a page.goto tears down the JS context and
  //    the in-memory cache with it, hiding the bug entirely), and the onboarding
  //    flag must be set BEFORE the first sign-in (the modal opens on auth and
  //    then covers the account menu).
  //
  // The two mock personas make contamination observable: buyer@ has 2 saved
  // listings, empty@ has none.
  test("a second user never sees the first user's saved listings", async ({ page }) => {
    async function signIn(email: string) {
      await page.getByLabel(/Email/i).fill(email);
      await page.getByLabel(/Password/i).fill("Password123!");
      await page.getByRole("button", { name: /Sign In/i }).click();
      await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
    }

    // The dropdown trigger is a plain <button aria-label="{full name}"> wrapping
    // the avatar — matched on the attribute so it cannot collide with the name
    // rendered elsewhere on the page (e.g. the profile heading).
    async function openAccountMenu(name: string) {
      await page.locator(`button[aria-label="${name}"]`).click();
    }

    // The ONLY hard load in this test.
    await page.goto("/en/login");

    // Mark onboarding seen BEFORE signing in — the same flag auth.setup.ts sets.
    // It has to be set first: the first-run welcome modal opens the moment a user
    // becomes authed, and writing the flag afterwards does not close an
    // already-open modal — it then covers the account menu for the rest of the
    // test. localStorage survives client-side navigation, so one write covers
    // both users.
    await page.evaluate(() =>
      window.localStorage.setItem("hatiwal.onboarded", "1"),
    );

    // ── User A: populate the saved-listings cache ────────────────────────────
    await signIn("buyer@hatiwal.test");
    await openAccountMenu("Ahmad Karimi");
    await page.getByRole("menuitem", { name: /^Saved$/i }).click();
    await expect(page.getByText("Samsung 4K TV")).toBeVisible({ timeout: 30_000 });

    // ── Hand the browser over, without ever reloading ────────────────────────
    await openAccountMenu("Ahmad Karimi");
    await page.getByRole("menuitem", { name: /Sign Out/i }).click();
    await page.getByRole("link", { name: /^Login$/i }).first().click();
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });

    // ── User B: must start from nothing, not from A's cached rows ────────────
    await signIn("empty@hatiwal.test");
    await openAccountMenu("Sahar Noor");
    await page.getByRole("menuitem", { name: /^Saved$/i }).click();
    await expect(page.getByText("Samsung 4K TV")).toHaveCount(0);
    await expect(page.getByText("Winter Jacket")).toHaveCount(0);
  });
});
