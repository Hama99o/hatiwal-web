import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

/*
 * Conversations with no listing — a removed listing, and a support thread.
 *
 * A conversation whose listing is GONE — deleted by its seller (a soft remove)
 * or taken down by an admin. The API has sent `listing: null` +
 * `listing_deleted: true` for that since June 2026
 * (ConversationSerializer: `next nil if c.listing_deleted?`).
 *
 * The web read `c.listing.title` unguarded in the inbox row and
 * `conversation.listing.id` in the thread header, so one such thread threw and
 * replaced the WHOLE inbox with "Something went wrong". These specs reshape the
 * mock's payload into exactly what the serializer sends, on the proxied
 * `/api/me` path the browser actually calls.
 */

type Row = { id: number } & Record<string, unknown>;

/** The serializer's removed-listing shape, applied to one conversation. */
const removed = (row: Row): Row => ({
  ...row,
  listing: null,
  listing_deleted: true,
});

/**
 * The serializer's SUPPORT-thread shape (hatiwal-api/docs/SUPPORT_MESSAGING.md):
 * no listing, and `listing_deleted: true` ON PURPOSE (old clients show a banner
 * instead of crashing) — so only `kind` tells it apart from a removed listing.
 */
const SUPPORT_ACCOUNT = {
  id: 9000,
  name: "Hatiwal Support",
  city: null,
  verified: true,
  avatar_url: null,
};
const support = (row: Row): Row => ({
  ...row,
  kind: "support",
  viewer_role: null,
  listing: null,
  listing_deleted: true,
  other_participant: SUPPORT_ACCOUNT,
  seller: SUPPORT_ACCOUNT,
  blocked_with_participant: false,
  blocked_by_me: false,
});

async function reshapeInbox(page: Page, id: number, fn: (r: Row) => Row) {
  await page.route(/\/api\/me\/conversations(\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { conversations: Row[] };
    body.conversations = body.conversations.map((c) => (c.id === id ? fn(c) : c));
    return route.fulfill({ response, json: body });
  });
}

async function reshapeThread(page: Page, id: number, fn: (r: Row) => Row) {
  await page.route(`**/api/me/conversations/${id}`, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as Record<string, unknown>;
    // The show endpoint may or may not wrap the record; handle both shapes.
    const json =
      body.conversation && typeof body.conversation === "object"
        ? { ...body, conversation: fn(body.conversation as Row) }
        : fn(body as Row);
    return route.fulfill({ response, json });
  });
}

const removeListingInInbox = (page: Page, id: number) =>
  reshapeInbox(page, id, removed);
const removeListingInThread = (page: Page, id: number) =>
  reshapeThread(page, id, removed);

test.describe("Conversation whose listing was removed", () => {
  test.use({ storageState: BUYER_STATE });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("the inbox still renders, and that row says the listing was removed", async ({
    page,
  }) => {
    await removeListingInInbox(page, 1);
    await page.goto("/en/conversations");

    await expect(page.getByText("This listing has been removed")).toBeVisible();
    // The rest of the inbox survives — the bug was the whole list, not the row.
    await expect(page.getByRole("listitem").nth(1)).toBeVisible();
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  });

  test("the thread renders its messages under a removed-listing notice", async ({
    page,
  }) => {
    await removeListingInThread(page, 1);
    await page.goto("/en/conversations/1");

    await expect(page.getByText("This listing has been removed")).toBeVisible();
    await expect(
      page.getByText("Hello, I'm interested in the iPhone."),
    ).toBeVisible();
    await expect(page.getByPlaceholder("Type a message...")).toBeVisible();
    // No pinned-listing link to a listing that no longer exists. (Scoped to a
    // numeric id: the nav's "Sell" link is /listings/new.)
    await expect(page.locator('a[href$="/listings/1"]')).toHaveCount(0);
  });

  test("the notice is translated (ps, RTL)", async ({ page }) => {
    await removeListingInThread(page, 1);
    await page.goto("/ps/conversations/1");
    await expect(page.getByText("دا خپرونه لرې شوې ده")).toBeVisible();
  });
});

test.describe("Support thread", () => {
  test.use({ storageState: BUYER_STATE });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("the inbox row is Hatiwal Support, not a removed listing", async ({
    page,
  }) => {
    await reshapeInbox(page, 1, support);
    await page.goto("/en/conversations");

    const row = page
      .getByRole("listitem")
      .filter({ hasText: "Official messages from the Hatiwal team" });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Hatiwal Support");
    // Kind is read BEFORE listingDeleted — which a support thread reports true.
    await expect(page.getByText("This listing has been removed")).toHaveCount(0);
  });

  test("the thread drops every marketplace control", async ({ page }) => {
    await reshapeThread(page, 1, support);
    await page.goto("/en/conversations/1");

    await expect(page.getByText("Official messages from the Hatiwal team")).toBeVisible();
    await expect(page.getByPlaceholder("Type a message...")).toBeVisible();

    // Block and Report are 403 on Support; meetups are a 422 there.
    await expect(page.getByRole("button", { name: "Block User" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /report/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Propose Meetup" })).toHaveCount(0);
    // No buyer quick-reply chips (the same text is also a message bubble in
    // this mock thread, so look for the chip button only).
    await expect(
      page.getByRole("button", { name: "Is this still available?" }),
    ).toHaveCount(0);
    // Neither the listing header nor the removed-listing notice.
    await expect(page.getByText("This listing has been removed")).toHaveCount(0);
    await expect(page.locator('a[href$="/listings/1"]')).toHaveCount(0);
    // No link to a public profile for the Support account.
    await expect(page.locator('a[href*="/sellers/9000"]')).toHaveCount(0);
  });

  test("the name is localized, never the stored English name (ps)", async ({
    page,
  }) => {
    await reshapeThread(page, 1, support);
    await page.goto("/ps/conversations/1");
    await expect(page.getByText("د هتیوال ملاتړ")).toBeVisible();
    await expect(page.getByText("Hatiwal Support")).toHaveCount(0);
  });
});
