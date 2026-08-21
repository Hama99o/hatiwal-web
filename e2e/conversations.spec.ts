import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE, EMPTY_STATE } from "./auth-paths";
import {
  conversationPreviewText,
  type PreviewTranslate,
} from "../src/lib/conversation-preview";
import { filterConversations } from "../src/lib/filter-conversations";
import { formatPrice } from "../src/lib/format";
import type { Conversation } from "../src/lib/types";

/*
 * The mock inbox is 26 threads (Rails paginates this index at 20/page), so
 * page 1 fills and page 2 holds 6. "Sohail Barakzai" (id 121) is the LAST row,
 * i.e. reachable only after a Load-more, and is the only unread row on page 2.
 */
const PAGE_SIZE = 20;
// 4 hero threads + 22 filler. The 4th hero is the thread on the multi-unit
// listing (14), which the buyer picker needs so the "how many did you sell?"
// field is reachable at all — see e2e/my-listings.spec.ts.
const INBOX_TOTAL = 26;
const ARCHIVED_TOTAL = 22;
/** Threads about listing 3 (Toyota Corolla 2015) — the ?listing= view. */
const LISTING_3_TOTAL = 23;
const PAGE_TWO_ROW = "Sohail Barakzai";

// ── Unit: the search predicate + the preview helper (no browser) ─────────────
// Both are pure modules shared by the row (which renders the preview) and the
// filter (which matches on it), so they are exercised directly.

const EN_STRINGS: Record<string, string> = {
  "chat.preview.meetup": "Meetup proposal",
  "chat.preview.offer": "Offer: {price}",
  "chat.preview.counterOffer": "Counter-offer: {price}",
  "chat.preview.photo": "Photo",
  "chat.preview.file": "File",
  "chat.noMessages": "No messages yet",
};

const t: PreviewTranslate = (key, values) =>
  (EN_STRINGS[key] ?? key).replace(/\{(\w+)\}/g, (_, name) =>
    String(values?.[name] ?? ""),
  );

/** The bound formatters the view passes in, for the two numeral systems. */
const enPrice = (amount: number | null | undefined, currency?: string | null) =>
  formatPrice(amount ?? null, currency ?? null, "en");
const psPrice = (amount: number | null | undefined, currency?: string | null) =>
  formatPrice(amount ?? null, currency ?? null, "ps");

function conv(over: Partial<Conversation> = {}): Conversation {
  return {
    id: 1,
    status: "open",
    lastMessageAt: "2026-06-21T15:00:00Z",
    createdAt: "2026-06-20T10:00:00Z",
    listing: {
      id: 1,
      title: "iPhone 13 Pro",
      thumbnailUrl: null,
      status: "active",
    },
    otherParticipant: { id: 2, name: "Sara Ahmadi" },
    lastMessageBody: "Is this still available?",
    lastMessageKind: "text",
    unreadCount: 0,
    ...over,
  };
}

test.describe("conversationPreviewText (unit)", () => {
  test("renders the human preview for every special kind", () => {
    expect(
      conversationPreviewText(
        conv({ lastMessageKind: "meetup_proposal", lastMessageBody: "Kabul | 4pm" }),
        t,
        enPrice,
      ),
    ).toBe("Meetup proposal");
    expect(
      conversationPreviewText(
        conv({ lastMessageKind: "image_message", lastMessageBody: "photo.jpg" }),
        t,
        enPrice,
      ),
    ).toBe("Photo");
    expect(
      conversationPreviewText(
        conv({ lastMessageKind: "document", lastMessageBody: "receipt.pdf" }),
        t,
        enPrice,
      ),
    ).toBe("File");
  });

  test("formats an offer / counter-offer amount for the locale", () => {
    const offer = conv({
      lastMessageKind: "offer",
      lastMessageBody: "75000|AFN|90000",
    });
    // Intl separates the currency code with a NBSP — keep it literal here so a
    // future formatter change is caught rather than whitespace-normalized away.
    expect(conversationPreviewText(offer, t, enPrice)).toBe(
      "Offer: AFN\u00A075,000",
    );
    // ps/fa render through fa-AF, i.e. Eastern-Arabic digits + the ؋ symbol.
    expect(conversationPreviewText(offer, t, psPrice)).toContain("۷۵٬۰۰۰");
    expect(
      conversationPreviewText({ ...offer, lastMessageKind: "offer_counter" }, t, enPrice),
    ).toBe("Counter-offer: AFN\u00A075,000");
  });

  test("falls back to the body, then to 'no messages'", () => {
    expect(conversationPreviewText(conv(), t, enPrice)).toBe(
      "Is this still available?",
    );
    expect(
      conversationPreviewText(conv({ lastMessageBody: null }), t, enPrice),
    ).toBe("No messages yet");
  });
});

