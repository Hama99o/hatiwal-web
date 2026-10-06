import { test, expect } from "@playwright/test";

/**
 * Dari digits (owner, option 2). Zain draws ۰–۹ with the same outlines as
 * 0–9, so /fa leads its font stack with a digits-only face (Noto Sans Arabic,
 * unicode-range U+0660-0669, U+066B-066C, U+06F0-06F9). This asserts the
 * codepoints and the stack order; that the digits LOOK Persian is a visual
 * check Playwright can't make.
 */
test("/fa: prices carry Persian digits and the digits face leads the font stack", async ({ page }) => {
  await page.goto("/fa/shops/42");
  await page.getByTestId("shop-tab-products").click().catch(() => undefined);
  await expect(page.getByText(/[۰-۹]/).first()).toBeVisible();
  const { digitsVar, family, rangeOk } = await page.evaluate(async () => {
    const root = getComputedStyle(document.documentElement);
    const digitsVar = root.getPropertyValue("--font-digits").split(",")[0].trim();
    const family = getComputedStyle(document.body).fontFamily;
    await document.fonts.ready;
    const face = [...document.fonts].find((f) => f.family.replace(/['"]/g, "") === digitsVar.replace(/['"]/g, ""));
    return { digitsVar, family, rangeOk: face?.unicodeRange ?? "" };
  });
  expect(digitsVar).not.toBe("");
  const unquote = (v: string) => v.replace(/['"]/g, "");
  expect(unquote(family.split(",")[0].trim())).toBe(unquote(digitsVar));
  expect(rangeOk.toUpperCase()).toContain("U+6F0-6F9");
});

test("/ps and /en don't use the digits face first", async ({ page }) => {
  for (const l of ["ps", "en"]) {
    await page.goto(`/${l}`);
    const lead = await page.evaluate(() => {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--font-digits").split(",")[0].trim();
      const first = getComputedStyle(document.body).fontFamily.split(",")[0].trim();
      return first.replace(/['"]/g, "") === v.replace(/['"]/g, "");
    });
    expect(lead).toBe(false);
  }
});
