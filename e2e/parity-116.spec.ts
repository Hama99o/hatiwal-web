import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE, EMPTY_STATE } from "./auth-paths";
import ps from "../messages/ps.json";

/*
 * Web = app parity for 1.1.6 (sweep 2026-10-08). Each test pins one gap the
 * sweep found and fixed against mobile (the reference):
 *   - Activity: "Share my profile" (mobile profile-share-mine).
 *   - Inbox: the permanent "Hatiwal Support" entry (mobile SupportEntryRow).
 *   - An expired RESERVED listing: Relaunch first, under Expired (mobile reads
 *     `listing.expired` for both active and reserved).
 *   - The expiry pill: a quiet "Expires in N days" (mobile: always shown).
 *   - The verification card: Resend for an unconfirmed email (mobile).
 *   - Settings: the province in the reader's language.
 *
 * BUYER_STATE = user 1 (seller of listings 1 and 10; province Kabul).
 */

/** GET this owner listing with some fields changed (the mock is stateless). */
async function patchMyListing(page: Page, id: number, patch: Record<string, unknown>) {
  await page.route(`**/api/me/my/listings/${id}`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    const json = await res.json();
    json.listing = { ...json.listing, ...patch };
    await route.fulfill({ response: res, json });
  });
}

test.describe("Profile → Activity", () => {
  test.use({ storageState: BUYER_STATE });

  test("Share my profile shares the public profile's link", async ({ page }) => {
    await page.goto("/en/profile/activity");
    const share = page.getByTestId("profile-share-mine");
    await expect(share).toBeVisible({ timeout: 45_000 });
    await expect(share).toContainText(/Share my profile/);
    await expect(share).toHaveAttribute("data-share-url", /\/en\/sellers\/1$/);
  });

  test("ps: Share my profile in Pashto", async ({ page }) => {
    await page.goto("/ps/profile/activity");
    await expect(page.getByTestId("profile-share-mine")).toContainText(ps.profile.quickActions.shareMyProfile, { timeout: 45_000 });
  });
});

test.describe("The inbox's Support entry", () => {
  test.use({ storageState: EMPTY_STATE });

  test("no Support thread yet: the entry is there, and opens (creates) the thread", async ({ page }) => {
    await page.goto("/en/conversations");
    const entry = page.getByTestId("support-entry-row");
    await expect(entry).toBeVisible({ timeout: 45_000 });
    await expect(entry).toContainText("Hatiwal Support");
    await expect(entry).toContainText("Questions or a problem? Message our team");
    // Through the REAL web proxy (no page.route): it must be allow-listed, or
    // every "Contact support" on the web 403s (it did until 2026-10-08).
    const post = page.waitForResponse((r) => r.url().includes("/support_conversation") && r.request().method() === "POST");
    await entry.click();
    expect((await post).status()).toBe(200);
    await expect(page).toHaveURL(/\/en\/conversations\/990$/, { timeout: 30_000 });
  });

  test("ps: the entry reads in Pashto", async ({ page }) => {
    await page.goto("/ps/conversations");
    await expect(page.getByTestId("support-entry-row")).toContainText(ps.chat.support.entrySubtitle, { timeout: 45_000 });
  });
});

test.describe("Expiry", () => {
  test.use({ storageState: BUYER_STATE });

  test("an expired RESERVED listing offers Relaunch first, not Mark as sold", async ({ page }) => {
    await patchMyListing(page, 10, { status: "reserved" });
    await page.goto("/en/my-listings/10");
    await expect(page.getByRole("button", { name: "Relaunch" })).toBeVisible({ timeout: 45_000 });
  });

  test("a listing with weeks left shows a quiet 'Expires in N days'", async ({ page }) => {
    await patchMyListing(page, 1, { expires_at: new Date(Date.now() + 40 * 86_400_000).toISOString(), expired: false });
    await page.goto("/en/my-listings/1");
    await expect(page.getByText(/Expires in 40 days/)).toBeVisible({ timeout: 45_000 });
  });
});

test.describe("The verification card", () => {
  test.use({ storageState: BUYER_STATE });

  test("an unconfirmed email has its fix in place: Resend", async ({ page }) => {
    await page.route("**/api/me/verification_requests/current*", (route) =>
      route.fulfill({
        status: 200,
        json: {
          verification_status: {
            status: "none", verified_since: null, missing: ["email_confirmed"], reason: null,
            name_changed: false, request: null, can_apply: true,
          },
        },
      }),
    );
    await page.route("**/api/me/auth/confirmation", (route) => route.fulfill({ status: 200, json: {} }));
    await page.goto("/en/profile");
    const resend = page.getByTestId("verify-resend-email");
    await expect(resend).toBeVisible({ timeout: 45_000 });
    const post = page.waitForRequest((r) => r.url().includes("/auth/confirmation") && r.method() === "POST");
    await resend.click();
    await post;
  });
});

test.describe("Settings", () => {
  test.use({ storageState: BUYER_STATE });

  test("ps: the province reads in Pashto, not 'Kabul'", async ({ page }) => {
    await page.goto("/ps/profile/settings");
    const settings = page.getByTestId("profile-settings-page");
    await expect(settings).toBeVisible({ timeout: 45_000 });
    // The province row (the city row is free text and stays as typed).
    await expect(settings.getByText("کابل")).toBeVisible();
  });
});
