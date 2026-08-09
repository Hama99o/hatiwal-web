import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import { dayKey } from "../src/lib/message-days";
import { formatDate } from "../src/lib/format";
import en from "../messages/en.json";
import ps from "../messages/ps.json";
import fa from "../messages/fa.json";

/**
 * Chat bubble meta row (D2-READ): the time on every bubble, plus the sent /
 * seen tick on my own messages, plus the day separators between calendar days.
 *
 * Fixture (e2e/mock-api/server.mjs, conversation 1, oldest → newest):
 *   id 1  incoming text      2026-06-20  ← its own local day
 *   id 2  mine text, read    2026-06-21  → double tick
 *   id 3  incoming text      2026-06-21  → no tick
 *   id 6  mine text, unread  2026-06-21  → single tick
 *   id 7  mine meetup, read  2026-06-21
 *   id 8  mine document      2026-06-21
 *   id 9  incoming offer     2026-06-21
 *   id 10 system pill        2026-06-21  → no meta row
 *   id 11 tombstone          2026-06-21  → no meta row
 *   id 12 offer_declined pill 2026-06-21 → no meta row
 */

// Bubbles that must carry a meta row: 4 text + meetup + document + offer.
const BUBBLES_WITH_META = 7;

const MINE_SEEN = "Yes, it is still available.";
const MINE_UNSEEN = "I can bring it to Shar-e-Naw.";
const INCOMING = "Is this still available?";
const OLDEST_DAY = "2026-06-20T10:00:00Z";
const NEWEST_DAY = "2026-06-21T15:00:00Z";

const SENT = en.chat.message.sent;
const SEEN = en.chat.message.seen;

/**
 * The bubble that owns `text` — the nearest ancestor <div> that holds a meta
 * row (i.e. the bubble wrapper), found without depending on utility classes.
 * `selector` scopes the text to the element that renders it ("p" for a message
 * body / card label, "a" for an attachment link) so a quick-reply chip with the
 * same wording never matches.
 */
function bubbleWith(page: Page, selector: string, text: string) {
  return page
    .locator(selector, { hasText: text })
    .locator("xpath=ancestor-or-self::div[div[@data-testid='message-meta']][1]");
}

/** Any time-shaped string, in Latin or Arabic-Indic (ps/fa) digits. */
const TIME_RE = /[\d۰-۹٠-٩]{1,2}:[\d۰-۹٠-٩]{2}/;

/**
 * Opens a thread and waits until its bubbles are actually on screen.
 *
 * Every test in this file goes through here. On a cold `.next-e2e`, the first
 * hit of `/[locale]/conversations/[id]` compiles the route AND, separately, the
 * client island that renders the bubbles; with the suite's workers all landing
 * on that route at once the island can arrive later than the default 15s
 * `expect` timeout, which would flake the first test to run rather than flag a
 * real regression. Waiting once, generously, on the meta row (the thing this
 * spec is about) keeps every later assertion at the default timeout, where a
 * failure does mean the feature is broken.
 */
async function openThread(page: Page, path = "/en/conversations/1") {
  await page.goto(path);
  await expect(page.getByTestId("message-meta").first()).toBeVisible({
    timeout: 90_000,
  });
}

/**
 * Shifts every fixture timestamp of conversation 1 so its newest day lands
 * `dayOffset` days before today, keeping the relative order and the local
 * wall-clock time. Lets the static fixture exercise the Today / Yesterday
 * separator labels deterministically. Must be called before `page.goto`.
 */
async function retimeThread(page: Page, dayOffset: number) {
  const target = new Date();
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() - dayOffset);
  const anchor = new Date(2026, 5, 21); // local midnight of the fixture's newest day
  const deltaDays = Math.round(
    (target.getTime() - anchor.getTime()) / 86_400_000,
  );
  await page.route("**/api/me/conversations/1/messages*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    const json = await res.json();
    if (Array.isArray(json.messages)) {
      json.messages = json.messages.map((m: { created_at: string }) => {
        const d = new Date(m.created_at);
        d.setDate(d.getDate() + deltaDays);
        return { ...m, created_at: d.toISOString() };
      });
    }
    await route.fulfill({ response: res, json });
  });
}

