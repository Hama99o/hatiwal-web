import { test, expect } from "@playwright/test";
import { BUYER_STATE, EMPTY_STATE } from "./auth-paths";
import { hold } from "./route-gate";

test.describe("Saved listings", () => {
  test.use({ storageState: BUYER_STATE });

  test("shows the buyer's favorited listings", async ({ page }) => {
    await page.goto("/en/saved");
    await expect(page.getByRole("heading", { name: "Saved" })).toBeVisible();
    await expect(page.getByText("Samsung 4K TV")).toBeVisible();
    await expect(page.getByText("Winter Jacket")).toBeVisible();
  });
});

test.describe("Saved listings (empty)", () => {
  test.use({ storageState: EMPTY_STATE });

  test("shows the empty state", async ({ page }) => {
    await page.goto("/en/saved");
    await expect(page.getByText("No saved items yet")).toBeVisible();
    await expect(
      page.getByText("Tap the heart on any listing to save it here"),
    ).toBeVisible();
  });
});

test.describe("Saved listings (guest)", () => {
  test("redirects an unauthenticated visitor to login", async ({ page }) => {
    await page.goto("/en/saved");
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });
});

test.describe("The save heart on an ISR page", () => {
  // No storageState: the shape most home-page visits have.
  test("stops waiting on a probe that never answers", async ({ page }) => {
    // The listing and seller pages are `force-dynamic`, so they publish the
    // server's answer to "who is this?" and every heart on them is settled from
    // the first paint (`ViewerIdProvider` → `useServerViewerId`). The home feed
    // cannot: it is ISR, which may not read cookies, so its hearts have no answer
    // in the tree and genuinely have to wait for /api/auth/session. If that probe
    // HANGS — dead mobile network, captive portal, normal in this market — it
    // never rejects, so the retry loop in auth-provider.tsx never gets a turn and
    // the heart used to announce itself pending forever, with no way to recover.
    // Aborting the probe is not the fix (it rotates the session token — see the
    // listing-action-bar spec); the fix is that after a budget the heart stops
    // claiming to know nothing and renders the guest state, whose tap goes to
    // /login. Never applied where the server DID answer: a viewer the server said
    // is signed in must not be demoted to guest markup by a slow probe.
    await hold(page, "**/api/auth/session"); // never released
    await page.goto("/en");
    const heart = page.getByRole("button", { name: /save/i }).first();
    await expect(heart).toBeVisible();
    // Honest while there is still time for an answer.
    await expect(heart).toHaveAttribute("aria-busy", "true");
    // ...and settled once there is not. 8s budget + margin for the dev compile.
    await expect(heart).toHaveAttribute("aria-pressed", "false", {
      timeout: 20_000,
    });
    expect(await heart.evaluate((el) => el.hasAttribute("aria-busy"))).toBe(
      false,
    );
    // The recoverable path a guest needs, instead of a dead control.
    await heart.click();
    await expect(page).toHaveURL(/\/en\/login/);
  });
});
