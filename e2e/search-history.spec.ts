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
 * floats the panel under its field (only while focused), the Bazaar sidebar
 * renders it inline whenever its box is empty. The Bazaar field is `lg`-only —
 * below that the header's field is the one on screen — so the phone case drives
 * the header.
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

/**
 * The header renders TWO copies of the field — one in the bar (`md`+) and one
 * dropped below it (`< md`) — so every header locator is scoped to the copy that
 * is actually on screen at the current viewport.
 */
const headerForm = (page: Page) =>
  page.locator("header form[role=search]:visible").first();
const headerInput = (page: Page) => headerForm(page).locator("input");
const headerPanel = (page: Page) =>
  headerForm(page).getByTestId("search-history-panel");

const sidebarForm = (page: Page) => page.locator("aside form[role=search]");
const sidebarInput = (page: Page) => sidebarForm(page).locator("input");
const sidebarPanel = (page: Page) =>
  sidebarForm(page).getByTestId("search-history-panel");
const panel = (page: Page) => page.getByTestId("search-history-panel");

/** SSR marker for the Bazaar feed — proves the route rendered before we click. */
const feedReady = (page: Page) =>
  expect(page.getByText("iPhone 13 Pro")).toBeVisible();

test.describe("Recent searches", () => {
  // A cold `.next-e2e` compiles each route on its first hit, and these specs
  // navigate two or three times. `test.slow()` triples the per-test budget so
  // the retry loops below can keep their own generous windows without ever
  // colliding with the suite timeout (which is what made this spec flake on a
  // cold, loaded machine).
  test.beforeEach(() => {
    test.slow();
  });

  /**
   * Focus a search field until its chips show.
   *
   * Retried on purpose: the click can land before React attaches (dev compiles
   * chunks on demand, so on a loaded machine hydration is not instant), and on
   * `/ps|/fa` a PRE-EXISTING hydration mismatch (Node's ICU renders the plural
   * count with Arabic-Indic digits, Chromium — which ships no Pashto Intl data —
   * with Latin ones) makes React regenerate the tree, which drops focus. A short
   * per-attempt timeout keeps the retries coming.
   */
  async function openPanel(input: Locator, panelLocator: Locator) {
    await expect(async () => {
      await input.click();
      await expect(panelLocator).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 60_000 });
  }

  /** Focus the Bazaar field and wait for its chips. */
  async function openSidebarPanel(page: Page) {
    await openPanel(sidebarInput(page), sidebarPanel(page));
  }

  /**
   * Type a query and wait for the debounced search to reach the URL.
   *
   * Retried for the same reason as {@link openPanel}: the first `fill` can land
   * before React has attached, so nothing ever commits. Each attempt empties the
   * field first — re-filling the SAME text is a no-op for a controlled input
   * (React bails on an unchanged value), so without the reset a lost first
   * attempt could never be retried. The URL assertion gets a real budget because
   * an App Router `replace()` only commits the history entry once the RSC payload
   * lands.
   */
  async function search(page: Page, input: Locator, text: string, url: RegExp) {
    await expect(async () => {
      await input.fill("");
      await input.fill(text);
      await expect(page).toHaveURL(url, { timeout: 10_000 });
    }).toPass({ timeout: 45_000 });
  }

  /**
   * Leaves the Bazaar field empty AND proves React is driving it. Required
   * before asserting that chips are ABSENT: against un-hydrated server HTML such
   * an assertion would pass for the wrong reason.
   *
   * The proof is a round-trip through React alone — type a character, then empty
   * the field with its own clear (X) button, whose onClick only exists once the
   * island is hydrated. Deliberately router-free: emptying the field cancels the
   * pending debounce, so no navigation is involved and a slow RSC payload can't
   * make this flaky. One character also keeps the store out of it (terms under 2
   * chars are never recorded), so it cannot pollute the history under test. The
   * header shares this React root, so its field is covered too.
   */
  async function bazaarHydrated(page: Page) {
    const input = sidebarInput(page);
    const clear = sidebarForm(page).getByRole("button", {
      name: "Clear",
      exact: true,
    });
    await expect(async () => {
      await input.fill("x");
      await clear.click({ timeout: 5_000 });
      await expect(input).toHaveValue("", { timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
  }

  test("a header search comes back as a chip on the empty field", async ({
    page,
  }) => {
    await page.goto("/en");
    const input = headerInput(page);

    // Search-as-you-type commits the term (debounced) and records it.
    await search(page, input, "iphone", /\/bazaar\?q=iphone/);

    // Emptying the box and focusing it offers the term back as a chip.
    await input.fill("");
    await openPanel(input, headerPanel(page));
    await expect(
      headerPanel(page).getByRole("button", { name: "iphone", exact: true }),
    ).toBeVisible();
  });

  test("one shared store: the header's history shows on the bazaar sidebar", async ({
    page,
  }) => {
    await seedHistory(page, ["iphone"]);
    await page.goto("/en/bazaar");
    await feedReady(page);

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
    await feedReady(page);
    await openSidebarPanel(page);

    // Deliberately NOT retried: applying a chip closes the panel, so a second
    // attempt would have nothing left to click. `openSidebarPanel` already
    // proved the island is hydrated, so one click is enough — the URL just needs
    // a real budget (App Router commits it only once the RSC payload lands).
    await sidebarPanel(page)
      .getByRole("button", { name: "MacBook", exact: true })
      .click();
    await expect(page).toHaveURL(/q=MacBook/, { timeout: 30_000 });

    await expect(page.getByText("MacBook Pro M2")).toBeVisible();
    await expect(page.getByText("iPhone 13 Pro")).toHaveCount(0);
  });

  test("X forgets one term and Clear all empties the panel", async ({
    page,
  }) => {
    await seedHistory(page, ["iphone", "macbook"]);
    await page.goto("/en/bazaar");
    await feedReady(page);
    await openSidebarPanel(page);

    const p = sidebarPanel(page);

    // The per-chip X removes only that term — and editing the list does not
    // dismiss it. Not retried: the X unmounts with its chip, so a retry would
    // find nothing to click.
    await p
      .getByRole("button", { name: "Remove iphone from recent searches" })
      .click();
    await expect(
      p.getByRole("button", { name: "iphone", exact: true }),
    ).toHaveCount(0);
    await expect(
      p.getByRole("button", { name: "macbook", exact: true }),
    ).toBeVisible();

    // Clear all empties the list, so the panel itself disappears.
    await p.getByRole("button", { name: "Clear all" }).click();
    await expect(p).toHaveCount(0);

    // And it stays gone across a reload — the cleared key is not resurrected.
    await page.reload();
    await feedReady(page);
    await bazaarHydrated(page);
    await expect(sidebarPanel(page)).toHaveCount(0);
  });

  test("hidden with no history, and hidden while the field has text", async ({
    page,
  }) => {
    // No history at all → nothing to offer, on either field.
    await page.goto("/en/bazaar");
    await feedReady(page);
    await bazaarHydrated(page);
    await expect(panel(page)).toHaveCount(0);
    await headerInput(page).click();
    await expect(panel(page)).toHaveCount(0);

    // History present but the box has text → still nothing.
    await seedHistory(page, ["iphone"]);
    await page.goto("/en/bazaar?q=MacBook");
    await expect(page.getByText("MacBook Pro M2")).toBeVisible();
    // The header field is empty, so its chips prove both that the page hydrated
    // and that the history is there…
    await openPanel(headerInput(page), headerPanel(page));
    // …while the Bazaar field, which carries the URL's query, stays chip-free.
    await expect(sidebarInput(page)).toHaveValue("MacBook");
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
    await feedReady(page);
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

  test("arrow keys walk the chips and Escape returns to the field", async ({
    page,
  }) => {
    await seedHistory(page, ["iphone", "macbook"]);
    await page.goto("/en/bazaar");
    await feedReady(page);
    await openSidebarPanel(page);

    const input = sidebarInput(page);
    await input.click();
    // ArrowDown enters the list at the newest chip; ArrowRight roves on (LTR).
    await input.press("ArrowDown");
    await expect(
      sidebarPanel(page).getByRole("button", { name: "iphone", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(
      sidebarPanel(page).getByRole("button", {
        name: "Remove iphone from recent searches",
      }),
    ).toBeFocused();
    // Escape always hands the caret back to the field.
    await page.keyboard.press("Escape");
    await expect(input).toBeFocused();
  });

  test("typing hides the chips, emptying the box brings them back", async ({
    page,
  }) => {
    await seedHistory(page, ["iphone"]);
    await page.goto("/en/bazaar");
    await feedReady(page);
    await openSidebarPanel(page);

    // Live typing (no reload) must hide the whole block…
    await sidebarInput(page).fill("MacBook");
    await expect(sidebarPanel(page)).toHaveCount(0);

    // …and clearing the field must bring it straight back. The field's own
    // clear (X) button is the one-tap way to do it.
    await sidebarForm(page)
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
    await feedReady(page);

    // Record through the real path: the debounced query settling commits it.
    await search(page, sidebarInput(page), "  MacBook  ", /q=MacBook/);

    // A fresh load must NOT re-seed (see seedHistory) — this asserts what the
    // app actually stored.
    await page.goto("/en/bazaar");
    await feedReady(page);
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
    // Leaves the field empty (and proves React is driving it), which is exactly
    // when a remembered term would show up.
    await bazaarHydrated(page);
    await expect(sidebarPanel(page)).toHaveCount(0);
  });

  test("degrades gracefully when localStorage is unavailable", async ({
    page,
  }) => {
    // Safari private mode / blocked cookies: touching localStorage THROWS.
    // Nothing about the page may break — the results render and search still
    // works; only the memory of past searches is lost between visits.
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new Error("localStorage is not available");
        },
      });
    });
    await page.goto("/en/bazaar");
    await feedReady(page);

    // Search still filters…
    await search(page, sidebarInput(page), "MacBook", /q=MacBook/);
    await expect(page.getByText("MacBook Pro M2")).toBeVisible();

    // …and the in-memory fallback still answers within the session.
    await sidebarInput(page).fill("");
    await openSidebarPanel(page);
    await expect(
      sidebarPanel(page).getByRole("button", { name: "MacBook", exact: true }),
    ).toBeVisible();
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
    await feedReady(page);

    // The Bazaar's own field is desktop-only — on a phone the header's field
    // (dropped under the bar) is the single search box, so the chips live there.
    await expect(sidebarInput(page)).toBeHidden();
    await openPanel(headerInput(page), headerPanel(page));

    // Long terms truncate instead of stretching the layout: the document never
    // scrolls sideways.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
