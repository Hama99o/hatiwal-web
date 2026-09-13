import { test, expect } from "@playwright/test";

test.describe("Localization + RTL", () => {
  test("English is LTR with English hero", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    // Matched as a PREFIX, not the whole line. The hero names the countries we
    // serve and that list grows — it already went from "Afghanistan" to
    // "Afghanistan and Pakistan". Pinning the full sentence makes this test fail
    // on a copy edit and say nothing useful about LTR, which is what it tests.
    await expect(
      page.getByRole("heading", { name: /^Buy and sell locally in/ })
    ).toBeVisible();
  });

  test("Pashto is RTL with translated hero", async ({ page }) => {
    await page.goto("/ps");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ps");
    // This DID break, where the English one above did not, and the difference is
    // instructive: in English "and Pakistan" is a SUFFIX, so Playwright's
    // substring matching still found the old string. In Pashto "او پاکستان" is
    // an INFIX — it lands in the middle — so the old sentence no longer occurs
    // anywhere in the page and an exact match could not survive.
    //
    // Anchored on the stable opening instead, which carries what the test is
    // actually for: Pashto copy is rendering at all.
    await expect(page.getByText(/^په افغانستان/)).toBeVisible();
  });

  test("Dari is RTL", async ({ page }) => {
    await page.goto("/fa");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  });

  test("language switcher changes locale + direction", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: "Language" }).click();
    await page.getByRole("menuitem", { name: "پښتو" }).click();
    await expect(page).toHaveURL(/\/ps(\/|$)/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });
});

test.describe("Dark mode", () => {
  test("theme toggle flips the html theme class", async ({ page }) => {
    await page.goto("/en");
    const html = page.locator("html");
    const initiallyDark = ((await html.getAttribute("class")) || "").includes("dark");
    await page.getByRole("button", { name: "Toggle theme" }).click();
    if (initiallyDark) {
      await expect(html).not.toHaveClass(/dark/);
    } else {
      await expect(html).toHaveClass(/dark/);
    }
  });
});
