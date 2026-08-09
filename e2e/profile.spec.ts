import { test, expect } from "@playwright/test";
import { BUYER_STATE, EMPTY_STATE } from "./auth-paths";

test.describe("Profile (signed in)", () => {
  test.use({ storageState: BUYER_STATE });

  test("shows the user, stats, and account actions", async ({ page }) => {
    await page.goto("/en/profile");
    await expect(page.getByText("Ahmad Karimi")).toBeVisible();
    // Stats from /users/me (active 3, sold 1, saved 2).
    await expect(page.getByText("Active", { exact: true })).toBeVisible();
    await expect(page.getByText("Sold", { exact: true })).toBeVisible();
    await expect(page.getByText("Saved Items")).toBeVisible();
    await expect(page.getByText("Personal Info")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Edit Profile/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Sign Out/i }),
    ).toBeVisible();
  });

  test("shows your own rating and your reviews (REP815)", async ({ page }) => {
    await page.goto("/en/profile");

    // Your name is the page h1 (the rest of the page hangs off it as h2s).
    await expect(
      page.getByRole("heading", { level: 1, name: "Ahmad Karimi" }),
    ).toBeVisible();

    // Rating summary under your name — from /users/me (avg 4.7, 3 reviews).
    // Exactly once on the page: the "My reviews" section never repeats the
    // score, so it isn't shouted twice.
    await expect(page.getByText("4.7")).toHaveCount(1);
    await expect(page.getByText("3 reviews")).toHaveCount(1);

    // The score is a link to the list, and it announces the score, the count
    // AND the destination (no aria-label swallowing the first two).
    const ratingLink = page.getByRole("link", {
      name: /4\.7\s*3 reviews\s*My reviews/,
    });
    await expect(ratingLink).toBeVisible();
    // Thumb-sized target, not a 20px line of text.
    const box = await ratingLink.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(40);

    // "My reviews" (not the public "Ratings & Reviews" heading) + the list.
    await expect(
      page.getByRole("heading", { name: "My reviews" }),
    ).toBeVisible();
    await expect(
      page.getByText("Item exactly as described, met on time."),
    ).toBeVisible();

    // Role toggle works here too — "As a buyer" has none, so the empty state
    // (role-specific copy, so it never reads as "you have no reviews at all").
    await page.getByRole("tab", { name: "As a buyer" }).click();
    await expect(page.getByText("No buyer reviews yet")).toBeVisible();
  });

  test("View my public profile opens the seller page (REP815)", async ({
    page,
  }) => {
    await page.goto("/en/profile");
    await page
      .getByRole("link", { name: /View my public profile/i })
      .click();
    await expect(page).toHaveURL(/\/sellers\/1/);
    // Other people's view keeps the public heading — unchanged by REP815.
    await expect(
      page.getByRole("heading", { name: "Ratings & Reviews" }),
    ).toBeVisible();
  });

  test("hides the public-profile link once deletion is scheduled (REP815)", async ({
    page,
  }) => {
    // Rails scopes the public profile to `User.publicly_active`, so the link
    // would 404 for an account inside the 30-day deletion window.
    await page.route("**/api/auth/session", async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      if (data?.user) data.user.deletionScheduledAt = "2026-09-01T00:00:00Z";
      await route.fulfill({ response, json: data });
    });

    await page.goto("/en/profile");
    await expect(
      page.getByRole("heading", { name: "My reviews" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /View my public profile/i }),
    ).toHaveCount(0);
  });

  test("Edit Profile navigates to the edit screen", async ({ page }) => {
    await page.goto("/en/profile");
    await page.getByRole("link", { name: /Edit Profile/i }).click();
    await expect(page).toHaveURL(/\/profile\/edit/);
    await expect(
      page.getByRole("heading", { name: "Edit Profile" }),
    ).toBeVisible();
  });
});

test.describe("Profile — brand-new account (no reviews)", () => {
  test.use({ storageState: EMPTY_STATE });

  test("shows a neutral no-rating state, never NaN or 0 stars", async ({
    page,
  }) => {
    await page.goto("/en/profile");
    await expect(
      page.getByRole("heading", { name: "My reviews" }),
    ).toBeVisible();
    // Neutral label under your name — said once, never repeated by the section.
    await expect(page.getByText("No reviews yet")).toHaveCount(1);
    // …and the list's own empty state names the role instead of repeating it.
    await expect(page.getByText("No seller reviews yet")).toBeVisible();
    await expect(page.getByText("NaN")).toHaveCount(0);
    await expect(page.getByText("0.0")).toHaveCount(0);
  });
});

test.describe("Profile (guest)", () => {
  test("redirects an unauthenticated visitor to login", async ({ page }) => {
    await page.goto("/en/profile");
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });
});
