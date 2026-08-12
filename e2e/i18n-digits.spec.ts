import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

/**
 * ONE digit set per locale, in the server HTML and in the browser (regression
 * fence for `src/i18n/intl-locale-alias.ts`).
 *
 * Node ships full ICU, V8/Chromium ships NO Pashto data — so the raw `ps` tag
 * next-intl formats numbers with used to mean Pashto on the server (`۱`) and
 * silently `en-US` in the browser (`1`). Every client island printing a count
 * hydrated mismatched: React threw the island's server HTML away (error #418,
 * which also drops focus) and the Bazaar showed a Latin results count directly
 * above Arabic-Indic prices. `/en` and `/fa` were never affected — both runtimes
 * ship English and Persian data — so they are asserted here as the control.
 *
 * These specs deliberately assert the OUTPUT (digits) as well as the absence of
 * hydration complaints: a mismatch only surfaces once the island has actually
 * hydrated, so every test proves hydration happened first.
 */

/** Extended Arabic-Indic digits (۰ … ۹) — what `fa-AF` renders for ps and fa. */
const ARABIC_INDIC = /[۰-۹]/;
/** ASCII digits — correct for `en`, a bug for a `t()`-formatted ps/fa count. */
const LATIN_DIGIT = /[0-9]/;

/**
 * React reports a hydration mismatch on two channels and in two dialects: the dev
 * server logs "Hydration failed because the server rendered text didn't match…"
 * (console + the Next overlay's uncaught error), a production build throws the
 * minified `#418`/`#423`. Match all of them, and only them, so an unrelated
 * console error elsewhere on the page can't turn this into a flake.
 */
const HYDRATION =
  /hydrat|did ?n[o']t match|server[- ]rendered|errors\/(418|419|422|423|425)|#(418|419|422|423|425)/i;

/** Starts collecting hydration complaints. Call BEFORE `goto`. */
function watchHydration(page: Page): string[] {
  const complaints: string[] = [];
  page.on("pageerror", (error) => {
    if (HYDRATION.test(error.message)) {
      complaints.push(`pageerror: ${error.message.split("\n")[0]}`);
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error" && HYDRATION.test(message.text())) {
      complaints.push(`console: ${message.text().split("\n")[0]}`);
    }
  });
  return complaints;
}

/** The Bazaar's results count as the SERVER rendered it, straight out of the HTML. */
async function serverRenderedCount(page: Page, path: string) {
  const html = await (await page.request.get(path)).text();
  return html.match(/data-testid="results-count"[^>]*>([^<]*)</)?.[1] ?? null;
}

/**
 * Proves the Bazaar island is hydrated — required before reading digits, because
 * un-hydrated server HTML would satisfy the assertions for the wrong reason.
 *
 * The grid/list toggle is pure client state persisted to localStorage, so the
 * stored value can only appear once React is driving the page. Locale-independent
 * on purpose (`role=tab`, not a translated label).
 */
async function bazaarHydrated(page: Page) {
  const listView = page
    .locator("main [role=tablist]")
    .first()
    .getByRole("tab")
    .last();
  // Retried, like `openPanel` in search-history.spec.ts: a click can land before
  // React attaches (dev compiles chunks on demand) and is then lost. Retrying
  // also means a REGRESSION of this card's bug fails on the digit assertions
  // below — which name the actual defect — instead of dying here because the
  // re-rendered island swallowed the click.
  await expect(async () => {
    await listView.click();
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            window.localStorage.getItem("hatiwal.bazaar.viewMode"),
          ),
        { timeout: 3_000 },
      )
      .toBe("list");
  }).toPass({ timeout: 60_000 });
}