test.describe("Chat timestamps + read receipts", () => {
  test.use({ storageState: BUYER_STATE });
  // Several tests here navigate more than once (en → conversation 2, en → ps →
  // fa, thread → inbox → thread → reload). On a cold `.next-e2e` each of those
  // is its own dev-mode compile, so the suite-wide 120s budget can run out
  // mid-navigation on a loaded machine with nothing actually wrong. A warm run
  // never comes near this cap.
  test.describe.configure({ timeout: 240_000 });

  test("every bubble shows a time; pills and the tombstone show none", async ({
    page,
  }) => {
    await openThread(page);
    await expect(page.locator("p", { hasText: MINE_UNSEEN })).toBeVisible();

    // Structured bubbles are part of the count below.
    await expect(page.getByText(en.chat.offer.yourOffer)).toBeVisible();
    await expect(page.getByText("Kabul City Center")).toBeVisible();
    await expect(page.getByText("receipt.pdf")).toBeVisible();

    const metas = page.getByTestId("message-meta");
    await expect(metas).toHaveCount(BUBBLES_WITH_META);
    for (let i = 0; i < BUBBLES_WITH_META; i++) {
      await expect(metas.nth(i)).toHaveText(TIME_RE);
    }

    // The centred system + declined pills and the tombstone carry no meta row.
    for (const text of [
      "This listing was marked as reserved.",
      en.chat.offer.declined,
      en.chat.message.deleted,
    ]) {
      const pill = page.getByText(text).locator("..");
      await expect(pill).toBeVisible();
      await expect(pill.getByTestId("message-meta")).toHaveCount(0);
    }
  });

  test("my read message shows a double tick, my unread one a single tick, incoming none", async ({
    page,
  }) => {
    await openThread(page);

    const seen = bubbleWith(page, "p", MINE_SEEN);
    await expect(seen.getByTitle(SEEN)).toBeVisible();
    // Accessible name comes from the new keys, not a screenshot.
    await expect(seen.getByRole("img", { name: SEEN })).toBeVisible();
    await expect(seen.getByTitle(SENT)).toHaveCount(0);

    const unseen = bubbleWith(page, "p", MINE_UNSEEN);
    await expect(unseen.getByTitle(SENT)).toBeVisible();
    await expect(unseen.getByRole("img", { name: SENT })).toBeVisible();
    await expect(unseen.getByTitle(SEEN)).toHaveCount(0);

    // An incoming message has a time but never a tick.
    const incoming = bubbleWith(page, "p", INCOMING);
    await expect(incoming.getByTestId("message-meta")).toHaveText(TIME_RE);
    await expect(incoming.locator("[title]")).toHaveCount(0);

    // A structured bubble of mine (the meetup card) gets the tick treatment too.
    await expect(
      bubbleWith(page, "p", "Kabul City Center").getByTitle(SEEN),
    ).toBeVisible();
  });

  test("a two-day thread renders one separator, a single-day thread none", async ({
    page,
  }) => {
    // Guard: the fixture must straddle two LOCAL days for the count to hold.
    expect(dayKey(OLDEST_DAY)).not.toBe(dayKey(NEWEST_DAY));

    await openThread(page);
    await expect(page.locator("p", { hasText: MINE_UNSEEN })).toBeVisible();
    const separators = page.getByTestId("day-separator");
    await expect(separators).toHaveCount(1);
    await expect(separators).toHaveText(formatDate(NEWEST_DAY, "en"));

    // Conversation 2's messages all land on one day → no separator.
    await openThread(page, "/en/conversations/2");
    await expect(page.getByText("Thanks!")).toBeVisible();
    await expect(page.getByTestId("day-separator")).toHaveCount(0);
  });

  test("the separator reads Today / Yesterday when the day matches", async ({
    page,
  }) => {
    await retimeThread(page, 0);
    await openThread(page);
    await expect(page.getByTestId("day-separator")).toHaveText(
      en.chat.day.today,
    );

    await page.unrouteAll();
    await retimeThread(page, 1);
    await page.reload();
    await expect(page.getByTestId("day-separator")).toHaveText(
      en.chat.day.yesterday,
    );
  });

  test("in-thread search hides the separators and keeps its match count", async ({
    page,
  }) => {
    await openThread(page);
    await expect(page.getByTestId("day-separator")).toHaveCount(1);

    await page
      .getByRole("button", { name: en.chat.search.placeholder })
      .click();
    await page.getByPlaceholder(en.chat.search.placeholder).fill("available");

    // 2 of the 4 searchable (text, non-deleted) messages match.
    await expect(page.getByText("2 of 4")).toBeVisible();
    await expect(page.locator("mark").first()).toBeVisible();
    await expect(page.getByTestId("day-separator")).toHaveCount(0);
  });

  test("a message sent now shows its time and a single tick", async ({
    page,
  }) => {
    await openThread(page);
    const composer = page.getByPlaceholder(en.chat.messagePlaceholder);
    await composer.fill("On my way now.");
    await page.getByRole("button", { name: en.chat.send }).click();

    const sent = bubbleWith(page, "p", "On my way now.");
    await expect(sent.getByTitle(SENT)).toBeVisible();
    await expect(sent.getByTestId("message-meta")).toHaveText(TIME_RE);
    // Draft behaviour unchanged: a successful send clears the composer.
    await expect(composer).toHaveValue("");
  });

  test("the tick flips to seen on the next fetch without dropping visit messages", async ({
    page,
  }) => {
    let read = false;
    await page.route("**/api/me/conversations/1/messages*", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const res = await route.fetch();
      const json = await res.json();
      if (read && Array.isArray(json.messages)) {
        json.messages = json.messages.map(
          (m: { id: number; read_at: string | null }) =>
            m.id === 6 ? { ...m, read_at: "2026-06-21T16:00:00Z" } : m,
        );
      }
      await route.fulfill({ response: res, json });
    });

    await openThread(page);
    await expect(
      bubbleWith(page, "p", MINE_UNSEEN).getByTitle(SENT),
    ).toBeVisible();

    // A message sent during the visit survives leaving and re-entering the thread.
    const duringVisit = "Sent during this visit.";
    await page.getByPlaceholder(en.chat.messagePlaceholder).fill(duringVisit);
    await page.getByRole("button", { name: en.chat.send }).click();
    await expect(page.locator("p", { hasText: duringVisit })).toBeVisible();
    await page.getByRole("link", { name: en.common.back }).click();
    await expect(page).toHaveURL(/\/conversations$/);
    await page.locator('a[href*="/conversations/1"]').first().click();
    await expect(page.locator("p", { hasText: duringVisit })).toBeVisible();

    // The recipient opens the thread → the sender's next fetch flips the tick.
    read = true;
    await page.reload();
    await expect(
      bubbleWith(page, "p", MINE_UNSEEN).getByTitle(SEEN),
    ).toBeVisible();
  });

  test("RTL locales mirror the meta row and keep the digits legible", async ({
    page,
  }) => {
    for (const [locale, catalog, colorScheme] of [
      ["ps", ps, "dark"],
      ["fa", fa, "light"],
    ] as const) {
      await page.emulateMedia({ colorScheme });
      await openThread(page, `/${locale}/conversations/1`);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

      const meta = bubbleWith(page, "p", MINE_UNSEEN).getByTestId(
        "message-meta",
      );
      await expect(meta).toHaveText(TIME_RE);

      // The tick label comes from this locale's catalog (all 3 keys exist).
      const tick = meta.getByTitle(catalog.chat.message.sent);
      await expect(tick).toBeVisible();

      // Mirrored: in RTL the time renders on the right, the tick to its left.
      const time = meta.locator("span").first();
      const timeBox = await time.boundingBox();
      const tickBox = await tick.boundingBox();
      expect(tickBox!.x).toBeLessThan(timeBox!.x);

      // Arabic-Indic digits are not clipped by the bubble.
      expect(
        await time.evaluate((el) => el.scrollWidth > el.clientWidth + 1),
      ).toBe(false);

      // The day separator is localized through the same catalog.
      await expect(page.getByTestId("day-separator")).toHaveCount(1);
    }
  });
});
