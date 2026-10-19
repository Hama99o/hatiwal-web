import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import { patchJsonRoute, shopEntry, withSessionUser } from "./session-user";

/**
 * SHOP-MEDIA (docs/SHOP_MEDIA.md, Web): a shop's photos (up to 5) and one
 * video. Buyers see the strip under the header and "▶ Video" on the cover;
 * the owner / a manager manage both under "Photos & video". The mock's shop 42
 * has 2 photos (g1, g2) and a 20 s video; its PUT/DELETE answers are stateless.
 */
type Role = "owner" | "manager" | "staff";

async function asMember(page: Page, role: Role) {
  await withSessionUser(page, { sellerMode: true, shops: [shopEntry(42, "Safi Cosmetics", "active", role)] });
  await patchJsonRoute(page, "**/api/me/shops/42", (json) => ({ ...json, shop: { ...json.shop, role, status: "active" } }));
}

test.describe("Shop media — buyer", () => {
  test("the strip shows the shop's photos; a click opens one full-size", async ({ page }) => {
    await page.goto("/en/shops/42");
    const strip = page.getByTestId("shop-photo-strip");
    await expect(strip).toBeVisible();
    await expect(strip.getByRole("button")).toHaveCount(2);
    await page.getByTestId("shop-photo-1").click();
    await expect(page.getByTestId("shop-photo-zoom")).toBeVisible();
  });

  test("the cover carries '▶ Video · 0:20'; nothing loads before the click", async ({ page }) => {
    await page.goto("/en/shops/42");
    const button = page.getByTestId("listing-video-button");
    await expect(button).toHaveText(/Video · 0:20/);
    await expect(page.locator("video")).toHaveCount(0);
    await button.click();
    await expect(page.getByTestId("listing-video-player")).toBeVisible();
  });

  test("a visitor has no 'Photos & video' button", async ({ page }) => {
    await page.goto("/en/shops/42");
    await expect(page.getByTestId("shop-photo-strip")).toBeVisible();
    await expect(page.getByTestId("shop-page-media")).toHaveCount(0);
  });
});

test.describe("Shop media — owner", () => {
  test.use({ storageState: BUYER_STATE });

  test("reorder, remove and add photos: one save sends kept ids in order + the new file", async ({ page }) => {
    await asMember(page, "owner");
    await page.goto("/en/shops/42");
    await page.getByTestId("shop-page-media").click();
    await expect(page).toHaveURL(/\/en\/shops\/42\/media$/);
    await expect(page.getByTestId("shop-media-count")).toHaveText("2/5");

    // g2 before g1, then drop g1, then add one new photo.
    await page.getByTestId("shop-media-photo-earlier").nth(1).click();
    await page.getByRole("button", { name: "Remove photo" }).nth(1).click();
    await page.getByTestId("shop-media-input").setInputFiles(path.join(__dirname, "fixtures", "photo-a.png"));
    await expect(page.getByTestId("shop-media-count")).toHaveText("2/5");

    const put = page.waitForRequest((r) => r.method() === "PUT" && /\/shops\/42\/gallery$/.test(r.url()));
    await page.getByTestId("shop-media-save").click();
    const body = (await put).postDataBuffer()?.toString("latin1") ?? "";
    const keep = [...body.matchAll(/name="gallery\[keep_ids\]\[\]"\r\n\r\n([^\r\n]*)/g)].map((m) => m[1]);
    expect(keep).toEqual(["g2"]);
    expect(body.match(/name="gallery\[photos\]\[\]"; filename=/g)).toHaveLength(1);
    await expect(page).toHaveURL(/\/en\/shops\/42$/);
  });

  test("at 5 photos there is no add tile", async ({ page }) => {
    await asMember(page, "owner");
    await page.goto("/en/shops/42/media");
    await expect(page.getByTestId("shop-media-count")).toHaveText("2/5");
    const files = ["photo-a.png", "photo-b.png", "photo-a.png", "photo-b.png"].map((f) => path.join(__dirname, "fixtures", f));
    await page.getByTestId("shop-media-input").setInputFiles(files);
    await expect(page.getByTestId("shop-media-count")).toHaveText("5/5");
    await expect(page.getByTestId("shop-media-add")).toHaveCount(0);
  });

  test("a new video saves at once and uploads in the background", async ({ page }) => {
    await asMember(page, "owner");
    await page.goto("/en/shops/42/media");
    // The form is filled from the shop (its saved video) before the seller picks.
    await expect(page.getByTestId("video-tile")).toBeVisible();
    const upload = page.waitForRequest((r) => r.method() === "PUT" && /\/shops\/42\/video$/.test(r.url()), { timeout: 30_000 });
    await page.getByTestId("video-input").setInputFiles(path.join(__dirname, "fixtures", "clip-2s.mp4"));
    // The picked clip replaces the saved one (a local tile previews it with <video>).
    await expect(page.getByTestId("video-tile").locator("video")).toHaveCount(1);
    await page.getByTestId("shop-media-save").click();
    await expect(page).toHaveURL(/\/en\/shops\/42$/);
    await upload;
    await expect(page.getByTestId("video-upload-failed")).toHaveCount(0);
  });

  test("removing the video asks first, then save deletes it", async ({ page }) => {
    await asMember(page, "owner");
    await page.goto("/en/shops/42/media");
    await expect(page.getByTestId("video-tile")).toBeVisible();
    await page.getByTestId("video-remove").click();
    await page.getByRole("alertdialog").or(page.getByRole("dialog")).getByRole("button", { name: /Remove/ }).click();
    await expect(page.getByTestId("video-tile")).toHaveCount(0);
    const del = page.waitForRequest((r) => r.method() === "DELETE" && /\/shops\/42\/video$/.test(r.url()));
    await page.getByTestId("shop-media-save").click();
    await del;
  });

  test("a manager may manage the media", async ({ page }) => {
    await asMember(page, "manager");
    await page.goto("/en/shops/42");
    await expect(page.getByTestId("shop-page-media")).toBeVisible();
  });

  test("staff opening the page by URL are told it's the owner's", async ({ page }) => {
    await asMember(page, "staff");
    await page.goto("/en/shops/42");
    await expect(page.getByTestId("shop-page-media")).toHaveCount(0);
    await page.goto("/en/shops/42/media");
    await expect(page.getByTestId("owner-only")).toBeVisible();
    await expect(page.getByTestId("shop-media")).toHaveCount(0);
  });

  test("ps: the page reads in Pashto, right to left", async ({ page }) => {
    await asMember(page, "owner");
    await page.goto("/ps/shops/42/media");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("shop-media").getByRole("heading", { level: 1 })).not.toHaveText("Photos & video");
    await expect(page.getByTestId("shop-media-count")).toBeVisible();
  });
});
