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
    // ...and settled once there is not. The budget is DERIVED from the probe's
    // backoff ladder in auth-provider.tsx (12s today: 1.5+3+4.5s of retries plus
    // 3s), so it must not be retyped here either — the margin below is for that
    // plus a cold dev compile.
    await expect(heart).toHaveAttribute("aria-pressed", "false", {
      timeout: 25_000,
    });
    expect(await heart.evaluate((el) => el.hasAttribute("aria-busy"))).toBe(
      false,
    );
    // The recoverable path a guest needs, instead of a dead control.
    await heart.click();
    await expect(page).toHaveURL(/\/en\/login/);
  });
});

test.describe("The save heart on an ISR page (signed in)", () => {
  test.use({ storageState: BUYER_STATE });

  test("holds a tap, and its last-resort /login can be walked back", async ({
    page,
  }) => {
    // The other viewer of the case above, and the one that regressed: a SIGNED-IN
    // buyer on the home feed. The page is ISR, so it publishes no viewer hint and
    // `hatiwal_viewer_id` is httpOnly — page JS provably cannot tell "signed in,
    // probe hung" from "guest, probe hung" — which is why the budget still
    // releases here (holding forever is the dead control the spec above pins).
    //
    // Two things therefore have to hold, and neither did:
    //  1. WHILE there is still time for an answer, the tap is HELD, not run
    //     against `status === "loading"`. It used to be released by the budget
    //     into a `run()` that read `!authed` as "guest" and pushed the buyer to
    //     /login — a signed-in buyer's save turned into a sign-in redirect.
    //     `identityUnresolved` is part of `pending` in its own right now
    //     (save-button.tsx), so nothing runs before the budget.
    //  2. The fallback is RECOVERABLE. `?next=` sends them back to the feed —
    //     `login-form.tsx` bounces an already-authed visitor straight there — so
    //     the worst case costs a round trip, not the buyer's place in the feed.
    const saveCalls: string[] = [];
    page.on("request", (req) => {
      if (/\/api\/me\/listings\/\d+\/(save|unsave)$/.test(new URL(req.url()).pathname))
        saveCalls.push(req.method());
    });
    await hold(page, "**/api/auth/session"); // never released
    await page.goto("/en");
    const heart = page.getByRole("button", { name: /save/i }).first();
    await expect(heart).toBeVisible();
    await expect(heart).toHaveAttribute("aria-busy", "true");

    await heart.click();
    // Accepted and remembered, not guessed: no save request, and no navigation
    // while the answer could still arrive.
    await expect(heart).toHaveAttribute("aria-disabled", "true");
    expect(saveCalls).toEqual([]);
    await expect(page).toHaveURL(/\/en$/);

    // At the budget the honest answer is "we cannot know", so the heart falls back
    // to the guest path — but it must carry the way back.
    await expect(page).toHaveURL(/\/en\/login\?next=%2F$/, { timeout: 25_000 });
    expect(saveCalls).toEqual([]);
  });
});
