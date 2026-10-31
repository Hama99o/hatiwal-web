import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

/**
 * Card 388: deleting a saved search used to be one click, for good. Now the row
 * goes at once with "Search removed · Undo"; the DELETE is sent only when that
 * toast closes without Undo (a server delete cannot be undone). Same as mobile.
 */
const MOCK_API = `http://localhost:${process.env.E2E_MOCK_API_PORT || 4010}/api/v1`;
const deletes = (page: Page) => {
  const seen: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "DELETE" && /saved_searches\/\d+$/.test(r.url())) seen.push(r.url());
  });
  return seen;
};
const firstDelete = (page: Page) => page.getByRole("button", { name: "Delete saved search" }).first();

test.use({ storageState: BUYER_STATE });
test.describe.configure({ mode: "serial" }); // one mock state for the file

test.beforeEach(async ({ page }) => {
  await page.request.post(`${MOCK_API}/__saved_search_alerts/reset`, { data: {} });
});

test("delete: the row goes at once with an Undo toast; Undo brings it back and nothing is deleted", async ({ page }) => {
  const sent = deletes(page);
  await page.goto("/en/browse");
  const rows = page.getByRole("button", { name: "Delete saved search" });
  await expect(firstDelete(page)).toBeVisible();
  const before = await rows.count();
  expect(before).toBeGreaterThan(0);

  await firstDelete(page).click();
  await expect(rows).toHaveCount(before - 1);
  await expect(page.getByText("Search removed")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(rows).toHaveCount(before);
  await page.waitForTimeout(9000); // past the toast's 8 s
  expect(sent).toHaveLength(0);
});

test("no Undo: the DELETE is sent once the toast closes, and the row stays gone", async ({ page }) => {
  const sent = deletes(page);
  await page.goto("/en/browse");
  const rows = page.getByRole("button", { name: "Delete saved search" });
  await expect(firstDelete(page)).toBeVisible();
  const before = await rows.count();

  await firstDelete(page).click();
  await expect(rows).toHaveCount(before - 1);
  expect(sent).toHaveLength(0);
  await expect.poll(() => sent.length, { timeout: 15_000 }).toBe(1);
  await page.reload();
  await expect(rows).toHaveCount(before - 1);
});
