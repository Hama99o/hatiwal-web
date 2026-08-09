import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * Recent-searches memory (mobile parity with `searchHistory.store.ts`).
 *
 * The history is client-only (localStorage `hatiwal.searchHistory`) — no API, no
 * auth, nothing in the URL beyond the existing `?q=` — so every test here runs
 * as a guest. Deterministic cases seed the key before load; the first test
 * exercises the real record path by searching through the header field.
 *
 * Two entry points share ONE store and ONE component (`SearchBox`): the header
 * floats the panel under its field, the Bazaar sidebar renders it inline. Both
 * open on the same rule — the field is focused, empty, and there is history —
 * so every test focuses a field before expecting chips.
 */

const KEY = "hatiwal.searchHistory";
/** Marks a context as already seeded (see seedHistory). */
const SEED_FLAG = "hatiwal.e2e.searchHistorySeeded";

/**
 * Pre-seed the stored history so a test starts from a known list.
 *
 * `addInitScript` runs on EVERY navigation, so a bare `setItem` would silently
 * re-seed — and thereby erase — anything the app recorded before the next page
 * load. The sessionStorage flag (same tab, survives navigation) makes the seed
 * happen exactly once per context, leaving later writes intact.
 */
async function seedHistory(page: Page, terms: string[]) {
  await page.addInitScript(
    ({
      key,
      value,
      flag,
    }: {
      key: string;
      value: string;
      flag: string;
    }) => {
      if (window.sessionStorage.getItem(flag)) return;
      window.sessionStorage.setItem(flag, "1");
      window.localStorage.setItem(key, value);
    },
    { key: KEY, value: JSON.stringify(terms), flag: SEED_FLAG },
  );
}

const headerInput = (page: Page) =>
  page.locator("header form[role=search] input").first();
const sidebarInput = (page: Page) =>
  page.locator("aside form[role=search] input").first();
const panel = (page: Page) => page.getByTestId("search-history-panel");
const sidebarPanel = (page: Page) =>
  page.locator('aside [data-testid="search-history-panel"]');

/**
 * Focus a search field until its chips show.
 *
 * Retried on purpose: in dev the first click can land before React attaches,
 * and on `/ps|/fa` a PRE-EXISTING hydration mismatch (Node's ICU renders the
 * plural count with Arabic-Indic digits, Chromium — which ships no Pashto Intl
 * data — with Latin ones) makes React regenerate the tree, which drops focus.
 * A short per-attempt timeout keeps the retries coming.
 */
async function openPanel(input: Locator, panelLocator: Locator) {
  await expect(async () => {
    await input.click();
    await expect(panelLocator).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

/** Focus the Bazaar field and wait for its chips. */
async function openSidebarPanel(page: Page) {
  await openPanel(sidebarInput(page), sidebarPanel(page));
}

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
    const headerPanel = page.locator(
      'header [data-testid="search-history-panel"]',
    );
    await openPanel(input, headerPanel);
    await expect(
      headerPanel.getByRole("button", { name: "iphone", exact: true }),
    ).toBeVisible();
  });

  test("one shared store: the header's history shows on the bazaar sidebar", async ({
    page,
  }) => {
    await seedHistory(page, ["iphone"]);
    await page.goto("/en/bazaar");

    await openSidebarPanel(page);
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
    await openSidebarPanel(page);

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
    await openSidebarPanel(page);

    const p = sidebarPanel(page);

    // The per-chip X removes only that term — and editing the list does not
    // dismiss it (focus is handed back to the field).
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

    // And it stays gone across a reload — the cleared key is not resurrected.
    await page.reload();
    await sidebarInput(page).click();
    await expect(sidebarPanel(page)).toHaveCount(0);
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

    // History present but the box has text → still nothing, even when focused.
    await seedHistory(page, ["iphone"]);
    await page.goto("/en/bazaar?q=MacBook");
    await expect(page.getByText("MacBook Pro M2")).toBeVisible();
    await sidebarInput(page).click();
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
    await openSidebarPanel(page);

    const p = sidebarPanel(page);
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
    await openSidebarPanel(page);
    await expect(
      sidebarPanel(page).getByRole("button", { name: "iphone", exact: true }),
    ).toBeVisible();
  });

  test("typing hides the chips, emptying the box brings them back", async ({
    page,
  }) => {
    await seedHistory(page, ["iphone"]);
    await page.goto("/en/bazaar");
    await openSidebarPanel(page);

    // Live typing (no reload) must hide the whole block…
    await sidebarInput(page).fill("MacBook");
    await expect(sidebarPanel(page)).toHaveCount(0);

    // …and clearing the field must bring it straight back. The field's own
    // clear (X) button is the one-tap way to do it.
    await page
      .locator("aside form[role=search]")
      .getByRole("button", { name: "Clear", exact: true })
      .click();
    await expect(sidebarInput(page)).toHaveValue("");
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

    // A fresh load must NOT re-seed (see seedHistory) — this asserts what the
    // app actually stored.
    await page.goto("/en/bazaar");
    await openSidebarPanel(page);
    const p = sidebarPanel(page);
    // Still two chips (trimmed + case-insensitive dedupe), newest casing first.
    await expect(p.locator("li")).toHaveCount(2);
    await expect(p.locator("li").first()).toContainText("MacBook");
    await expect(
      p.getByRole("button", { name: "macbook", exact: true }),
    ).toHaveCount(0);
  });

  test("a query that only came from the URL is never remembered", async ({
    page,
  }) => {
    // Landing on a shared/filtered link must not silently record its query as
    // something this buyer searched for.
    await page.goto("/en/bazaar?q=MacBook");
    await expect(page.getByText("MacBook Pro M2")).toBeVisible();
    // Longer than the 350ms search debounce: if the island recorded the URL's
    // query, it would have done so by now.
    await page.waitForTimeout(1_000);
    await sidebarInput(page).fill("");
    await expect(sidebarPanel(page)).toHaveCount(0);
  });

  test("usable on a 375px phone viewport without widening the page", async ({
    page,
  }) => {
    await seedHistory(page, [
      "a very long search term that must not widen the page",
      "MacBook Pro M2",
      "سامسونگ",
    ]);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/ps/bazaar");

    // The Bazaar search field stays visible on a phone (the FILTERS collapse,
    // the search box does not), so the chips are one tap away.
    await expect(sidebarInput(page)).toBeVisible();
    await openSidebarPanel(page);

    // The chip row scrolls inside itself — the document never does.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
