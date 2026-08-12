import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * Recent-searches memory (mobile parity with `searchHistory.store.ts`).
 *
 * The history is client-only (localStorage `hatiwal.searchHistory`) — no API, no
 * auth, nothing in the URL beyond the existing `?q=` — so every test here runs
 * as a guest. Deterministic cases seed the key before load; the first test
 * exercises the real record path by searching through the header field.
 *
 * Two entry points share ONE store, ONE component (`SearchBox`) and ONE
 * behaviour: each floats the chips under its own field while THAT field is
 * focused and empty. So the chips are never on screen twice at once, and
 * Escape / clicking away always dismisses them.
 *
 * The Bazaar's own field is `lg`-only — below that the header's field is the one
 * on screen, and it mirrors the active `?q=` — so the phone cases drive the
 * header.
 */

const KEY = "hatiwal.searchHistory";
/** Marks a context as already seeded (see seedHistory). */
const SEED_FLAG = "hatiwal.e2e.searchHistorySeeded";

/**
 * How long an App Router `replace()` may take to reach `window.location`.
 *
 * Every search here commits by rewriting `?q=` on the SAME pathname, and the
 * router only moves the URL once the RSC payload for the new query lands. On a
 * cold `.next-e2e` that payload waits behind a dev-mode compile, shared with
 * every other spec file the suite is running in parallel — measured well past
 * 30s on a loaded machine, with nothing actually wrong. A warm run lands in
 * under a second and never approaches this.
 */
const URL_COMMIT_TIMEOUT = 45_000;

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

/**
 * A field's own clear (X) button — a sibling of the input inside `SearchField`'s
 * relative wrapper.
 *
 * Doubles as a hydration proof: it is rendered from the field's REACT state
 * (`value !== ""`), so it cannot exist while the page is still server HTML. See
 * {@link search}.
 */
const clearButtonFor = (input: Locator) =>
  input.locator("xpath=..").getByRole("button", { name: "Clear", exact: true });

const sidebarForm = (page: Page) => page.locator("aside form[role=search]");
const sidebarInput = (page: Page) => sidebarForm(page).locator("input");
const sidebarPanel = (page: Page) =>
  sidebarForm(page).getByTestId("search-history-panel");
const panel = (page: Page) => page.getByTestId("search-history-panel");

/** The Bazaar's filter card — the last child of the sidebar, below the field. */
const filterCard = (page: Page) => page.locator("aside > div").last();

/**
 * How far a panel's edges sit from its FIELD's, in CSS px (positive = further
 * right). The field is the panel's `position: relative` wrapper — panel → slot
 * div → wrapper — i.e. the box `start-0` anchors to.
 */
const anchorGaps = (panelLocator: Locator) =>
  panelLocator.evaluate((el) => {
    const field = el.parentElement?.parentElement as HTMLElement;
    const panelBox = el.getBoundingClientRect();
    const fieldBox = field.getBoundingClientRect();
    return {
      start: Math.round(panelBox.left - fieldBox.left),
      end: Math.round(panelBox.right - fieldBox.right),
    };
  });

/** SSR marker for the Bazaar feed — proves the route rendered before we click. */
const feedReady = (page: Page) =>
  expect(page.getByText("iPhone 13 Pro")).toBeVisible();

