import { test, expect } from "@playwright/test";

test.describe("Localization + RTL", () => {
  test("English is LTR with English hero", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { name: "Buy and sell locally in Afghanistan" })).toBeVisible();
  });

  test("Pashto is RTL with translated hero", async ({ page }) => {
    await page.goto("/ps");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ps");
    await expect(page.getByText("په افغانستان کې محلي پیر او پلور وکړئ")).toBeVisible();
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
