import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

/**
 * Sell with a photo (hatiwal-api docs/SELL_WITH_PHOTO.md, design in
 * hatiwal-mobile docs/design/SELL_WITH_PHOTO.md): the first photo of a NEW
 * listing may bring one chip, "Looks like: Electronics › Phones & Tablets".
 * The owner's rule: it never overwrites what the seller chose.
 *
 * The mock API answers from the photo's FILENAME (e2e/mock-api/server.mjs):
 * *nosuggest* → 204, *slow* → the answer after 1.5 s, else Phones & Tablets.
 */
const MOCK_API = `http://localhost:${process.env.E2E_MOCK_API_PORT || 4010}/api/v1`;
const PHOTO = path.join(__dirname, "fixtures", "photo-a.png");

async function addPhoto(page: Page, name = "phone.png") {
  await page.locator('input[type="file"][accept="image/*"]').first().setInputFiles({
    name,
    mimeType: "image/png",
    buffer: require("node:fs").readFileSync(PHOTO),
  });
}

async function suggestionLog(page: Page): Promise<{ requests: string[]; outcomes: { outcome: string; category_id: number }[] }> {
  const res = await page.request.get(`${MOCK_API}/__category_suggestions`);
  return res.json();
}

const chip = (page: Page) => page.getByTestId("category-suggestion");
const category = (page: Page) => page.getByLabel("Category", { exact: true });

test.describe("Sell with a photo (web)", () => {
  test.use({ storageState: BUYER_STATE });
  // One mock log for the whole file: its tests must not interleave.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await page.request.post(`${MOCK_API}/__category_suggestions/reset`);
  });

  test("empty category: the chip appears; tapping it sets the category", async ({ page }) => {
    await page.goto("/en/listings/new");
    await addPhoto(page);

    await expect(chip(page)).toBeVisible();
    await expect(chip(page)).toContainText("Looks like:");
    await expect(chip(page)).toContainText("Electronics");
    await expect(chip(page)).toContainText("Phones & Tablets");
    // Nothing is chosen until the seller taps.
    await expect(category(page)).toHaveValue("");

    await page.getByTestId("category-suggestion-accept").click();
    await expect(category(page)).toHaveValue("101");
    await expect(chip(page)).toBeHidden();
    await expect.poll(async () => (await suggestionLog(page)).outcomes).toEqual([{ outcome: "accepted", category_id: 101 }]);
  });

  test("the picker offers it on top too (Suggested): choosing it there sets the real category", async ({ page }) => {
    await page.goto("/en/listings/new");
    await addPhoto(page);
    await expect(chip(page)).toBeVisible();

    const suggested = category(page).locator("optgroup[label='Suggested'] option");
    await expect(suggested).toHaveText("Phones & Tablets");
    await expect(category(page)).toHaveValue(""); // offered, not chosen

    await category(page).selectOption({ value: await suggested.getAttribute("value") ?? "" });
    await expect(category(page)).toHaveValue("101");
    await expect(chip(page)).toBeHidden();
    await expect(category(page).locator("optgroup[label='Suggested']")).toHaveCount(0);
    await expect.poll(async () => (await suggestionLog(page)).outcomes).toEqual([{ outcome: "accepted", category_id: 101 }]);
  });

  test("✕ dismisses it for good: another photo does not ask again", async ({ page }) => {
    await page.goto("/en/listings/new");
    await addPhoto(page);
    await page.getByTestId("category-suggestion-dismiss").click();

    await expect(chip(page)).toBeHidden();
    await expect(category(page)).toHaveValue("");
    await addPhoto(page, "second.png");
    await page.waitForTimeout(500);
    await expect(chip(page)).toBeHidden();
    const log = await suggestionLog(page);
    expect(log.requests).toEqual([ "phone.png" ]);
    expect(log.outcomes).toEqual([{ outcome: "dismissed", category_id: 101 }]);
  });

  test("a category chosen BEFORE the photo: no request, no chip", async ({ page }) => {
    await page.goto("/en/listings/new");
    await category(page).selectOption({ label: "Vehicles" });
    await addPhoto(page);

    await page.waitForTimeout(500);
    await expect(chip(page)).toBeHidden();
    expect((await suggestionLog(page)).requests).toEqual([]);
    await expect(category(page)).not.toHaveValue("");
  });

  test("a category chosen WHILE the answer is on its way: the late answer shows nothing", async ({ page }) => {
    await page.goto("/en/listings/new");
    await addPhoto(page, "slow.png");
    await category(page).selectOption({ label: "Vehicles" });

    await expect.poll(async () => (await suggestionLog(page)).requests).toEqual([ "slow.png" ]);
    await page.waitForTimeout(2000);
    await expect(chip(page)).toBeHidden();
    await expect(category(page)).not.toHaveValue("101");
  });

  test("picking another category while the chip shows: it leaves (replaced)", async ({ page }) => {
    await page.goto("/en/listings/new");
    await addPhoto(page);
    await expect(chip(page)).toBeVisible();

    await category(page).selectOption({ label: "Vehicles" });
    await expect(chip(page)).toBeHidden();
    await expect.poll(async () => (await suggestionLog(page)).outcomes).toEqual([{ outcome: "replaced", category_id: 101 }]);
  });

  test("removing the photo hides its suggestion", async ({ page }) => {
    await page.goto("/en/listings/new");
    await addPhoto(page);
    await expect(chip(page)).toBeVisible();

    await page.getByRole("button", { name: "Remove photo" }).first().click();
    await expect(chip(page)).toBeHidden();
  });

  test("not sure (204): nothing at all", async ({ page }) => {
    await page.goto("/en/listings/new");
    await addPhoto(page, "nosuggest.png");

    await expect.poll(async () => (await suggestionLog(page)).requests).toEqual([ "nosuggest.png" ]);
    await page.waitForTimeout(500);
    await expect(chip(page)).toBeHidden();
  });

  test("offline: no request, no chip, no error", async ({ page, context }) => {
    await page.goto("/en/listings/new");
    // The form fully loaded first (dev mode compiles it on demand).
    await expect(page.getByRole("heading", { name: "Create Listing" })).toBeVisible();
    await expect(page.locator('input[type="file"][accept="image/*"]').first()).toBeAttached();
    await context.setOffline(true);
    await addPhoto(page);
    await page.waitForTimeout(500);
    await context.setOffline(false);

    await expect(chip(page)).toBeHidden();
    expect((await suggestionLog(page)).requests).toEqual([]);
  });

  test("editing a listing: never a suggestion", async ({ page }) => {
    await page.goto("/en/listings/1001/edit");
    await expect(page.getByRole("heading", { name: "Edit Listing" })).toBeVisible();
    await addPhoto(page);

    await page.waitForTimeout(500);
    await expect(chip(page)).toBeHidden();
    expect((await suggestionLog(page)).requests).toEqual([]);
  });

  test("in Pashto the chip is in Pashto, from the category's own names", async ({ page }) => {
    await page.goto("/ps/listings/new");
    await addPhoto(page);

    await expect(chip(page)).toBeVisible();
    await expect(chip(page)).toContainText("موبایلونه");
    await expect(chip(page)).not.toContainText("Phones");
    await expect(chip(page)).not.toContainText("Looks like");
  });
});
