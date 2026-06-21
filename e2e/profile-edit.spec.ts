import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

test.describe("Edit profile", () => {
  test.use({ storageState: BUYER_STATE });

  test("prefills the form from the current user", async ({ page }) => {
    await page.goto("/en/profile/edit");
    await expect(
      page.getByRole("heading", { name: "Edit Profile" }),
    ).toBeVisible();
    await expect(page.getByLabel(/First Name/i)).toHaveValue("Ahmad");
    await expect(page.getByLabel(/Last Name/i)).toHaveValue("Karimi");
  });

  test("validates a required field", async ({ page }) => {
    await page.goto("/en/profile/edit");
    await page.getByLabel(/First Name/i).fill("");
    await page.getByRole("button", { name: /Save Changes/i }).click();
    await expect(page.getByText(/First name is required/i)).toBeVisible();
    // Stayed on the edit screen.
    await expect(page).toHaveURL(/\/profile\/edit/);
  });

  test("saving changes returns to the profile", async ({ page }) => {
    await page.goto("/en/profile/edit");
    await page.getByLabel(/First Name/i).fill("Ahmadullah");
    await page.getByRole("button", { name: /Save Changes/i }).click();
    await expect(page).toHaveURL(/\/profile\/?$/, { timeout: 20_000 });
  });
});