test.describe("filterConversations (unit)", () => {
  const sara = conv({ id: 1 });
  const najib = conv({
    id: 2,
    otherParticipant: undefined,
    buyer: { id: 3, name: "Najib Rahimi" },
    listing: { id: 3, title: "Toyota Corolla 2015", thumbnailUrl: null, status: "active" },
    lastMessageBody: "Thanks!",
  });
  const zohra = conv({
    id: 3,
    otherParticipant: undefined,
    seller: { id: 4, name: "Zohra Amini" },
    listing: { id: 5, title: "MacBook Pro M2", thumbnailUrl: null, status: "active" },
    lastMessageKind: "offer",
    lastMessageBody: "75000|AFN|90000",
  });
  const meetup = conv({
    id: 4,
    otherParticipant: { id: 5, name: "Karim Sultani" },
    lastMessageKind: "meetup_proposal",
    lastMessageBody: "Kabul City Center | 4pm",
  });
  const all = [sara, najib, zohra, meetup];

  test("a blank term is not a filter", () => {
    expect(filterConversations(all, "", t, enPrice)).toBe(all);
    expect(filterConversations(all, "   ", t, enPrice)).toBe(all);
  });

  test("matches the counterpart name, incl. the buyer/seller fallbacks", () => {
    expect(filterConversations(all, "sara", t, enPrice)).toEqual([sara]);
    // otherParticipant absent → buyer, then seller.
    expect(filterConversations(all, "najib", t, enPrice)).toEqual([najib]);
    expect(filterConversations(all, "zohra", t, enPrice)).toEqual([zohra]);
  });

  test("matches the listing title", () => {
    expect(filterConversations(all, "corolla", t, enPrice)).toEqual([najib]);
    expect(filterConversations(all, "MacBook", t, enPrice)).toEqual([zohra]);
  });

  test("matches the RENDERED preview, never the raw metadata body", () => {
    // The meetup body is "Kabul City Center | 4pm" metadata; the row shows
    // "Meetup proposal", so that is what search must match.
    expect(filterConversations(all, "meetup proposal", t, enPrice)).toEqual([meetup]);
    expect(filterConversations(all, "offer", t, enPrice)).toEqual([zohra]);
    // …and the raw pipe-encoded body is NOT searchable text.
    expect(filterConversations(all, "|AFN|", t, enPrice)).toEqual([]);
  });

  test("matches an amount in either numeral system, both directions", () => {
    // Latin term against an Eastern-Arabic preview (/ps, /fa).
    expect(filterConversations(all, "75000", t, psPrice)).toEqual([zohra]);
    expect(filterConversations(all, "۷۵٬۰۰۰", t, psPrice)).toEqual([zohra]);
    // Eastern-Arabic term against a Latin, comma-grouped preview (/en).
    expect(filterConversations(all, "۷۵۰۰۰", t, enPrice)).toEqual([zohra]);
    expect(filterConversations(all, "75,000", t, enPrice)).toEqual([zohra]);
  });

  test("is case-insensitive and trims", () => {
    expect(filterConversations(all, "  SARA  ", t, enPrice)).toEqual([sara]);
  });
});

// ── Browser ─────────────────────────────────────────────────────────────────

const threadLinks = (page: Page) => page.locator('a[href*="/conversations/"]');
const row = (page: Page, name: string) =>
  page.getByRole("listitem").filter({ hasText: name });
const loadMore = (page: Page) =>
  page.getByRole("button", { name: "Load more", exact: true });
const searchField = (page: Page) => page.getByTestId("conversations-search");
/** The shared SearchField's clear button, whose aria-label is localized. */
const CLEAR_LABEL: Record<string, string> = { en: "Clear", ps: "پاکول" };

