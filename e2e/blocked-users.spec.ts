import { test, expect } from "@playwright/test";
import { BUYER_STATE, EMPTY_STATE } from "./auth-paths";

test.describe("Blocked users", () => {
  test.use({ storageState: BUYER_STATE });

  test("lists blocked users with an unblock action", async ({ page }) => {
    await page.goto("/en/settings/blocked-users");
    await expect(
      page.getByRole("heading", { name: "Blocked Users" }),
    ).toBeVisible();
    await expect(page.getByText("Najib Rahimi")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Unblock/i }),
    ).toBeVisible();
  });

  test("unblocking shows a confirmation toast", async ({ page }) => {
    await page.goto("/en/settings/blocked-users");
    const unblock = page.getByRole("button", { name: /Unblock/i }).first();
    await expect(unblock).toBeVisible();
    // Retry click+assert: the button renders before the island hydrates, so a
    // single click can land before the handler is attached. (Unblock is
    // idempotent — the stateless mock keeps returning the same blocked user.)
    await expect(async () => {
      await unblock.click();
      await expect(page.getByText("User unblocked.")).toBeVisible({
        timeout: 3000,
      });
    }).toPass({ timeout: 20_000 });
  });
});

test.describe("Blocked users (empty)", () => {
  test.use({ storageState: EMPTY_STATE });

  test("shows the empty state", async ({ page }) => {
    await page.goto("/en/settings/blocked-users");
    await expect(page.getByText("No blocked users")).toBeVisible();
  });
});
