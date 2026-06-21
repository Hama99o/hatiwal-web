import { test, expect } from "@playwright/test";

// Privacy + account-deletion pages are App Store / Google Play requirements and
// must render in all three locales.
test.describe("Legal / static pages", () => {
  for (const locale of ["en", "ps", "fa"] as const) {
    test(`privacy policy renders (${locale})`, async ({ page }) => {
      const resp = await page.goto(`/${locale}/privacy`);
      expect(resp?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // Contact email is shown for out-of-app deletion requests.
      await expect(page.getByText("support@hatiwal.app").first()).toBeVisible();
    });

    test(`delete-account page renders (${locale})`, async ({ page }) => {
      const resp = await page.goto(`/${locale}/delete-account`);
      expect(resp?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText("support@hatiwal.app").first()).toBeVisible();
    });
  }

  test("privacy is reachable from the footer", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("contentinfo").getByRole("link", { name: "Privacy Policy" }).click();
    await expect(page).toHaveURL(/\/privacy/);
    await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  });
});
