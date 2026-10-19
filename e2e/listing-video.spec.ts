import path from "node:path";
import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

/**
 * VID (1.1.9, docs/LISTING_VIDEO.md): the listing video on the web.
 *  - Buyers: a "▶ Video · 0:42" button ON the main photo (owner 2026-10-19 —
 *    never a slide after the photos); nothing loads before the click; one click
 *    opens it full-screen; close goes back. Cards carry only the small ▶.
 *  - Sellers: add a video in the sell form; publishing never waits for it; the
 *    upload runs in the background and the listing then shows the button.
 * The mock API (e2e/mock-api/server.mjs) gives listing 2 a 42 s video.
 */
test.describe("Listing video — buyer", () => {
  test("the main photo carries '▶ Video · 0:42'; one click plays it full-screen; close goes back", async ({ page }) => {
    await page.goto("/en/listings/2");
    const button = page.getByTestId("listing-video-button");
    await expect(button).toBeVisible();
    await expect(button).toHaveText(/Video · 0:42/);
    // Data rule: no <video> on the page until the click.
    await expect(page.locator("video")).toHaveCount(0);

    await button.click();
    const player = page.getByTestId("listing-video-player");
    await expect(player).toBeVisible();
    await expect(player).toHaveAttribute("controls", "");

    await page.getByTestId("listing-video-close").click();
    await expect(player).toHaveCount(0);
    await expect(button).toBeVisible();
  });

  test("a listing without a video has no button", async ({ page }) => {
    await page.goto("/en/listings/1");
    await expect(page.getByTestId("listing-gallery")).toBeVisible();
    await expect(page.getByTestId("listing-video-button")).toHaveCount(0);
  });

  test("is in Pashto digits and RTL on /ps", async ({ page }) => {
    await page.goto("/ps/listings/2");
    await expect(page.getByTestId("listing-video-button")).toHaveText(/ویډیو · ۰:۴۲/);
  });
});

test.describe("Listing video — seller", () => {
  test.use({ storageState: BUYER_STATE });

  test("publishing with a video is not blocked; the upload finishes in the background", async ({ page }) => {
    await page.goto("/en/listings/new");
    await page.locator('input[type="file"]').first().setInputFiles(path.join(__dirname, "fixtures", "photo-a.png"));
    await page.getByTestId("video-input").setInputFiles(path.join(__dirname, "fixtures", "clip-2s.mp4"));
    await expect(page.getByTestId("video-tile")).toBeVisible();

    await page.getByLabel("Title", { exact: true }).fill("Radio with a video");
    await page.getByLabel("Price", { exact: true }).fill("2500");
    await page.getByLabel("Category", { exact: true }).selectOption({ label: "Vehicles" });
    await page.getByLabel("Location", { exact: true }).fill("Kabul");
    await page.getByRole("button", { name: "Save Draft" }).click();

    // The listing is saved and shown at once; the video follows.
    await expect(page).toHaveURL(/\/my-listings\/1001/, { timeout: 20_000 });
    await expect(page.getByTestId("listing-video-button")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("video-upload-failed")).toHaveCount(0);
  });

  test("removing a video asks first", async ({ page }) => {
    await page.goto("/en/listings/new");
    await page.getByTestId("video-input").setInputFiles(path.join(__dirname, "fixtures", "clip-2s.mp4"));
    await expect(page.getByTestId("video-tile")).toBeVisible();
    // A clip just picked (not saved yet) goes without a confirm.
    await page.getByTestId("video-remove").click();
    await expect(page.getByTestId("video-tile")).toHaveCount(0);
    await expect(page.getByTestId("video-add-button")).toBeVisible();
  });
});
