import { test, expect } from "@playwright/test";
import { SUPPORT_EMAIL } from "../src/lib/app-links";

// Privacy + account-deletion pages are App Store / Google Play requirements and
// must render in every locale the site serves, with a contact address that can
// actually receive mail (see SUPPORT_EMAIL).
test.describe("Legal / static pages", () => {
  // "ur" is hidden for now (owner, 2026-10-05); add it back with HIDDEN_LOCALES.
  for (const locale of ["en", "ps", "fa"] as const) {
    test(`privacy policy renders (${locale})`, async ({ page }) => {
      const resp = await page.goto(`/${locale}/privacy`);
      expect(resp?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // Contact email is shown for out-of-app deletion requests.
      await expect(page.getByText(SUPPORT_EMAIL).first()).toBeVisible();
      await expect(page.locator(`a[href="mailto:${SUPPORT_EMAIL}"]`).first()).toBeVisible();
    });

    test(`delete-account page renders (${locale})`, async ({ page }) => {
      const resp = await page.goto(`/${locale}/delete-account`);
      expect(resp?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText(SUPPORT_EMAIL).first()).toBeVisible();
      await expect(page.locator(`a[href="mailto:${SUPPORT_EMAIL}"]`).first()).toBeVisible();
    });
  }

  // Prohibited items (owner, 2026-10-13): the API's take-down message links
  // https://hatiwal.com/<locale>/prohibited-items, so it must exist in all three.
  const brand = { en: "Hatiwal", ps: "هټیوال", fa: "هتیوال" } as const;
  for (const locale of ["en", "ps", "fa"] as const) {
    test(`prohibited items page renders (${locale})`, async ({ page }) => {
      const resp = await page.goto(`/${locale}/prohibited-items`);
      expect(resp?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "en" ? "ltr" : "rtl");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByTestId("prohibited-categories").getByRole("heading", { level: 2 })).toHaveCount(11);
      await expect(page.getByTestId("prohibited-allowed")).toBeVisible();
      await expect(page.locator("main, body").first()).toContainText(brand[locale]);
      await expect(page.locator(`a[href="mailto:${SUPPORT_EMAIL}"]`).first()).toBeVisible();
    });
  }

  test("prohibited items names hunting guns and what stays allowed (en)", async ({ page }) => {
    await page.goto("/en/prohibited-items");
    const body = page.locator("main, body").first();
    await expect(body).toContainText("hunting guns included");
    await expect(body).toContainText("Knives, tobacco, cigarettes, naswar and animals");
  });

  test("prohibited items is reachable from the footer", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("contentinfo").getByRole("link", { name: "Prohibited items" }).click();
    await expect(page).toHaveURL(/\/en\/prohibited-items/);
    await expect(page.getByRole("heading", { level: 1, name: "Prohibited items" })).toBeVisible();
  });

  test("privacy is reachable from the footer", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("contentinfo").getByRole("link", { name: "Privacy Policy" }).click();
    await expect(page).toHaveURL(/\/privacy/);
    await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  });
});
