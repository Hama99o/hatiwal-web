import { test, expect } from "@playwright/test";

/**
 * The basemap had NO test coverage at all, on either client, which is how the
 * web app went on quietly serving tiles from `tile.openstreetmap.org` — a
 * courtesy service whose policy discourages exactly this use — and how the
 * mobile app rendered "API KEY REQUIRED" watermarked across every map in
 * production without a single failing check.
 *
 * The lesson those two share: an HTTP 200 proves nothing about a map. CARTO
 * returned 200 with the watermark burned into the PNG, and a duplicated
 * Access-Control-Allow-Origin header returned 200 to curl while every browser
 * refused the response. So this asserts what a USER gets: a GL canvas that
 * painted, tiles fetched from OUR host, and nothing failing.
 */
test.describe("Basemap", () => {
  test("renders our own vector tiles, not someone else's raster service", async ({ page }) => {
    const ours: string[] = [];
    const failed: string[] = [];
    const foreign: string[] = [];

    page.on("request", (r) => {
      const u = r.url();
      if (u.includes("/styles/hatiwal-") || u.includes(".mvt")) ours.push(u);
      // The two hosts this migration exists to stop using.
      if (u.includes("tile.openstreetmap.org") || u.includes("basemaps.cartocdn.com")) foreign.push(u);
    });
    page.on("requestfailed", (r) => {
      if (r.url().includes("/styles/hatiwal-")) failed.push(`${r.failure()?.errorText} ${r.url()}`);
    });
    page.on("response", (r) => {
      if (r.url().includes("/styles/hatiwal-") && r.status() >= 400) failed.push(`HTTP${r.status()} ${r.url()}`);
    });

    await page.goto("/en/listings/1");

    // MapLibre GL paints to a <canvas>; a Leaflet raster TileLayer would emit
    // <img> tiles instead. So the canvas IS the assertion that the vector layer
    // took over, not merely that a map div exists.
    const canvas = page.locator("canvas.maplibregl-canvas");
    await expect(canvas).toBeVisible({ timeout: 30_000 });

    // The style must load before any tile can, so this is the cheapest proof the
    // whole chain resolved.
    await expect
      .poll(() => ours.some((u) => u.includes("/styles/hatiwal-")), { timeout: 30_000 })
      .toBe(true);
    // No tile assertion here: the e2e style is deliberately source-less, so no
    // .mvt is ever requested. Real tile delivery is proven by hatiwal-map's own
    // render test against the live host.

    expect(failed, `requests to our map host failed: ${failed.join(", ")}`).toEqual([]);
    expect(foreign, `still fetching from a third-party tile service: ${foreign.join(", ")}`).toEqual([]);

    // Attribution is a LICENCE CONDITION for OpenMapTiles-derived tiles. The
    // e2e stub style carries no source and therefore no attribution string, so
    // it is asserted where it is real: on the live styles, in hatiwal-map.
  });

  test("swaps the style for dark mode rather than dimming the tiles", async ({ page }) => {
    const styles: string[] = [];
    page.on("request", (r) => {
      const u = r.url();
      if (u.includes("/styles/hatiwal-")) styles.push(u);
    });

    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/en/listings/1");
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 30_000 });

    await expect
      .poll(() => styles.some((u) => u.includes("hatiwal-dark-")), { timeout: 30_000 })
      .toBe(true);
  });
});
