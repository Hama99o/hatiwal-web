import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE, EMPTY_STATE } from "./auth-paths";

/**
 * VER-1 on the web: the Profile status card and the apply flow (e-Tazkira only; a
 * shop adds the proof-of-business step), with
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

  test("applies with the e-Tazkira (front, back, selfie) and lands on Under review", async ({ page }) => {
    await page.goto("/en/profile");
    await expect(page.getByTestId("verify-card-status-none")).toBeVisible();
    await page.getByTestId("verify-start").click();
    await expect(page).toHaveURL(/\/en\/profile\/verify$/);

    // The e-Tazkira is the only document and is two-sided: 8 steps.
    await expect(page.getByTestId("verify-progress-label")).toHaveText("Step 1 of 8");
    await page.getByTestId("verify-next").click();

    await expect(page.getByTestId("verify-doc-e_tazkira")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("radio")).toHaveCount(1);
    await page.getByTestId("verify-next").click();

    await expect(page.getByText("Only the Hatiwal team sees this. We delete it after the check.")).toBeVisible();
    await page.getByTestId("verify-next").click();

    await addPhoto(page); // front
    await addPhoto(page); // back
    await addPhoto(page); // selfie

    await page.getByTestId("verify-number-input").fill("1234564821");
    await page.getByTestId("verify-next").click();

    await expect(page.getByTestId("verify-review-photos").locator("img")).toHaveCount(3);
    await expect(page.getByTestId("verify-review-proof")).toHaveCount(0);
    await page.getByTestId("verify-submit").click();
    await expect(page.getByTestId("verify-under-review")).toBeVisible();
  });

  test("the document number takes letters and digits, 5 to 20, with a digit", async ({ page }) => {
    await page.goto("/en/profile/verify");
    for (let i = 0; i < 3; i++) await page.getByTestId("verify-next").click();
    await addPhoto(page);
    await addPhoto(page);
    await addPhoto(page);
    await page.getByTestId("verify-number-input").fill("ABCDEF");
    await page.getByTestId("verify-number-input").blur();
    await expect(page.getByTestId("verify-number-error")).toBeVisible();
    await expect(page.getByTestId("verify-next")).toBeDisabled();
    // Lower case, separators and Persian digits are normalized like the API.
    await page.getByTestId("verify-number-input").fill("p 12-۳۴۵۶۷");
    await expect(page.getByTestId("verify-number-input")).toHaveValue("P1234567");
    await expect(page.getByTestId("verify-next")).toBeEnabled();
  });

  test("a shop verifies with the person's form + ONE proof-of-business step", async ({ page }) => {
    await page.goto("/en/shops/42/verify");
    // why, document, ready, front, back, selfie, name, proof, review
    await expect(page.getByTestId("shop-verify-progress-label")).toHaveText("Step 1 of 9");
    await expect(page.getByRole("heading", { name: "Why get your shop verified?" })).toBeVisible();
    await page.getByTestId("shop-verify-next").click();
    await expect(page.getByTestId("shop-verify-doc-e_tazkira")).toHaveAttribute("aria-checked", "true");
    await page.getByTestId("shop-verify-next").click();
    await page.getByTestId("shop-verify-next").click();
    await addPhoto(page); // front
    await addPhoto(page); // back
    await addPhoto(page); // selfie
    await page.getByTestId("shop-verify-number-input").fill("1234564821");
    await page.getByTestId("shop-verify-next").click();
    await expect(page.getByRole("heading", { name: "Proof of your business" })).toBeVisible();
    await addPhoto(page); // proof
    await expect(page.getByTestId("shop-verify-review-proof").locator("img")).toHaveCount(1);
    await page.getByTestId("shop-verify-submit").click();
    await expect(page.getByTestId("shop-verify-under-review")).toBeVisible();
    await expect(page.getByTestId("shop-verify-done")).toHaveAttribute("href", "/en/shops/42");
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
