import { test, expect } from "@playwright/test";

test.describe("Seller profile", () => {
  test("shows the seller and their active listings", async ({ page }) => {
    await page.goto("/en/sellers/1");
    await expect(page.getByText("Ahmad Karimi").first()).toBeVisible();
    // Count + label render as separate nodes ("3" / "Active listings").
    await expect(page.getByText("3", { exact: true })).toBeVisible();
    await expect(page.getByText("Active listings").first()).toBeVisible();
    // Seller 1 owns iPhone, MacBook, Toyota (all active).
    await expect(page.getByText("iPhone 13 Pro")).toBeVisible();
    await expect(page.getByText("MacBook Pro M2")).toBeVisible();
    await expect(page.getByText("Toyota Corolla 2015")).toBeVisible();
    // Not seller 1's items.
    await expect(page.getByText("Samsung 4K TV")).toHaveCount(0);
  });

  test("a different seller shows their own listings", async ({ page }) => {
    await page.goto("/en/sellers/2");
    await expect(page.getByText("Sara Ahmadi").first()).toBeVisible();
    await expect(page.getByText("Samsung 4K TV")).toBeVisible();
    await expect(page.getByText("iPhone 13 Pro")).toHaveCount(0);
  });

  test("Share and Report are a matched, thumb-sized pair", async ({ page }) => {
    // They sit side by side in one row, so a size mismatch is visible: Share
    // defaults to the component's `sm` (36px) and is passed `default` here to
    // match the 40px Report beside it — and to clear the touch-target floor.
    await page.goto("/en/sellers/2");
    const share = page.getByRole("button", { name: /Share|Copy link/i });
    const report = page.getByRole("button", { name: "Report", exact: true });
    await expect(share).toBeVisible();
    await expect(report).toBeVisible();
    const shareBox = (await share.boundingBox())!;
    const reportBox = (await report.boundingBox())!;
    expect(shareBox.height).toBeGreaterThanOrEqual(40);
    expect(reportBox.height).toBeGreaterThanOrEqual(40);
    expect(shareBox.height).toBe(reportBox.height);
  });
});
