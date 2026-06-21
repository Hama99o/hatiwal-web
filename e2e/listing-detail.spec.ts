import { test, expect } from "@playwright/test";

test.describe("Listing detail", () => {
  test("shows full listing info, seller and description", async ({ page }) => {
    await page.goto("/en/listings/1");
    await expect(page.getByRole("heading", { name: "iPhone 13 Pro" })).toBeVisible();
    await expect(page.getByText("AFN 45,000")).toBeVisible();
    await expect(page.getByText("Barely used iPhone 13 Pro, 256GB.")).toBeVisible();
    await expect(page.getByText("Ahmad Karimi")).toBeVisible();
    await expect(page.getByText("Phones & Tablets")).toBeVisible();
    await expect(page.getByText(/12% price drop/i)).toBeVisible();
  });

  test("gated actions are present (Message Seller / Report)", async ({ page }) => {
    await page.goto("/en/listings/1");
    await expect(page.getByText(/Message Seller/i)).toBeVisible();
    await expect(page.getByText(/Report/i).first()).toBeVisible();
  });

  test("unknown listing id returns a 404", async ({ page }) => {
    const resp = await page.goto("/en/listings/99999");
    expect(resp?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  });

  test("a reserved listing is still viewable by direct id", async ({ page }) => {
    const resp = await page.goto("/en/listings/6");
    expect(resp?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Mountain Bike (Reserved)" })).toBeVisible();
  });
});
