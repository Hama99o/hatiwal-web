import { test, expect, type Request } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

/*
 * LOC-1 "All Afghanistan" (owner-approved, 2026-10-05), web twin of
 * hatiwal-mobile maestro/location/all_afghanistan.yaml.
 * DRAFT by the QA guard: fixme until the option lands on loc-1-web (hatiwal-d8).
 *   Change → All Afghanistan → the bar reads "All Afghanistan"; the feed request
 *   carries no latitude/longitude (plain newest-first); it survives a reload;
 *   picking a province switches back to "near X".
 */
const feedRequests = (reqs: Request[]) => reqs.filter((r) => /\/api\/v1\/listings(\?|$)/.test(r.url()));

test.describe.fixme("Bazaar: All Afghanistan", () => {
  test.use({ storageState: BUYER_STATE });

  test("All Afghanistan drops the point, sticks, and a province brings it back", async ({ page }) => {
    const reqs: Request[] = [];
    page.on("request", (r) => reqs.push(r));

    await page.goto("/en/bazaar");
    await page.getByTestId("location-change").click();
    await page.getByTestId("location-all-afghanistan").click();
    const save = page.getByTestId("location-save");
    if (await save.isVisible()) await save.click();

    await expect(page.getByTestId("location-bar")).toContainText("All Afghanistan");
    await expect.poll(() => feedRequests(reqs).length).toBeGreaterThan(0);
    const last = new URL(feedRequests(reqs).at(-1)!.url());
    expect(last.searchParams.has("latitude")).toBe(false);
    expect(last.searchParams.has("longitude")).toBe(false);

    await page.reload();
    await expect(page.getByTestId("location-bar")).toContainText("All Afghanistan");

    await page.getByTestId("location-change").click();
    await page.getByTestId("location-province-Herat").click();
    await page.getByTestId("location-save").click();
    await expect(page.getByTestId("location-bar")).toContainText("Herat");
  });
});
