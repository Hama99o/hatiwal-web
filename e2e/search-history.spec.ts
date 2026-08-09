import { test, expect, type Page } from "@playwright/test";

/**
 * Recent-searches memory (mobile parity with `searchHistory.store.ts`).
 *
 * The history is client-only (localStorage `hatiwal.searchHistory`) — no API, no
 * auth, nothing in the URL beyond the existing `?q=` — so every test here runs
 * as a guest. Deterministic cases seed the key before load; the first test
 * exercises the real record path by searching through the header field.
 *
 * Two entry points share ONE store: the header renders the panel as a
 * focus-gated dropdown, the Bazaar sidebar renders it inline whenever its search
 * box is empty (mobile's rule).
 */

const KEY = "hatiwal.searchHistory";

/** Pre-seed the stored history so a test starts from a known list. */
async function seedHistory(page: Page, terms: string[]) {
  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      window.localStorage.setItem(key, value);
    },
    { key: KEY, value: JSON.stringify(terms) },
  );
}

const headerInput = (page: Page) =>
  page.locator("header form[role=search] input").first();
const sidebarInput = (page: Page) =>
  page.locator("aside form[role=search] input").first();
const panel = (page: Page) => page.getByTestId("search-history-panel");
const sidebarPanel = (page: Page) =>
  page.locator('aside [data-testid="search-history-panel"]');

