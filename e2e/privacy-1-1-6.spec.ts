import { test, expect } from "@playwright/test";

/**
 * The 1.1.6 privacy policy (DRAFT until the owner approves): the three new
 * sections render in Pashto, right-to-left, with the brand spelled هټیوال and
 * the facts that match what 1.1.6 ships (e-Tazkira only, a shop's proof of
 * business, photos deleted after 90 days, the number kept encrypted, buyers see
 * the shop and never the owner's personal details; no shop-team sentence).
 */
test("the 1.1.6 sections render in ps (هټیوال)", async ({ page }) => {
  await page.goto("/ps/privacy");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByText("وروستی تازه: د ۲۰۲۶ اکتوبر")).toBeVisible();
  for (const title of ["تایید کېدل (اختیاري)", "ستاسو ځای", "دوکانونه"]) {
    await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
  }
  const body = page.locator("main, body").first();
  await expect(body).toContainText("هټیوال");
  await expect(body).toContainText("برېښنايي تذکره");
  await expect(body).toContainText("۹۰");
  await expect(body).toContainText("د دوکان په چټونو کې پیرودونکي د دوکان نوم او لوګو ویني");
  // The team (SHOP-3) is not in 1.1.6.
  await expect(body).not.toContainText("ټیم");
});
