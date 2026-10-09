import { test, expect, type Locator, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

/*
 * 1.1.6 photo variants (owner, 2026-10-09; api image_thumb_urls /
 * image_medium_urls / avatar_thumb_url): lists show the light THUMB (with the
 * medium as a srcset candidate), the listing gallery the MEDIUM, the
 * full-screen view the ORIGINAL; avatars the 256px thumb. An older API (no
 * variants) falls back: thumb → medium → thumbnail_url → original.
 * Owner rules: sharp at the displayed size, a small photo never upscaled, the
 * crop/aspect unchanged, and a variant that fails to load falls back to the
 * original — never a broken image.
 *
 * Mock (e2e/mock-api): listing 5 (MacBook, seller 1) has 3 photos with every
 * variant — a TINY 40x30, a PORTRAIT 300x900 and a PANORAMA 1600x200; listing 3
 * (Toyota) one 1600x1200 original only (the older API's shape); seller 3
 * (Najib) an avatar with its thumb. URLs: <mock>/media/<id>-<size>-<i>-<W>x<H>.png,
 * a real PNG of that size, variants fitted like the api's resize_to_limit.
 * next.config has `images.unoptimized`, so an <img> src IS the url asked for.
 */
const src = (img: Locator) => img.getAttribute("src");

/** What the browser actually painted: natural size, object-fit, and the box. */
const measure = (img: Locator) =>
  img.evaluate((el: HTMLImageElement) => ({
    naturalWidth: el.naturalWidth,
    naturalHeight: el.naturalHeight,
    fit: getComputedStyle(el).objectFit,
    boxWidth: el.clientWidth,
    boxHeight: el.clientHeight,
  }));

/** Every <img> on the page that finished loading has pixels: no broken image. */
const expectNoBrokenImages = async (page: Page) => {
  const broken = await page.locator("img").evaluateAll((imgs) =>
    (imgs as HTMLImageElement[]).filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src),
  );
  expect(broken).toEqual([]);
};

test.describe("Photo variants: which size each surface asks for", () => {
  test("Bazaar cards: the THUMB (+ the medium in srcset); an older API's listing: thumbnail_url", async ({ page }) => {
    await page.goto("/en/bazaar");
    const macbook = page.locator('a[href="/en/listings/5"] img').first();
    await expect(macbook).toBeVisible({ timeout: 60_000 });
    expect(await src(macbook)).toMatch(/\/media\/5-thumb-0-40x30\.png$/);
    expect(await macbook.getAttribute("srcset")).toMatch(/5-thumb-0-40x30\.png 640w, .*5-medium-0-40x30\.png 1440w$/);
    const toyota = page.locator('a[href="/en/listings/3"] img').first();
    expect(await src(toyota)).toMatch(/\/media\/3-thumbnail-0-600x450\.png$/);
    expect(await toyota.getAttribute("srcset")).toBeNull();
    // The card crop is unchanged: cover, filling its square.
    await expect.poll(async () => (await measure(macbook)).naturalWidth).toBeGreaterThan(0);
    expect((await measure(macbook)).fit).toBe("cover");
  });

  test("listing gallery: the MEDIUM big, THUMBS in the strip, the ORIGINAL full-screen", async ({ page }) => {
    await page.goto("/en/listings/5");
    const main = page.getByTestId("listing-gallery-main").locator("img");
    await expect(main).toBeVisible({ timeout: 60_000 });
    expect(await src(main)).toMatch(/\/media\/5-medium-0-40x30\.png$/);
    const strip = page.getByTestId("listing-gallery").locator("button[aria-label$=' 2'] img");
    expect(await src(strip)).toMatch(/\/media\/5-thumb-1-300x900\.png$/);
    await page.getByTestId("listing-gallery").locator("button[aria-label$=' 2']").click();
    await expect.poll(() => src(main)).toMatch(/\/media\/5-medium-1-300x900\.png$/);
    await page.getByTestId("listing-gallery-main").click();
    const zoom = page.getByTestId("listing-gallery-zoom").locator("img");
    await expect(zoom).toBeVisible();
    expect(await src(zoom)).toMatch(/\/media\/5-original-1-300x900\.png$/);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("listing-gallery-zoom")).toHaveCount(0);
  });

  test("an older API (originals only): the gallery shows the original", async ({ page }) => {
    await page.goto("/en/listings/3");
    const main = page.getByTestId("listing-gallery-main").locator("img");
    await expect(main).toBeVisible({ timeout: 60_000 });
    expect(await src(main)).toMatch(/\/media\/3-original-0-1600x1200\.png$/);
  });

  test("avatars: the 256px thumb, never the original", async ({ page }) => {
    await page.goto("/en/sellers/3");
    const avatar = page.locator("main img[src*='avatar-3-']").first();
    await expect(avatar).toBeVisible({ timeout: 60_000 });
    expect(await src(avatar)).toMatch(/\/representations\/redirect\/av3\/vk\/avatar-3-64x64\.png$/);
    await expect(page.locator("main img[src*='/blobs/redirect/av3/']")).toHaveCount(0);
  });
});

