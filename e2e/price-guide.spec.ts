import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

/**
 * IDEA-4 price guide (hatiwal-mobile docs/design/PRICE_GUIDE.md): on the Sell
 * form, under the price, "Similar items sold for 8,000–11,000 AFN · based on 7
 * sales" — only when the server published a range for this subcategory +
 * currency. Hidden otherwise; the app's digits in ps/fa.
 */
const category = (page: Page) => page.getByLabel("Category", { exact: true });
const line = (page: Page) => page.getByTestId("price-guide-line");

test.use({ storageState: BUYER_STATE });

test("a published bucket: the range and the count under the price", async ({ page }) => {
  await page.goto("/en/listings/new");
  await category(page).selectOption({ label: "Phones & Tablets" });
  await expect(line(page)).toHaveText("Similar items sold for 8,000–11,000 AFN · based on 7 sales");
});

test("another currency or a category without enough sales: nothing", async ({ page }) => {
  await page.goto("/en/listings/new");
  await category(page).selectOption({ label: "Phones & Tablets" });
  await expect(line(page)).toBeVisible();
  await page.locator("#currency").selectOption("PKR");
  await expect(line(page)).toHaveCount(0);
  await page.locator("#currency").selectOption("AFN");
  await category(page).selectOption({ label: "Vehicles" });
  await expect(line(page)).toHaveCount(0);
});

test("no category yet: nothing", async ({ page }) => {
  await page.goto("/en/listings/new");
  await expect(page.locator("#price")).toBeVisible();
  await expect(line(page)).toHaveCount(0);
});

test("in Dari: the app's own digits", async ({ page }) => {
  await page.goto("/fa/listings/new");
  await page.locator("#categoryId").selectOption({ value: "101" });
  await expect(line(page)).toContainText("۸٬۰۰۰");
  await expect(line(page)).toContainText("۱۱٬۰۰۰");
});
