import { test, expect } from "@playwright/test";

test.describe("Auth", () => {
  test("login page renders the form", async ({ page }) => {
    await page.goto("/en/login");
    await expect(page.getByRole("heading", { name: /Welcome to Hatiwal/i })).toBeVisible();
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Sign In/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Register/i })).toBeVisible();
  });

  test("invalid credentials show an error", async ({ page }) => {
    await page.goto("/en/login");
    await page.getByLabel(/Email/i).fill("wrong@example.com");
    await page.getByLabel(/Password/i).fill("badpassword");
    await page.getByRole("button", { name: /Sign In/i }).click();
    // The mock returns 401 → the form surfaces auth.loginError and stays on /login.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/Couldn.t sign in/i).first()).toBeVisible();
  });

  test("a guest visiting Saved is sent to login", async ({ page }) => {
    await page.goto("/en/saved");
    await expect(page.getByRole("button", { name: /Sign In/i })).toBeVisible();
  });

  test("valid credentials log in and leave the login page", async ({ page }) => {
    await page.goto("/en/login");
    await page.getByLabel(/Email/i).fill("buyer@hatiwal.test");
    await page.getByLabel(/Password/i).fill("Password123!");
    await page.getByRole("button", { name: /Sign In/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