test.describe("Photo variants: tiny, portrait and panorama photos keep their shape", () => {
  // [strip index, natural W, H] of listing 5's medium variants.
  const PHOTOS = [
    { name: "tiny", i: 1, w: 40, h: 30 },
    { name: "portrait", i: 2, w: 300, h: 900 },
    { name: "panorama", i: 3, w: 1440, h: 180 },
  ];

  for (const p of PHOTOS) {
    test(`gallery: a ${p.name} photo is shown whole, never stretched or upscaled`, async ({ page }) => {
      await page.goto("/en/listings/5");
      const main = page.getByTestId("listing-gallery-main").locator("img");
      await expect(main).toBeVisible({ timeout: 60_000 });
      await page.getByTestId("listing-gallery").locator(`button[aria-label$=' ${p.i}']`).click();
      await expect.poll(async () => (await measure(main)).naturalWidth).toBe(p.w);
      const m = await measure(main);
      expect(m.naturalHeight).toBe(p.h);
      // scale-down = contain for a big photo, natural size for a small one:
      // the whole photo, its own aspect ratio, and never larger than it is.
      expect(m.fit).toBe("scale-down");
      const k = Math.min(1, m.boxWidth / m.naturalWidth, m.boxHeight / m.naturalHeight);
      if (p.name === "tiny") expect(k).toBe(1);
      expect(k).toBeGreaterThan(0);
      await expectNoBrokenImages(page);
    });
  }

  test("full-screen: the panorama original, whole and unstretched", async ({ page }) => {
    await page.goto("/en/listings/5");
    await expect(page.getByTestId("listing-gallery-main").locator("img")).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("listing-gallery").locator("button[aria-label$=' 3']").click();
    await page.getByTestId("listing-gallery-main").click();
    const zoom = page.getByTestId("listing-gallery-zoom").locator("img");
    await expect.poll(async () => (await measure(zoom)).naturalWidth).toBe(1600);
    const m = await measure(zoom);
    expect(m.naturalHeight).toBe(200);
    expect(m.fit).toBe("scale-down");
  });
});

test.describe("Photo variants: a photo that fails to load", () => {
  test("a card whose variants fail shows the ORIGINAL", async ({ page }) => {
    await page.route(/\/media\/5-(thumb|medium)-0-/, (r) => r.abort());
    await page.goto("/en/bazaar");
    const macbook = page.locator('a[href="/en/listings/5"] img').first();
    await expect.poll(() => src(macbook), { timeout: 60_000 }).toMatch(/\/media\/5-original-0-40x30\.png$/);
    await expect.poll(async () => (await measure(macbook)).naturalWidth).toBe(40);
    expect(await macbook.getAttribute("srcset")).toBeNull();
    await expectNoBrokenImages(page);
  });

  test("the gallery's medium fails → the original; the original fails too → the no-photo tile", async ({ page }) => {
    await page.route(/\/media\/5-medium-0-/, (r) => r.abort());
    await page.goto("/en/listings/5");
    const main = page.getByTestId("listing-gallery-main");
    await expect.poll(() => src(main.locator("img")), { timeout: 60_000 }).toMatch(/\/media\/5-original-0-40x30\.png$/);

    await page.route(/\/media\/5-(medium|original)-1-/, (r) => r.abort());
    await page.getByTestId("listing-gallery").locator("button[aria-label$=' 2']").click();
    await expect(main.locator("img")).toHaveCount(0);
    await expect(main.locator('[role="img"]')).toBeVisible();
    await expectNoBrokenImages(page);
  });

  test("an avatar thumb that fails retries the ORIGINAL (the api's avatar_url)", async ({ page }) => {
    await page.route(/\/representations\/redirect\/av3\//, (r) => r.abort());
    await page.goto("/en/sellers/3");
    const avatar = page.locator("main img[src*='avatar-3-']").first();
    await expect.poll(() => src(avatar), { timeout: 60_000 }).toMatch(/\/blobs\/redirect\/av3\/avatar-3-64x64\.png$/);
    await expect.poll(async () => (await measure(avatar)).naturalWidth).toBe(64);
    await expectNoBrokenImages(page);
  });

  test("an avatar whose original fails too shows the initials", async ({ page }) => {
    await page.route(/\/av3\//, (r) => r.abort());
    await page.goto("/en/sellers/3");
    await page.waitForLoadState("networkidle", { timeout: 60_000 });
    await expect(page.locator("main img[src*='avatar-3-']")).toHaveCount(0);
    await expectNoBrokenImages(page);
  });
});

test.describe("Photo variants: the seller's own lists", () => {
  test.use({ storageState: BUYER_STATE });

  test("My listings: the THUMB", async ({ page }) => {
    await page.goto("/en/my-listings");
    const card = page.locator('a[href="/en/my-listings/5"] img').first();
    await expect(card).toBeVisible({ timeout: 60_000 });
    expect(await src(card)).toMatch(/\/media\/5-thumb-0-40x30\.png$/);
  });
});
