import { test, expect } from "@playwright/test";
import { BUYER_STATE, EMPTY_STATE } from "./auth-paths";

test.describe("Conversations inbox", () => {
  test.use({ storageState: BUYER_STATE });

  test("lists conversations with participant + listing", async ({ page }) => {
    await page.goto("/en/conversations");
    await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible();
    await expect(page.getByText("Sara Ahmadi")).toBeVisible();
    await expect(page.getByText("Is this still available?")).toBeVisible();
    await expect(page.getByText("Najib Rahimi")).toBeVisible();
    await expect(page.locator('a[href*="/conversations/"]')).toHaveCount(2);
  });

  test("opening a conversation goes to its thread", async ({ page }) => {
    await page.goto("/en/conversations");
    await page.locator('a[href*="/conversations/1"]').first().click();
    await expect(page).toHaveURL(/\/conversations\/1/);
    await expect(page.getByPlaceholder("Type a message...")).toBeVisible();
  });
});

test.describe("Conversations inbox (empty)", () => {
  test.use({ storageState: EMPTY_STATE });

  test("shows the empty state", async ({ page }) => {
    await page.goto("/en/conversations");
    await expect(page.getByText("No conversations yet")).toBeVisible();
  });
});

test.describe("Conversations (guest)", () => {
  test("redirects an unauthenticated visitor to login", async ({ page }) => {
    await page.goto("/en/conversations");
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });
});
