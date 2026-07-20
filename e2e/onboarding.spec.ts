import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

test.describe("First-run onboarding", () => {
  test.use({ storageState: BUYER_STATE });

  test("shows the welcome modal to a new user and dismisses it", async ({
    page,
  }) => {
    // Simulate a brand-new user by clearing the "seen" flag before the app runs.
    await page.addInitScript(() =>
      window.localStorage.removeItem("hatiwal.onboarded"),
    );
    await page.goto("/en");

    // The welcome modal appears for the logged-in, not-yet-onboarded user.
    await expect(
      page.getByRole("heading", { name: "Welcome to Hatiwal" }),
    ).toBeVisible();

    // "Get started" dismisses it and records that it's been seen.
    await page.getByRole("button", { name: "Get started" }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome to Hatiwal" }),
    ).toHaveCount(0);
  });

  test("does NOT show for a returning user (flag already set)", async ({
    page,
  }) => {
    // The BUYER_STATE storage already carries hatiwal.onboarded, so the default
    // (no init-script) navigation must not surface the modal.
    await page.goto("/en");
    await expect(page.getByText("Buy and sell locally in Afghanistan")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Welcome to Hatiwal" }),
    ).toHaveCount(0);
  });
});