/** A conversation row as the mock API serializes it (snake_case). */
type MockRow = { id: number; unread_count?: number } & Record<string, unknown>;

/**
 * The mock API holds no state, so an archived (or marked-read) row would come
 * straight back on the refetch the mutation triggers. This models a real
 * backend — once the PUT has been seen, later index responses reflect it — so a
 * spec can assert the SETTLED list, not just the optimistic frame.
 */
async function persistMutation(
  page: Page,
  action: "archive" | "mark_read",
  apply: (rows: MockRow[]) => MockRow[],
) {
  let seen = false;
  await page.route(`**/api/me/conversations/*/${action}`, (route) => {
    seen = true;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route(/\/api\/me\/conversations(\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { conversations: MockRow[] };
    if (seen) body.conversations = apply(body.conversations);
    return route.fulfill({
      status: response.status(),
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

test.describe("Conversations inbox", () => {
  test.use({ storageState: BUYER_STATE });

  // The optimistic mutations kick off a refetch that is still in flight when
  // the last assertion passes; a route handler surviving page close fails the
  // test on a callback error that has nothing to do with the assertion.
  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("lists conversations with participant + listing", async ({ page }) => {
    await page.goto("/en/conversations");
    await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible();
    await expect(page.getByText("Sara Ahmadi")).toBeVisible();
    await expect(page.getByText("Is this still available?")).toBeVisible();
    await expect(page.getByText("Najib Rahimi")).toBeVisible();
    // One page — the rest are behind Load more (see the pagination spec).
    await expect(threadLinks(page)).toHaveCount(PAGE_SIZE);
  });

  test("opening a conversation goes to its thread", async ({ page }) => {
    await page.goto("/en/conversations");
    await page.locator('a[href*="/conversations/1"]').first().click();
    await expect(page).toHaveURL(/\/conversations\/1/);
    await expect(page.getByPlaceholder("Type a message...")).toBeVisible();
  });

  // ── Pagination (the inbox used to stop dead at 20 threads) ────────────────

  test("Load more appends the remaining threads and then disappears", async ({
    page,
  }) => {
    await page.goto("/en/conversations");
    await expect(threadLinks(page)).toHaveCount(PAGE_SIZE);
    // Thread 21+ is unreachable without paging.
    await expect(row(page, PAGE_TWO_ROW)).toHaveCount(0);

    await loadMore(page).click();
    await expect(threadLinks(page)).toHaveCount(INBOX_TOTAL);
    await expect(row(page, PAGE_TWO_ROW)).toBeVisible();
    // pagination.nextPage is null on the last page.
    await expect(loadMore(page)).toHaveCount(0);
  });

  test("the Archived tab paginates too", async ({ page }) => {
    await page.goto("/en/conversations");
    await page.getByRole("tab", { name: "Archived" }).click();
    await expect(threadLinks(page)).toHaveCount(PAGE_SIZE);
    await loadMore(page).click();
    await expect(threadLinks(page)).toHaveCount(ARCHIVED_TOTAL);
    await expect(loadMore(page)).toHaveCount(0);
  });

  test("the per-listing view paginates too", async ({ page }) => {
    await page.goto("/en/conversations?listing=3");
    await expect(
      page.getByRole("heading", { name: "Conversations for this listing" }),
    ).toBeVisible();
    await expect(threadLinks(page)).toHaveCount(PAGE_SIZE);
    await loadMore(page).click();
    await expect(threadLinks(page)).toHaveCount(LISTING_3_TOTAL);
    await expect(loadMore(page)).toHaveCount(0);
  });

  // ── The row mutations still work on a row that only page 2 has ───────────

  test("archiving a page-2 row removes it optimistically and stays gone", async ({
    page,
  }) => {
    await persistMutation(page, "archive", (rows) =>
      rows.filter((c) => c.id !== 121),
    );
    await page.goto("/en/conversations");
    await loadMore(page).click();
    const target = row(page, PAGE_TWO_ROW);
    await expect(target).toBeVisible();

    await target
      .getByRole("button", { name: "Conversation options", exact: true })
      .click();
    const refetched = page.waitForResponse(
      (r) =>
        /\/api\/me\/conversations(\?|$)/.test(r.url()) &&
        r.request().method() === "GET",
    );
    await page.getByRole("menuitem", { name: "Archive", exact: true }).click();
    await expect(target).toHaveCount(0);
    await refetched;
    await expect(target).toHaveCount(0);
  });

  test("a failed archive rolls the page-2 row back and toasts", async ({
    page,
  }) => {
    await page.route("**/api/me/conversations/*/archive", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "boom" }),
      }),
    );
    await page.goto("/en/conversations");
    await loadMore(page).click();
    const target = row(page, PAGE_TWO_ROW);
    await target
      .getByRole("button", { name: "Conversation options", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "Archive", exact: true }).click();

    await expect(
      page.getByText("Could not update archive status. Please try again."),
    ).toBeVisible();
    await expect(target).toBeVisible();
  });

  test("marking a page-2 row read clears its badge and refreshes the header", async ({
    page,
  }) => {
    await persistMutation(page, "mark_read", (rows) =>
      rows.map((c) => (c.id === 121 ? { ...c, unread_count: 0 } : c)),
    );
    await page.goto("/en/conversations");
    await loadMore(page).click();
    const target = row(page, PAGE_TWO_ROW);
    await expect(target.getByTestId("count-badge")).toHaveText("1");

    await target
      .getByRole("button", { name: "Conversation options", exact: true })
      .click();
    // The aggregate header badge is re-derived from the session probe.
    const sessionProbe = page.waitForRequest("**/api/auth/session");
    await page.getByRole("menuitem", { name: "Mark as read", exact: true }).click();
    await expect(target.getByTestId("count-badge")).toHaveCount(0);
    await sessionProbe;
    await expect(target.getByTestId("count-badge")).toHaveCount(0);
  });

  test("a failed mark-as-read rolls back and toasts", async ({ page }) => {
    await page.route("**/api/me/conversations/*/mark_read", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "boom" }),
      }),
    );
    await page.goto("/en/conversations");
    await loadMore(page).click();
    const target = row(page, PAGE_TWO_ROW);
    await target
      .getByRole("button", { name: "Conversation options", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "Mark as read", exact: true }).click();

    await expect(
      page.getByText("Could not update read status. Please try again."),
    ).toBeVisible();
    await expect(target.getByTestId("count-badge")).toHaveText("1");
  });

  // ── Search ───────────────────────────────────────────────────────────────

  test("search filters by name, listing title or preview, and highlights", async ({
    page,
  }) => {
    await page.goto("/en/conversations");
    const field = searchField(page);

    await field.fill("najib");
    await expect(threadLinks(page)).toHaveCount(1);
    await expect(row(page, "Najib Rahimi")).toBeVisible();
    // Highlighted, so the row shows WHY it matched.
    await expect(page.locator("mark").first()).toHaveText(/najib/i);

    // Listing title (only the MacBook thread has it — 18 loaded rows are about
    // the Corolla, so that title would prove nothing about narrowing).
    await field.fill("MacBook");
    await expect(threadLinks(page)).toHaveCount(1);
    await expect(page.locator("mark").first()).toHaveText("MacBook");
    // …and its preview is the RENDERED offer, not the raw "75000|AFN|90000".
    await expect(page.getByText("Offer: AFN 75,000")).toBeVisible();

    // The preview line itself.
    await field.fill("still available");
    await expect(threadLinks(page)).toHaveCount(1);
    await expect(row(page, "Sara Ahmadi")).toBeVisible();
    await expect(page.locator("mark").first()).toHaveText("still available");

    // Clearing restores the full loaded page.
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await expect(threadLinks(page)).toHaveCount(PAGE_SIZE);
  });

  test("an offer amount is searchable in either numeral system", async ({
    page,
  }) => {
    // /en renders "AFN 75,000"; an Eastern-Arabic term must still match.
    await page.goto("/en/conversations");
    await searchField(page).fill("۷۵۰۰۰");
    await expect(threadLinks(page)).toHaveCount(1);
    await expect(page.getByText("Offer: AFN 75,000")).toBeVisible();

    // /ps renders "؋ ۷۵٬۰۰۰"; a Latin term typed on any keyboard must match it.
    await page.goto("/ps/conversations");
    await expect(page.getByText("۷۵٬۰۰۰")).toBeVisible();
    await searchField(page).fill("75000");
    await expect(threadLinks(page)).toHaveCount(1);
    await expect(page.getByText("۷۵٬۰۰۰")).toBeVisible();
  });

  test("no match shows the search empty state, honest about unloaded pages", async ({
    page,
  }) => {
    await page.goto("/en/conversations");
    await searchField(page).fill("zzzz");
    await expect(
      page.getByText('No matches for "zzzz"'),
    ).toBeVisible();
    // A page is still unloaded, so "no matches" must not read as absolute.
    await expect(
      page.getByText(
        "Try a different name, listing title, or message. Showing results in loaded conversations only.",
      ),
    ).toBeVisible();

    // Clear search → the list is back.
    await page.getByRole("button", { name: "Clear search", exact: true }).click();
    await expect(threadLinks(page)).toHaveCount(PAGE_SIZE);

    // With everything loaded the description drops the caveat.
    await loadMore(page).click();
    await searchField(page).fill("zzzz");
    await expect(
      page.getByText("Try a different name, listing title, or message.", {
        exact: true,
      }),
    ).toBeVisible();
  });

  test("the partial-results notice shows only while pages remain", async ({
    page,
  }) => {
    await page.goto("/en/conversations");
    await searchField(page).fill("deliver");
    const notice = page.getByText(
      "Showing results in loaded conversations only",
      { exact: true },
    );
    await expect(notice).toBeVisible();
    await loadMore(page).click();
    await expect(notice).toHaveCount(0);
  });

  test("search is render-only: the unread badges keep their counts", async ({
    page,
  }) => {
    await page.goto("/en/conversations");
    const headerBadge = page
      .locator("header")
      .getByTestId("count-badge")
      .first();
    await expect(headerBadge).toHaveText("2");

    // "najib" filters the only unread row (Sara, 2 unread) out of view.
    await searchField(page).fill("najib");
    await expect(threadLinks(page)).toHaveCount(1);
    await expect(headerBadge).toHaveText("2");

    await searchField(page).fill("sara");
    await expect(row(page, "Sara Ahmadi").getByTestId("count-badge")).toHaveText(
      "2",
    );
  });

  test("search works at 375px in RTL with no horizontal overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });

    for (const locale of ["en", "ps"] as const) {
      await page.goto(`/${locale}/conversations`);
      const field = searchField(page);
      await field.fill("najib");
      await expect(row(page, "Najib Rahimi")).toBeVisible();
      await expect(page.locator("mark").first()).toBeVisible();

      // The clear button mirrors: it sits at the INLINE END of the field.
      const clear = page.getByRole("button", {
        name: CLEAR_LABEL[locale],
        exact: true,
      });
      const box = (await clear.boundingBox())!;
      if (locale === "ps") {
        await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
        expect(box.x).toBeLessThan(187);
      } else {
        expect(box.x).toBeGreaterThan(187);
      }

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    }
  });

  test("the search field and highlight survive dark mode", async ({ page }) => {
    await page.goto("/en/conversations");
    const html = page.locator("html");
    if (!((await html.getAttribute("class")) || "").includes("dark")) {
      await page.getByRole("button", { name: "Toggle theme" }).click();
    }
    await expect(html).toHaveClass(/dark/);

    await searchField(page).fill("najib");
    const mark = page.locator("mark").first();
    await expect(mark).toBeVisible();
    // The highlight is a real tint in dark too, not a transparent no-op.
    const background = await mark.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(background).not.toBe("rgba(0, 0, 0, 0)");
  });
});

test.describe("Conversations inbox (empty)", () => {
  test.use({ storageState: EMPTY_STATE });

  test("shows the empty state without a search box", async ({ page }) => {
    await page.goto("/en/conversations");
    await expect(page.getByText("No conversations yet")).toBeVisible();
    // A search field over nothing is noise.
    await expect(searchField(page)).toHaveCount(0);
  });
});

test.describe("Conversations (guest)", () => {
  test("redirects an unauthenticated visitor to login", async ({ page }) => {
    await page.goto("/en/conversations");
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });
});
