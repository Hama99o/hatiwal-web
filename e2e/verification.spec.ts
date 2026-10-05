import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE, EMPTY_STATE } from "./auth-paths";

/**
 * VER-1 on the web: the Profile status card and the 9-step apply flow, with
 * the same testids as mobile (hatiwal-mobile maestro/verification). The mock
 * API is stateless (see e2e/mock-api/server.mjs): the buyer persona may apply,
 * the empty persona has no profile photo.
 */
const PHOTO = "e2e/fixtures/photo-a.png";

async function addPhoto(page: Page) {
  await page.getByTestId("verify-photo-input").setInputFiles(PHOTO);
  await expect(page.getByTestId("verify-photo-preview")).toBeVisible();
  await page.getByTestId("verify-photo-use").click();
}

test.describe("Get verified (signed in, eligible)", () => {
  test.use({ storageState: BUYER_STATE });

  test("applies with a two-sided e-Tazkira and lands on Under review", async ({ page }) => {
    await page.goto("/en/profile");
    await expect(page.getByTestId("verify-card-status-none")).toBeVisible();
    await page.getByTestId("verify-start").click();
    await expect(page).toHaveURL(/\/en\/profile\/verify$/);

    // 7 steps until a two-sided document adds its back.
    await expect(page.getByTestId("verify-progress-label")).toHaveText("Step 1 of 7");
    await page.getByTestId("verify-next").click();

    await page.getByTestId("verify-doc-e_tazkira").click();
    await expect(page.getByTestId("verify-progress-label")).toHaveText("Step 2 of 8");
    await page.getByTestId("verify-next").click();

    await expect(page.getByText("Only the Hatiwal team sees this. We delete it after the check.")).toBeVisible();
    await page.getByTestId("verify-next").click();

    await addPhoto(page); // front
    await addPhoto(page); // back (e-Tazkira is two-sided)
    await addPhoto(page); // selfie

    await page.getByTestId("verify-last4-input").fill("4821");
    await page.getByTestId("verify-next").click();

    await expect(page.getByTestId("verify-review-photos").locator("img")).toHaveCount(3);
    await page.getByTestId("verify-submit").click();
    await expect(page.getByTestId("verify-under-review")).toBeVisible();
  });

  test("a one-sided passport skips the back", async ({ page }) => {
    await page.goto("/en/profile/verify");
    await page.getByTestId("verify-next").click();
    await page.getByTestId("verify-doc-passport").click();
    await page.getByTestId("verify-next").click();
    await page.getByTestId("verify-next").click();
    await expect(page.getByTestId("verify-progress-label")).toHaveText("Step 4 of 7");
    await addPhoto(page);
    await expect(page.getByRole("heading", { name: "Take a selfie" })).toBeVisible();
  });

  test("the last 4 digits must be exactly 4", async ({ page }) => {
    await page.goto("/en/profile/verify");
    await page.getByTestId("verify-next").click();
    await page.getByTestId("verify-doc-passport").click();
    await page.getByTestId("verify-next").click();
    await page.getByTestId("verify-next").click();
    await addPhoto(page);
    await addPhoto(page);
    await page.getByTestId("verify-last4-input").fill("12");
    await expect(page.getByTestId("verify-last4-error")).toBeVisible();
    await expect(page.getByTestId("verify-next")).toBeDisabled();
    // Persian digits are accepted and stored as ASCII.
    await page.getByTestId("verify-last4-input").fill("۴۸۲۱");
    await expect(page.getByTestId("verify-last4-input")).toHaveValue("4821");
    await expect(page.getByTestId("verify-next")).toBeEnabled();
  });

  test("is right-to-left in Pashto", async ({ page }) => {
    await page.goto("/ps/profile/verify");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "ولې تایید شئ؟" })).toBeVisible();
  });
});

test.describe("Get verified (not eligible yet)", () => {
  test.use({ storageState: EMPTY_STATE });

  test("says what is missing instead of offering the flow", async ({ page }) => {
    await page.goto("/en/profile");
    await expect(page.getByTestId("verify-missing-avatar")).toBeVisible();
    await expect(page.getByTestId("verify-start")).toHaveCount(0);
  });
});
