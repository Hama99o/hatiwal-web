import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

/**
 * The Pakistan-expansion work, on web.
 *
 * WHY THIS FILE EXISTS: I shipped the Urdu locale and regrouped the category
 * select without adding a single web test for either, then told the owner the
 * web side was covered. It was not — 6 of 43 spec files had been run and none of
 * them touched this work. This is that gap closed.
 */

test.describe("Urdu locale (Pakistan expansion)", () => {
  test("Urdu renders RTL with lang=ur", async ({ page }) => {
    await page.goto("/ur");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ur");
  });

  test("the Urdu hero is actually Urdu, not an English fallback", async ({ page }) => {
    await page.goto("/ur");
    // next-intl loads ONE locale file with NO per-key fallback, so a missing key
    // renders the raw key path rather than English. Asserting on real Urdu text
    // is what distinguishes "translated" from "shipped the key name".
    // PREFIX, not the sentence. I wrote this asserting "افغانستان اور پاکستان"
    // and the owner then decided the app should present as Afghanistan alone —
    // so the very next commit would have failed a brand-new test. Anchoring on
    // the opening word keeps it testing what it is FOR (Urdu renders, not an
    // English fallback) rather than which countries the copy currently names.
    // Scoped to the HEADING. A bare getByText(/^افغانستان/) matched two elements
    // — the hero and the footer tagline both open with that word — and Playwright
    // fails strict mode rather than guessing.
    await expect(
      page.getByRole("heading", { name: /^افغانستان/ }),
    ).toBeVisible();
    // And prove no raw key path leaked into the page.
    await expect(page.getByText(/home\.hero\./)).toHaveCount(0);
  });

  test("the language switcher offers Urdu and switches to it", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: "Language" }).click();
    await page.getByRole("menuitem", { name: "اردو" }).click();
    await expect(page).toHaveURL(/\/ur(\/|$)/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });
});

test.describe("Category select is grouped by parent", () => {
  // /listings/new is behind auth. Without this the page redirects to login and
  // the select does not exist — which read as "the optgroup is missing" and
  // briefly looked like the grouping itself was broken.
  test.use({ storageState: BUYER_STATE });

  test("children are nested under their parent, not siblings of it", async ({ page }) => {
    await page.goto("/en/listings/new");

    // The fixture: Electronics HAS children (Phones, Laptops, Cameras);
    // Vehicles has none. That contrast is the whole point — a grouped select
    // must treat the two differently.
    const group = page.locator('select#categoryId optgroup[label="Electronics"]');
    await expect(group).toHaveCount(1);
    await expect(group.locator('option:text-is("Phones & Tablets")')).toHaveCount(1);

    // A childless top-level category stays a plain option, NOT an empty group.
    await expect(
      page.locator('select#categoryId optgroup[label="Vehicles"]'),
    ).toHaveCount(0);
  });

  test("a parent with children is still selectable", async ({ page }) => {
    // DELIBERATE divergence from mobile, where only a leaf can be chosen. An
    // <optgroup> LABEL is not selectable, so if the parent were only a label,
    // any listing already filed under it would render the select blank while
    // react-hook-form still held the old id. The parent is therefore also an
    // <option> inside its own group.
    await page.goto("/en/listings/new");
    await page
      .getByLabel("Category", { exact: true })
      .selectOption({ label: "Electronics" });
    await expect(page.getByLabel("Category", { exact: true })).toHaveValue("1");
  });
});
