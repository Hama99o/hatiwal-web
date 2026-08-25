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
