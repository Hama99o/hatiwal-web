import { test, expect } from "@playwright/test";

/**
 * The "confirm your email" prompt on Profile.
 *
 * Driven by `user.emailConfirmed`, which the API sends as `email_confirmed` on the
 * `:me` serializer view and the session route camelCases. The seeded accounts are
 * confirmed, so the DEFAULT expectation is that the banner is ABSENT — which is
 * the assertion worth having in CI: it catches the prompt reappearing for people
 * who have already confirmed, which would be a standing false alarm on every
 * profile visit.
 *
 * The unconfirmed case is covered where it can be controlled: the mobile unit
 * tests (ConfirmEmailBanner.test.tsx) drive the flag directly, and the API specs
 * cover the confirm/resend endpoints. Making a real account unconfirmed from here
 * would mean mutating shared seed data that every other spec depends on.
 */
test.describe("Confirm-email banner", () => {
  test("is absent for a confirmed account", async ({ page }) => {
    await page.goto("/en/profile");
    await expect(page.getByTestId("confirm-email-banner")).toHaveCount(0);
  });

  test("does not break the profile page it sits on", async ({ page }) => {
    await page.goto("/en/profile");
    // The page still renders its own content — i.e. the banner's early return did
    // not take the surrounding tree with it.
    await expect(page).toHaveURL(/\/en\/profile/);
    await expect(page.locator("body")).not.toHaveText(/Application error/i);
  });
});

/**
 * The page the confirmation email actually lands on.
 *
 * The API confirms the token and redirects to WEB_CONFIRM_URL
 * (/email-confirmed). That route did not exist, so a user who had just
 * successfully confirmed was shown a 404 — the account was fine and the page said
 * otherwise. These tests exist to stop it disappearing again.
 */
test.describe("Email-confirmed landing page", () => {
  test("shows a success state when the API reports success", async ({ page }) => {
    await page.goto("/en/email-confirmed?account_confirmation_success=true");
    await expect(page.getByRole("heading")).toContainText(/confirmed/i);
  });

  // A stale or already-used link is a normal thing to hit; it needs a way forward,
  // not a dead end.
  test("shows a recoverable failure state when the API reports failure", async ({ page }) => {
    await page.goto("/en/email-confirmed?account_confirmation_success=false");
    await expect(page.getByRole("heading")).toContainText(/could not confirm/i);
    await expect(page.getByRole("link", { name: /profile/i })).toBeVisible();
  });

  // Devise omits the flag in some paths; absent must not read as failure.
  test("treats an absent flag as success, not failure", async ({ page }) => {
    await page.goto("/en/email-confirmed");
    await expect(page.getByRole("heading")).toContainText(/confirmed/i);
  });

  test("is reachable in every locale", async ({ page }) => {
    for (const locale of ["en", "ps", "fa"]) {
      const res = await page.goto(`/${locale}/email-confirmed`);
      expect(res?.status(), `${locale} should not 404`).toBeLessThan(400);
    }
  });
});
