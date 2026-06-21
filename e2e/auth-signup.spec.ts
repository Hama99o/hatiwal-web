import { test, expect } from "@playwright/test";

// Registration is public (auto-redirects an already-authed user). No storageState.
test.describe("Signup", () => {
  test("renders the registration form", async ({ page }) => {
    await page.goto("/en/signup");
    await expect(
      page.getByRole("heading", { name: "Create Account" }),
    ).toBeVisible();
    await expect(page.locator("#firstname")).toBeVisible();
    await expect(page.locator("#lastname")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("#passwordConfirmation")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create Account" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Login/i })).toBeVisible();
  });

  test("client-side validation: mismatched passwords", async ({ page }) => {
    await page.goto("/en/signup");
    await page.locator("#firstname").fill("Test");
    await page.locator("#lastname").fill("User");
    await page.locator("#email").fill("new@hatiwal.test");
    await page.locator("#password").fill("Password123!");
    await page.locator("#passwordConfirmation").fill("Different123!");
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page.getByText(/Passwords do not match/i)).toBeVisible();
  });

  test("server rejects a taken email", async ({ page }) => {
    await page.goto("/en/signup");
    await page.locator("#firstname").fill("Test");
    await page.locator("#lastname").fill("User");
    await page.locator("#email").fill("taken@hatiwal.test");
    await page.locator("#password").fill("Password123!");
    await page.locator("#passwordConfirmation").fill("Password123!");
    await page.getByRole("button", { name: "Create Account" }).click();
    // Mock returns 422 with full_messages → surfaced above the form.
    await expect(page.getByText(/already been taken/i)).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("valid registration signs in and leaves signup", async ({ page }) => {
    await page.goto("/en/signup");
    await page.locator("#firstname").fill("Newcomer");
    await page.locator("#lastname").fill("Karimi");
    await page.locator("#email").fill("fresh@hatiwal.test");
    await page.locator("#password").fill("Password123!");
    await page.locator("#passwordConfirmation").fill("Password123!");
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page).not.toHaveURL(/\/signup/, { timeout: 20_000 });
  });
});
