import { test, expect } from "@playwright/test";

test.describe("Auth", () => {
  test("login page renders the form", async ({ page }) => {
    await page.goto("/en/login");
    await expect(page.getByRole("heading", { name: /Welcome to Hatiwal/i })).toBeVisible();
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Sign In/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Register/i })).toBeVisible();
  });

  test("invalid credentials show an error", async ({ page }) => {
    await page.goto("/en/login");
    await page.getByLabel(/Email/i).fill("wrong@example.com");
    await page.getByLabel("Password", { exact: true }).fill("badpassword");
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
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
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
      await page.getByLabel("Password", { exact: true }).fill("Password123!");
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
    // The buyer@ persona is in Seller mode, and Saved is a BUYING item (the menu
    // follows the mode, like mobile's tab bar — docs/design/mode-switch.md).
    // Switch to Buyer mode from the same menu: a client-side push, no reload.
    await openAccountMenu("Ahmad Karimi");
    await page.getByTestId("menu-mode-buyer").click();
    await expect(page).toHaveURL(/\/en\/bazaar/, { timeout: 30_000 });
    await openAccountMenu("Ahmad Karimi");
    await page.getByRole("menuitem", { name: /^Saved$/i }).click();
    await expect(page.getByText("Samsung 4K TV")).toBeVisible({ timeout: 30_000 });

    // ── Hand the browser over, without ever reloading ────────────────────────
    await openAccountMenu("Ahmad Karimi");
    await page.getByRole("menuitem", { name: /Sign Out/i }).click();
    // Signing out ON an auth-only page (Saved) lands on the login page by itself:
    // <RequireAuth> sends the now-guest to /login?next=/saved. (This used to
    // click the header's Login link, which that redirect swaps out mid-click and
    // which the header never shows on /login — a timeout every run.)
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });

    // ── User B: must start from nothing, not from A's cached rows ────────────
    await signIn("empty@hatiwal.test");
    await openAccountMenu("Sahar Noor");
    await page.getByRole("menuitem", { name: /^Saved$/i }).click();
    await expect(page.getByText("Samsung 4K TV")).toHaveCount(0);
    await expect(page.getByText("Winter Jacket")).toHaveCount(0);
  });
});

// ── Show / hide password (web UI/UX QA #28) ─────────────────────────────────

test.describe("Password visibility toggle", () => {
  test("login: shows and hides the password, without submitting", async ({ page }) => {
    await page.goto("/en/login");
    const field = page.locator("#password");
    const toggle = page.getByRole("button", { name: "Show password" });
    await field.fill("Secret123!");
    await expect(field).toHaveAttribute("type", "password");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    await toggle.click();
    await expect(field).toHaveAttribute("type", "text");
    await expect(field).toHaveValue("Secret123!");
    const hide = page.getByRole("button", { name: "Hide password" });
    await expect(hide).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/\/en\/login$/); // not a submit

    await hide.click();
    await expect(field).toHaveAttribute("type", "password");
    // 44px touch target.
    const box = (await toggle.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test("signup: each field has its own toggle", async ({ page }) => {
    await page.goto("/en/signup");
    await expect(page.getByTestId("password-toggle")).toHaveCount(2);
    await page.getByTestId("password-toggle").nth(1).click();
    await expect(page.locator("#passwordConfirmation")).toHaveAttribute("type", "text");
    await expect(page.locator("#password")).toHaveAttribute("type", "password");
  });

  for (const [locale, show] of [
    ["fa", "نمایش رمز عبور"],
    ["ps", "پټنوم ښکاره کړئ"],
    // ur has its copy too, but the locale is hidden on web (/ur → /en).
  ] as const) {
    test(`${locale}: translated, and on the inline end (the left) of the field`, async ({ page }) => {
      await page.goto(`/${locale}/login`);
      const toggle = page.getByRole("button", { name: show });
      await expect(toggle).toBeVisible();
      const field = (await page.locator("#password").boundingBox())!;
      const t = (await toggle.boundingBox())!;
      expect(t.x + t.width / 2).toBeLessThan(field.x + field.width / 2);
    });
  }
});