test.describe("Locale digits (no hydration mismatch)", () => {
  test("Pashto Bazaar: the count keeps the server's digits and matches the prices", async ({
    page,
  }) => {
    const complaints = watchHydration(page);
    const path = "/ps/bazaar?q=MacBook";

    const fromServer = await serverRenderedCount(page, path);
    expect(fromServer).toMatch(ARABIC_INDIC);

    await page.goto(path);
    await expect(page.getByText("MacBook Pro M2")).toBeVisible();
    await bazaarHydrated(page);

    // The count `t()` renders in the browser must be the SAME string the server
    // sent — that equality IS the hydration contract.
    const count = page.getByTestId("results-count");
    await expect(count).toHaveText(fromServer!);
    await expect(count).not.toHaveText(LATIN_DIGIT);

    // …and it must agree with `formatPrice` (fa-AF) on the same screen: the price
    // is the one place a Bazaar card prints digits (`PriceTag`, `tabular-nums`).
    const price = page.locator("main .tabular-nums").first();
    await expect(price).toHaveText(ARABIC_INDIC);
    await expect(price).not.toHaveText(LATIN_DIGIT);

    expect(complaints).toEqual([]);
  });

  test("English Bazaar is unchanged: Latin digits, no complaints", async ({
    page,
  }) => {
    const complaints = watchHydration(page);
    await page.goto("/en/bazaar?q=MacBook");
    await expect(page.getByText("MacBook Pro M2")).toBeVisible();
    await bazaarHydrated(page);

    const count = page.getByTestId("results-count");
    await expect(count).toHaveText("1 listing");
    await expect(count).not.toHaveText(ARABIC_INDIC);
    expect(complaints).toEqual([]);
  });

  test("Dari Bazaar is unchanged: Persian digits, no complaints", async ({
    page,
  }) => {
    const complaints = watchHydration(page);
    await page.goto("/fa/bazaar?q=MacBook");
    await expect(page.getByText("MacBook Pro M2")).toBeVisible();
    await bazaarHydrated(page);

    const count = page.getByTestId("results-count");
    await expect(count).toHaveText(ARABIC_INDIC);
    await expect(count).not.toHaveText(LATIN_DIGIT);
    expect(complaints).toEqual([]);
  });

  test.describe("authed Pashto surfaces that print a count", () => {
    test.use({ storageState: BUYER_STATE });

    test("My Shop: the listing count renders in Pashto digits", async ({
      page,
    }) => {
      const complaints = watchHydration(page);
      await page.goto("/ps/my-listings");
      // React Query fills this in after the authed fetch, so the count is a
      // client render by definition — wait for the grid, then for the count.
      await expect(
        page.locator('a[href^="/ps/my-listings/"]').first(),
      ).toBeVisible({ timeout: 60_000 });

      // The count sits directly under the page heading (locale-independent).
      const count = page.locator("h1 + p");
      await expect(count).toHaveText(ARABIC_INDIC);
      await expect(count).not.toHaveText(LATIN_DIGIT);
      expect(complaints).toEqual([]);
    });

    // The three count PILLS (header unread · inbox row · the owner panel's
    // waiting-chats badge) all render through the shared `<CountBadge>` now. Two
    // of them used to print `count > 9 ? "9+" : count` straight into JSX, so the
    // header showed a Latin "2" beside Arabic-Indic digits everywhere else on the
    // same page — this file's exact failure mode, one component over.
    test("the header's unread pill renders in Pashto digits", async ({
      page,
    }) => {
      const complaints = watchHydration(page);
      await page.goto("/ps/my-listings");
      const pill = page.locator("header").getByTestId("count-badge");
      await expect(pill).toBeVisible({ timeout: 60_000 });
      await expect(pill).toHaveText(ARABIC_INDIC);
      await expect(pill).not.toHaveText(LATIN_DIGIT);
      expect(complaints).toEqual([]);
    });

    // Past the cap the pill shows "9+", which is a NUMBER plus a sign — so the
    // digit has to be formatted for the locale and the "+" has to come from the
    // catalog (`common.countOverflow`), not be concatenated in JSX where an RTL
    // locale cannot move it.
    test("an unread count past the cap is capped in Pashto digits", async ({
      page,
    }) => {
      const complaints = watchHydration(page);
      // Mutate the real session payload rather than inventing one: `{ user }`,
      // camelCase (src/app/api/auth/session/route.ts).
      await page.route("**/api/auth/session", async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        if (body.user) body.user.unreadMessageCount = 12;
        await route.fulfill({ response, json: body });
      });
      await page.goto("/ps/my-listings");
      const pill = page.locator("header").getByTestId("count-badge");
      await expect(pill).toBeVisible({ timeout: 60_000 });
      await expect(pill).toHaveText("۹+");
      await expect(pill).not.toHaveText(LATIN_DIGIT);
      expect(complaints).toEqual([]);
    });

    test("the owner panel's waiting-chats pill renders in Pashto digits", async ({
      page,
    }) => {
      const complaints = watchHydration(page);
      await page.goto("/ps/listings/1");
      const pill = page
        .getByTestId("owner-listing-bar")
        .getByTestId("count-badge");
      await expect(pill).toBeVisible({ timeout: 60_000 });
      await expect(pill).toHaveText(ARABIC_INDIC);
      await expect(pill).not.toHaveText(LATIN_DIGIT);
      expect(complaints).toEqual([]);
    });

    // /profile prints THREE independent numbers now that REP815 put your own
    // reputation there: the stat tiles, the rating score, and the review count
    // inside the same link as the score. The score used to be `toFixed(1)` and
    // the tiles raw `{value}`, so the page showed a Latin "4.7" and three Latin
    // tiles beside an Arabic-Indic "۳ نظرونه" — this file's failure mode, three
    // components over. The review dates below them were English on /ps.
    test("Profile: your own rating, stats and review dates are all Pashto", async ({
      page,
    }) => {
      const complaints = watchHydration(page);
      await page.goto("/ps/profile");

      // The score and the count share one line (and one accessible name), so
      // this single assertion is what makes two digit systems impossible there.
      const rating = page.locator('a[href="#my-reviews"]');
      await expect(rating).toBeVisible({ timeout: 60_000 });
      await expect(rating).toHaveText(ARABIC_INDIC);
      await expect(rating).not.toHaveText(LATIN_DIGIT);

      const tiles = page.getByTestId("profile-stat-value");
      await expect(tiles).toHaveCount(3);
      for (const tile of await tiles.all()) {
        await expect(tile).toHaveText(ARABIC_INDIC);
        await expect(tile).not.toHaveText(LATIN_DIGIT);
      }

      // ReviewCard's date: client-rendered by definition (TanStack Query fills
      // the list), which is precisely where the raw `ps` tag fell back to en-US.
      const date = page.locator("#my-reviews time").first();
      await expect(date).toBeVisible({ timeout: 60_000 });
      await expect(date).toHaveText(ARABIC_INDIC);
      await expect(date).not.toHaveText(LATIN_DIGIT);

      expect(complaints).toEqual([]);
    });

    test("Manage listing: the conversations count renders in Pashto digits", async ({
      page,
    }) => {
      const complaints = watchHydration(page);
      await page.goto("/ps/my-listings/1");
      // "# چټونه" — the chats link on the stats row (ps `listing.conversationsCount`).
      const chats = page.getByText(/چټ/).first();
      await expect(chats).toBeVisible({ timeout: 60_000 });
      await expect(chats).toHaveText(ARABIC_INDIC);
      await expect(chats).not.toHaveText(LATIN_DIGIT);
      expect(complaints).toEqual([]);
    });
  });
});
