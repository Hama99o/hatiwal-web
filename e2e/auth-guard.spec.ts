import { test, expect } from "@playwright/test";

// Every RequireAuth-gated route must bounce a guest to /login. (profile,
// my-listings, conversations and saved have their own guest tests; this covers
// the rest of the gated surface in one place.)
const GATED = [
  "/en/profile/edit",
  "/en/my-listings/1",
  "/en/listings/new",
  "/en/listings/1/edit",
  "/en/settings/blocked-users",
  "/en/conversations/1",
];

test.describe("Auth guard (guest)", () => {
  for (const path of GATED) {
    test(`guest visiting ${path} is sent to login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    });
  }
});