test.describe("Recent searches", () => {
  // A cold `.next-e2e` compiles each route on its first hit, and these specs
  // navigate two or three times and commit several searches. `test.slow()`
  // triples the per-test budget (120s → 360s) so the retry loops below can keep
  // the windows a cold `router.replace()` genuinely needs — see
  // {@link URL_COMMIT_TIMEOUT} — without colliding with the suite timeout, which
  // is what made this spec flake on a cold, loaded machine.
  test.beforeEach(() => {
    test.slow();
  });

  /**
   * Focus a search field until its chips show.
   *
   * Retried on purpose: the click can land before React attaches (dev compiles
   * chunks on demand, so on a loaded machine hydration is not instant). A short
   * per-attempt timeout keeps the retries coming.
   *
   * The `/ps` hydration mismatch that also used to drop focus here — Node's ICU
   * rendered the plural count with Arabic-Indic digits, Chromium (no Pashto Intl
   * data) with Latin ones — is fixed in `src/i18n/intl-locale-alias.ts` and fenced
   * by `e2e/i18n-digits.spec.ts`, so it is no longer a reason for this loop.
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
   * Two separate waits, on purpose. The `fill` is retried, for the same reason as
   * {@link openPanel}: it can land before React has attached, in which case the
   * text sits in the DOM, no state changes and nothing ever commits. Each attempt
   * empties the field first, because re-filling the SAME text is a no-op for a
   * controlled input (React bails on an unchanged value) and a lost attempt could
   * otherwise never be retried.
   *
   * What that loop waits for is {@link clearButtonFor}, NOT the URL: the clear
   * button is rendered from the field's own state, so it appears within a frame of
   * a fill that reached React and never appears for one that didn't. Cheap either
   * way — which is the point. The URL is then awaited exactly ONCE, outside the
   * loop, with the full {@link URL_COMMIT_TIMEOUT}. Waiting for it *inside* the
   * loop is the trap: emptying the field cancels the pending debounce, so a retry
   * aborts the very commit it is waiting for, and any window shorter than a cold
   * RSC round trip makes a slow-but-progressing search unable to finish no matter
   * how many times it is retried.
   */
  async function search(page: Page, input: Locator, text: string, url: RegExp) {
    await expect(async () => {
      await input.fill("");
      await input.fill(text);
      await expect(clearButtonFor(input)).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 60_000 });
    await expect(page).toHaveURL(url, { timeout: URL_COMMIT_TIMEOUT });
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
    await expect(page).toHaveURL(/q=MacBook/, { timeout: URL_COMMIT_TIMEOUT });

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

    // History present but the boxes have text → still nothing. Landing on a
    // filtered link fills BOTH fields with the query (the header field mirrors
    // `?q=` too), so neither offers chips.
    await seedHistory(page, ["iphone"]);
    await page.goto("/en/bazaar?q=MacBook");
    await expect(page.getByText("MacBook Pro M2")).toBeVisible();
    await expect(sidebarInput(page)).toHaveValue("MacBook");
    await expect(headerInput(page)).toHaveValue("MacBook");
    await expect(panel(page)).toHaveCount(0);

    // Emptying a field brings its own chips straight back — which also proves
    // the history was there the whole time.
    await headerForm(page)
      .getByRole("button", { name: "Clear", exact: true })
      .click();
    await expect(headerInput(page)).toHaveValue("");
    await expect(headerPanel(page)).toBeVisible();
  });

  test("the chips belong to the focused field, and only to one at a time", async ({
    page,
  }) => {
    await seedHistory(page, ["iphone"]);
    await page.goto("/en/bazaar");
    await feedReady(page);

    // Hydrated, with the Bazaar field empty AND focused → its chips are up.
    await bazaarHydrated(page);
    await expect(sidebarPanel(page)).toBeVisible();
    await expect(panel(page)).toHaveCount(1);

    // Moving focus to the header hands them over — the blur closes the copy that
    // lost focus. Focus is moved programmatically on purpose: an OPEN dropdown
    // floats over the top of the page (as any popover does), so a click aimed at
    // the other field would land on the panel itself.
    await headerInput(page).focus();
    await expect(headerPanel(page)).toBeVisible();
    await expect(sidebarPanel(page)).toHaveCount(0);
    await expect(panel(page)).toHaveCount(1);

    // Back the other way, same rule.
    await sidebarInput(page).focus();
    await expect(sidebarPanel(page)).toBeVisible();
    await expect(headerPanel(page)).toHaveCount(0);
    await expect(panel(page)).toHaveCount(1);

    // And the buyer can always put the chips away: nothing keeps space it is
    // not using (the filters below the field must never be pushed down).
    await sidebarInput(page).press("Escape");
    await expect(panel(page)).toHaveCount(0);
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

  test("an 11th search drops the oldest term (cap on WRITE)", async ({
    page,
  }) => {
    // The case above proves the cap on the READ path (a stored list longer than
    // the cap is trimmed when rendered). This one proves it on the WRITE path,
    // which is the one a buyer actually walks: recording an 11th term must
    // forget the oldest instead of growing the list. Seeding the first ten keeps
    // it to a single real search — eleven debounced RSC round trips would buy
    // nothing but minutes.
    await seedHistory(page, [
      "term10",
      "term09",
      "term08",
      "term07",
      "term06",
      "term05",
      "term04",
      "term03",
      "term02",
      "oldest term",
    ]);
    await page.goto("/en/bazaar");
    await feedReady(page);

    // The 11th, through the real path: the debounced query settles and records.
    await search(page, sidebarInput(page), "MacBook", /q=MacBook/);

    // Re-read what was STORED (the seed does not run twice — see seedHistory).
    await page.goto("/en/bazaar");
    await feedReady(page);
    await openSidebarPanel(page);

    const p = sidebarPanel(page);
    await expect(p.locator("li")).toHaveCount(10);
    // Newest first…
    await expect(p.locator("li").first()).toContainText("MacBook");
    // …the oldest is gone…
    await expect(
      p.getByRole("button", { name: "oldest term", exact: true }),
    ).toHaveCount(0);
    // …and everything between it and the new term survived.
    await expect(
      p.getByRole("button", { name: "term02", exact: true }),
    ).toBeVisible();
    await expect(
      p.getByRole("button", { name: "term10", exact: true }),
    ).toBeVisible();
  });

  test("renders right-to-left in Pashto", async ({ page }) => {
    await seedHistory(page, ["iphone"]);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/ps/bazaar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await openSidebarPanel(page);
    await expect(
      sidebarPanel(page).getByRole("button", { name: "iphone", exact: true }),
    ).toBeVisible();

    // The panel is ANCHORED to the field's start edge, which in RTL is its RIGHT
    // one — pinned because the panel is wider than the sidebar field, so a
    // `start-0` that regressed to `left-0` would hang it the other way and detach
    // it from its field while still passing a chips-are-visible check.
    const rtl = await anchorGaps(sidebarPanel(page));
    expect(Math.abs(rtl.end)).toBeLessThanOrEqual(1); // shares the RIGHT edge…
    expect(rtl.start).toBeLessThan(-1); // …and overhangs to the left.

    // …and the mirror image in LTR: same panel, start edge = left.
    await page.goto("/en/bazaar");
    await feedReady(page);
    await openSidebarPanel(page);
    const ltr = await anchorGaps(sidebarPanel(page));
    expect(Math.abs(ltr.start)).toBeLessThanOrEqual(1);
    expect(ltr.end).toBeGreaterThan(1);
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

    // Announced, not just reachable: the field points at the panel it controls
    // and at the sr-only hint that says how to walk into it. Resolved through
    // the DOM because React's generated ids are not CSS-selector safe.
    const wiring = await input.evaluate((el) => ({
      controls: document.getElementById(el.getAttribute("aria-controls") ?? "")
        ?.dataset.testid,
      hint: document.getElementById(el.getAttribute("aria-describedby") ?? "")
        ?.textContent,
    }));
    expect(wiring.controls).toBe("search-history-panel");
    expect(wiring.hint).toContain("Down Arrow");

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
    // Escape hands the caret back to the field AND puts the chips away.
    await page.keyboard.press("Escape");
    await expect(input).toBeFocused();
    await expect(sidebarPanel(page)).toHaveCount(0);
    // With nothing to announce, the field advertises nothing.
    await expect(input).not.toHaveAttribute("aria-controls", /./);
    await expect(input).not.toHaveAttribute("aria-describedby", /./);
  });

  test("a full history floats over the page instead of pushing the filters", async ({
    page,
  }) => {
    // The chips are a secondary convenience: they may cover the page while the
    // buyer is in the field, but must never take space from the filters they
    // came for — nor shift the column when the client-only history hydrates
    // (the server cannot know it exists), nor outgrow the sticky sidebar.
    // A full 10-term history is the worst case.
    await seedHistory(page, [
      "samsung galaxy a54",
      "iphone 13 pro",
      "macbook pro m2",
      "winter jacket",
      "toyota corolla",
      "office chair",
      "running shoes",
      "kabul rugs",
      "gas heater",
      "school books",
    ]);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en/bazaar");
    await feedReady(page);
    await bazaarHydrated(page);
    await expect(sidebarPanel(page)).toBeVisible();

    // Filters sit exactly where they did before the chips appeared…
    const before = await filterCard(page).boundingBox();
    await sidebarInput(page).press("Escape");
    await expect(sidebarPanel(page)).toHaveCount(0);
    const after = await filterCard(page).boundingBox();
    expect(before?.y).toBeCloseTo(after?.y ?? -1, 0);

    // …and the whole sidebar still fits the budget its own `top` offset implies.
    // The column is what gets pinned, so the viewport budget belongs to the
    // column: when the filter card claims all of it by itself, the search field
    // above pushes the card's bottom (Saved searches, Reset filters) past the
    // fold, where a stuck element can never be scrolled to. Page-length
    // independent on purpose — the geometry is wrong even before the feed is long
    // enough to pin anything.
    const fits = await page.locator("aside").evaluate((el) => {
      const offset = parseFloat(getComputedStyle(el).top) || 0;
      return (
        el.getBoundingClientRect().height <= window.innerHeight - offset + 1
      );
    });
    expect(fits).toBe(true);

    // The filters are still all reachable — the card keeps its own scroller.
    const scroller = await filterCard(page).evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      return el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    });
    expect(scroller).toBe(true);
  });

  test("a full history is readable from the 250px sidebar field", async ({
    page,
  }) => {
    // Floating means the panel owes nothing to its host column's width: matching
    // the 250px Bazaar field would stack all ten terms one per row and hide most
    // of them behind a scroll whose only cue is a sliver of the next chip. It is
    // allowed to be wider than the field (it takes no layout space) so the same
    // history reads two chips to a row, with nothing hidden.
    await seedHistory(page, [
      "samsung galaxy a54",
      "iphone 13 pro",
      "macbook pro m2",
      "winter jacket",
      "toyota corolla",
      "office chair",
      "running shoes",
      "kabul rugs",
      "gas heater",
      "school books",
    ]);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en/bazaar");
    await feedReady(page);
    await openSidebarPanel(page);

    const geometry = await sidebarPanel(page).evaluate((el) => {
      const list = el.querySelector("ul") as HTMLElement;
      const field = el.parentElement?.parentElement as HTMLElement; // .relative
      const rows = new Set(
        Array.from(el.querySelectorAll("li")).map(
          (li) => Math.round((li as HTMLElement).getBoundingClientRect().top),
        ),
      );
      return {
        panelWidth: Math.round(el.getBoundingClientRect().width),
        fieldWidth: Math.round(field.getBoundingClientRect().width),
        rows: rows.size,
        hiddenByScroll: list.scrollHeight - list.clientHeight,
        // `documentElement.clientWidth`, NOT `window.innerWidth`: the latter
        // includes the scrollbar, so it would call a panel that overhangs the
        // content box by the scrollbar's width "inside the viewport".
        insideViewport:
          el.getBoundingClientRect().left >= 0 &&
          el.getBoundingClientRect().right <=
            document.documentElement.clientWidth,
      };
    });

    // Wider than the 250px column that hosts it, still inside the viewport…
    expect(geometry.panelWidth).toBeGreaterThan(geometry.fieldWidth);
    expect(geometry.insideViewport).toBe(true);
    // …which buys about two chips per row (10 terms in at most 6 rows)…
    expect(geometry.rows).toBeLessThanOrEqual(6);
    // …and with that, the whole history is on screen: nothing behind a scroll.
    expect(geometry.hiddenByScroll).toBeLessThanOrEqual(1);
    // Being wider than its column means it lies OVER the results grid, which
    // follows the sidebar in DOM order — inside a `sticky` (own stacking
    // context) column, `z-50` alone would leave the chips buried under a card.
    const topmost = await sidebarPanel(page).evaluate((el) => {
      const box = el.getBoundingClientRect();
      // A point in the panel's far bottom corner, past the 250px column.
      const hit = document.elementFromPoint(box.right - 8, box.bottom - 8);
      return el.contains(hit);
    });
    expect(topmost).toBe(true);
  });

  test("at 1280px the header field never advertises a query that isn't applied", async ({
    page,
  }) => {
    // At `lg`+ BOTH fields are on screen. The Bazaar commits with
    // `router.replace()` on the same pathname — no navigation, no `popstate` —
    // so the header can only stay truthful if the committed query is published to
    // it. The app's most prominent search box showing a term the feed is NOT
    // filtered by is worse than showing nothing.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en/bazaar?q=MacBook");
    await expect(page.getByText("MacBook Pro M2")).toBeVisible();
    await expect(sidebarInput(page)).toBeVisible();
    await expect(headerInput(page)).toBeVisible();
    await expect(headerInput(page)).toHaveValue("MacBook");

    // Refine in the Bazaar field → the header follows the URL.
    await search(page, sidebarInput(page), "iphone", /q=iphone/);
    await expect(headerInput(page)).toHaveValue("iphone");
    await expect(page.getByText("iPhone 13 Pro")).toBeVisible();

    // Clear it there → the header empties too, and loses its own clear button
    // (an active X on an empty filter is the same lie in miniature).
    await sidebarForm(page)
      .getByRole("button", { name: "Clear", exact: true })
      .click();
    await expect(page).toHaveURL(/\/en\/bazaar$/, {
      timeout: URL_COMMIT_TIMEOUT,
    });
    await expect(headerInput(page)).toHaveValue("");
    await expect(
      headerForm(page).getByRole("button", { name: "Clear", exact: true }),
    ).toHaveCount(0);

    // Same rule for the sidebar's own "Reset filters", which drops `q` without
    // either field being touched.
    await search(page, sidebarInput(page), "MacBook", /q=MacBook/);
    await expect(headerInput(page)).toHaveValue("MacBook");
    await page.getByRole("button", { name: "Reset filters" }).click();
    await expect(page).toHaveURL(/\/en\/bazaar$/, {
      timeout: URL_COMMIT_TIMEOUT,
    });
    await expect(sidebarInput(page)).toHaveValue("");
    await expect(headerInput(page)).toHaveValue("");
  });

  test("at 1280px the Bazaar field follows a search made in the header", async ({
    page,
  }) => {
    // The mirror of the case above, pinned separately so the two-field contract
    // is symmetric: with both fields on screen, whichever one is NOT being typed
    // in must never be left holding a dead term. This direction travels a
    // different road — the header drives the URL and the island re-syncs from the
    // server's new `initialFilters` — so passing one direction proves nothing
    // about the other.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en/bazaar?q=MacBook");
    await expect(page.getByText("MacBook Pro M2")).toBeVisible();
    await expect(sidebarInput(page)).toHaveValue("MacBook");
    // Both fields start out truthful — and this one doubles as the header
    // island's hydration proof, for free: the server renders that field EMPTY
    // (`readBrowseQuery` returns "" without a `window`), so the mirrored query can
    // only be there once React is driving it.
    await expect(headerInput(page)).toHaveValue("MacBook");

    await search(page, headerInput(page), "iphone", /q=iphone/);
    await expect(sidebarInput(page)).toHaveValue("iphone");
    await expect(page.getByText("iPhone 13 Pro")).toBeVisible();

    // And clearing the header drops the filter from the Bazaar field too.
    await headerForm(page)
      .getByRole("button", { name: "Clear", exact: true })
      .click();
    await expect(page).toHaveURL(/\/en\/bazaar$/, {
      timeout: URL_COMMIT_TIMEOUT,
    });
    await expect(sidebarInput(page)).toHaveValue("");
  });

  test("the header dropdown dismisses on Escape, even from a chip", async ({
    page,
  }) => {
    // The header's panel FLOATS over the page, so a single Escape has to close
    // it from wherever focus sits — including a chip, whose unmount would
    // otherwise strand focus (and whose refocus of the field can re-open the
    // panel if the two updates are ordered wrongly).
    await seedHistory(page, ["iphone", "macbook"]);
    await page.goto("/en");
    const input = headerInput(page);
    await openPanel(input, headerPanel(page));

    await input.press("ArrowDown");
    await expect(
      headerPanel(page).getByRole("button", { name: "iphone", exact: true }),
    ).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(input).toBeFocused();
    await expect(headerPanel(page)).toHaveCount(0);
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

  test("on a 375px phone the visible field carries the active query", async ({
    page,
  }) => {
    // The Bazaar's own field is desktop-only, so on a phone the header's field
    // (dropped under the bar) is the ONLY search box — it must show what is
    // filtering the results, or a buyer arriving on a shared/Back-button link
    // can neither see nor refine the term.
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/en/bazaar?q=MacBook");
    await expect(page.getByText("MacBook Pro M2")).toBeVisible();
    await expect(sidebarInput(page)).toBeHidden();
    await expect(headerInput(page)).toHaveValue("MacBook");

    // And it is editable: its own clear button drops the filter.
    await headerForm(page)
      .getByRole("button", { name: "Clear", exact: true })
      .click();
    await expect(page).toHaveURL(/\/en\/bazaar$/, {
      timeout: URL_COMMIT_TIMEOUT,
    });
    await expect(page.getByText("iPhone 13 Pro")).toBeVisible();
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
    // scrolls sideways. Exact, no tolerance — below `md` the panel is as wide as
    // its field and nothing else, so there is no legitimate slack to allow.
    //
    // Measured against `clientWidth`, NOT `window.innerWidth`: the latter counts
    // the classic scrollbar Chromium renders on this (long) page while
    // `scrollWidth` does not, so the difference would sit near -15 with zero
    // overflow and a `<= 0` bound would tolerate ~15px of REAL overflow.
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // And the panel itself stays inside the page's CONTENT box, measured
    // scrollbar-free: a `100vw`-based width passes the check above (the document
    // does not grow) while still overhanging the padding by the scrollbar.
    const fits = await headerPanel(page).evaluate((el) => {
      const box = el.getBoundingClientRect();
      return box.left >= 0 && box.right <= document.documentElement.clientWidth;
    });
    expect(fits).toBe(true);

    // Every chip keeps a real remove TARGET, even when the term is long enough
    // to truncate. The pill is an `inline-flex`, so both halves are shrinkable by
    // default and the X collapsed to ~32px — under the 40px floor — with the
    // label taking the room. The label absorbs the shrink now, so measure the
    // box: an aria-label alone says nothing about whether it can be hit.
    const removeTargets = await headerPanel(page).evaluate((el) =>
      Array.from(
        el.querySelectorAll<HTMLElement>("li > button:last-child"),
      ).map((button) => {
        const box = button.getBoundingClientRect();
        return { w: Math.round(box.width), h: Math.round(box.height) };
      }),
    );
    expect(removeTargets).toHaveLength(3);
    for (const target of removeTargets) {
      expect(target.w).toBeGreaterThanOrEqual(40);
      expect(target.h).toBeGreaterThanOrEqual(40);
    }
  });
});
