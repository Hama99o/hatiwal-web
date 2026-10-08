import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import { shopEntry, withSessionUser } from "./session-user";

/**
 * Owner rule (1.1.6): a CONFIRMED email before "Open a shop" and before "Get
 * verified" (person + shop). The gate replaces the form; same testids as mobile.
 */
test.use({ storageState: BUYER_STATE });

for (const [path, title] of [
  ["/en/shops/new", "Confirm your email to open a shop"],
  ["/en/profile/verify", "Confirm your email to get verified"],
] as const) {
  test(`${path}: an unconfirmed email sees the gate, not the form`, async ({ page }) => {
    await withSessionUser(page, { emailConfirmed: false });
    await page.goto(path);
    await expect(page.getByTestId("email-confirm-gate")).toBeVisible();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText("We sent a link to buyer@hatiwal.test. Open it, then come back here.")).toBeVisible();
    await expect(page.getByTestId("shop-form-next")).toHaveCount(0);
    await expect(page.getByTestId("verify-next")).toHaveCount(0);
  });
}

test("the shop's verify page is gated too", async ({ page }) => {
  await withSessionUser(page, { emailConfirmed: false, sellerMode: true, shops: [shopEntry(42, "Safi Cosmetics", "active", "owner")] });
  await page.goto("/en/shops/42/verify");
  await expect(page.getByTestId("email-confirm-gate")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Confirm your email to get verified" })).toBeVisible();
});

test("Resend calls the API once, then waits with a countdown", async ({ page }) => {
  await withSessionUser(page, { emailConfirmed: false });
  let calls = 0;
  await page.route("**/api/me/auth/confirmation", (route) => {
    calls += 1;
    return route.fulfill({ json: { success: true } });
  });
  await page.goto("/en/shops/new");
  const resend = page.getByTestId("email-confirm-gate-resend");
  await resend.click();
  await expect(resend).toBeDisabled();
  await expect(resend).toHaveText(/Resend in \d+ seconds/);
  await resend.click({ force: true }).catch(() => undefined);
  expect(calls).toBe(1);
});

test("Change email opens Edit profile", async ({ page }) => {
  await withSessionUser(page, { emailConfirmed: false });
  await page.goto("/en/profile/verify");
  await page.getByTestId("email-confirm-gate-change").click();
  await page.waitForURL("**/en/profile/edit");
});

// Owner, 2026-10-08: the gate offered only Resend / Change email — no way back.
test("the gate has a Back link to Profile, mirrored in RTL", async ({ page }) => {
  await withSessionUser(page, { emailConfirmed: false });
  await page.goto("/ps/shops/new");
  const arrow = page.getByTestId("email-confirm-gate-back").locator("svg");
  await expect(arrow).toHaveCSS("scale", /^-1/);
  await page.goto("/en/shops/new");
  await page.getByTestId("email-confirm-gate-back").click();
  await page.waitForURL("**/en/profile");
});

test("a confirmed account sees the forms", async ({ page }) => {
  await withSessionUser(page, { emailConfirmed: true });
  await page.goto("/en/shops/new");
  await expect(page.getByTestId("shop-form-next")).toBeVisible();
  await expect(page.getByTestId("email-confirm-gate")).toHaveCount(0);
  await page.goto("/en/profile/verify");
  await expect(page.getByTestId("verify-next")).toBeVisible();
  await expect(page.getByTestId("email-confirm-gate")).toHaveCount(0);
});