test.describe("Recent searches", () => {
  test("a header search comes back as a chip on the empty field", async ({
    page,
  }) => {
    await page.goto("/en");
    const input = headerInput(page);

    // Search-as-you-type commits the term (debounced) and records it.
    await expect(async () => {
      await input.fill("iphone");
      await expect(page).toHaveURL(/\/bazaar\?q=iphone/);
    }).toPass({ timeout: 20_000 });

    // Emptying the box and focusing it offers the term back as a chip.
    await input.fill("");
    await expect(async () => {
      await input.click();
      await expect(
        page
          .locator('header [data-testid="search-history-panel"]')
          .getByRole("button", { name: "iphone", exact: true }),
      ).toBeVisible();
    }).toPass({ timeout: 20_000 });
  });

  test("one shared store: the header's history shows on the bazaar sidebar", async ({
    page,
  }) => {
    await seedHistory(page, ["iphone"]);
    await page.goto("/en/bazaar");

    await expect(sidebarPanel(page)).toBeVisible();
    await expect(sidebarPanel(page).getByText("Recent searches")).toBeVisible();
    await expect(
      sidebarPanel(page).getByRole("button", { name: "iphone", exact: true }),
    ).toBeVisible();
  });

  test("a stored chip survives a reload and re-runs the search", async ({
    page,
  }) => {
    await seedHistory(page, ["MacBook"]);
    await page.goto("/en/bazaar");
    await expect(page.getByText("iPhone 13 Pro")).toBeVisible();

    await expect(async () => {
      await sidebarPanel(page)
        .getByRole("button", { name: "MacBook", exact: true })
        .click();
      await expect(page).toHaveURL(/q=MacBook/);
    }).toPass({ timeout: 20_000 });

    await expect(page.getByText("MacBook Pro M2")).toBeVisible();
    await expect(page.getByText("iPhone 13 Pro")).toHaveCount(0);
  });

  test("X forgets one term and Clear all empties the panel", async ({
    page,
  }) => {
    await seedHistory(page, ["iphone", "macbook"]);
    await page.goto("/en/bazaar");

    const p = sidebarPanel(page);
    await expect(p).toBeVisible();

    // The per-chip X removes only that term.
    await expect(async () => {
      await p
        .getByRole("button", { name: "Remove iphone from recent searches" })
        .click();
      await expect(
        p.getByRole("button", { name: "iphone", exact: true }),
      ).toHaveCount(0);
    }).toPass({ timeout: 20_000 });
    await expect(
      p.getByRole("button", { name: "macbook", exact: true }),
    ).toBeVisible();

    // Clear all empties the list, so the panel itself disappears.
    await p.getByRole("button", { name: "Clear all" }).click();
    await expect(p).toHaveCount(0);
  });

  test("hidden with no history, and hidden while the field has text", async ({
    page,
  }) => {
    // No history at all → nothing to offer, on either field.
    await page.goto("/en/bazaar");
    await expect(page.getByText("iPhone 13 Pro")).toBeVisible();
    await sidebarInput(page).click();
    await expect(panel(page)).toHaveCount(0);
    await headerInput(page).click();
    await expect(panel(page)).toHaveCount(0);

    // History present but the box has text → still nothing.
    await seedHistory(page, ["iphone"]);
    await page.goto("/en/bazaar?q=MacBook");
    await expect(page.getByText("MacBook Pro M2")).toBeVisible();
    await expect(sidebarPanel(page)).toHaveCount(0);
  });

  test("cap, dedupe and 1-char hygiene are enforced on read", async ({
    page,
  }) => {
    // 12 valid terms + a duplicate casing of the newest + a 1-char term.
    await seedHistory(page, [
      "term01",
      "TERM01",
      "a",
      "term02",
      "term03",
      "term04",
      "term05",
      "term06",
      "term07",
      "term08",
      "term09",
      "term10",
      "term11",
      "term12",
    ]);
    await page.goto("/en/bazaar");

    const p = sidebarPanel(page);
    await expect(p).toBeVisible();
    // Capped at 10, newest first: no duplicate "TERM01", no 1-char "a", and
    // everything past the cap ("term11"/"term12") is dropped.
    await expect(p.locator("li")).toHaveCount(10);
    await expect(p.getByRole("button", { name: "a", exact: true })).toHaveCount(
      0,
    );
    await expect(
      p.getByRole("button", { name: "term11", exact: true }),
    ).toHaveCount(0);
    await expect(
      p.getByRole("button", { name: "term01", exact: true }),
    ).toBeVisible();
    await expect(
      p.getByRole("button", { name: "term10", exact: true }),
    ).toBeVisible();
  });

  test("renders right-to-left in Pashto", async ({ page }) => {
    await seedHistory(page, ["iphone"]);
    await page.goto("/ps/bazaar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(sidebarPanel(page)).toBeVisible();
    await expect(
      sidebarPanel(page).getByRole("button", { name: "iphone", exact: true }),
    ).toBeVisible();
  });

  test("typing hides the chips, emptying the box brings them back", async ({
    page,
  }) => {
    await seedHistory(page, ["iphone"]);
    await page.goto("/en/bazaar");
    await expect(sidebarPanel(page)).toBeVisible();

    // Live typing (no reload) must hide the whole block…
    await sidebarInput(page).fill("MacBook");
    await expect(sidebarPanel(page)).toHaveCount(0);

    // …and clearing the field must bring it straight back.
    await sidebarInput(page).fill("");
    await expect(sidebarPanel(page)).toBeVisible();
  });

  test("re-searching a term in another casing keeps ONE chip, at the front", async ({
    page,
  }) => {
    await seedHistory(page, ["macbook", "jacket"]);
    await page.goto("/en/bazaar");

    // Record through the real path: the debounced query settling commits it.
    await expect(async () => {
      await sidebarInput(page).fill("  MacBook  ");
      await expect(page).toHaveURL(/q=MacBook/);
    }).toPass({ timeout: 20_000 });

    await page.goto("/en/bazaar");
    const p = sidebarPanel(page);
    await expect(p).toBeVisible();
    // Still two chips (trimmed + case-insensitive dedupe), newest casing first.
    await expect(p.locator("li")).toHaveCount(2);
    await expect(p.locator("li").first()).toContainText("MacBook");
    await expect(
      p.getByRole("button", { name: "macbook", exact: true }),
    ).toHaveCount(0);
  });

  test("no horizontal page scroll on a 375px phone viewport", async ({
    page,
  }) => {
    await seedHistory(page, [
      "a very long search term that must not widen the page",
      "MacBook Pro M2",
      "سامسونگ",
    ]);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/ps/bazaar");

    // The sidebar is collapsed behind the Filters toggle on a phone.
    await page.locator("aside").getByRole("button").first().click();
    await expect(sidebarPanel(page)).toBeVisible();

    // The chip row scrolls inside itself — the document never does.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
