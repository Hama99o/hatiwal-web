import { test, expect } from "@playwright/test";

// Edge pass 1.1.6 (d0) — web = app parity: the public profile's stats row has
// the month the person joined (api `member_since_at`, f1fac84), in the reader's
// language, digits and calendar, beside the active listings count. The mock's
// seller 1 joined in October 2025.
test.describe("A public profile's stats row", () => {
  test("English: active listings + 'Joined October 2025'", async ({ page }) => {
    await page.goto("/en/sellers/1");
    await expect(page.getByTestId("seller-stat-listings")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("seller-stat-joined")).toContainText("October 2025");
    await expect(page.getByTestId("seller-stat-joined")).toContainText("Joined");
  });

  for (const locale of ["fa", "ps"]) {
    test(`${locale}: the month in the reader's calendar and Eastern digits, never 'October 2025'`, async ({ page }) => {
      await page.goto(`/${locale}/sellers/1`);
      const joined = page.getByTestId("seller-stat-joined");
      await expect(joined).toBeVisible({ timeout: 45_000 });
      await expect(joined).toContainText(/[۰-۹]{4}/);
      await expect(joined).not.toContainText(/October|2025/);
      await expect(page.getByTestId("seller-stat-listings")).not.toContainText(/[0-9]/);
    });
  }
});
