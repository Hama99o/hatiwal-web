import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

/*
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

async function removeListingInInbox(page: Page, id: number) {
  await page.route(/\/api\/me\/conversations(\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { conversations: Row[] };
    body.conversations = body.conversations.map((c) =>
      c.id === id ? removed(c) : c,
    );
    return route.fulfill({ response, json: body });
  });
}

async function removeListingInThread(page: Page, id: number) {
  await page.route(`**/api/me/conversations/${id}`, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as Record<string, unknown>;
    // The show endpoint may or may not wrap the record; handle both shapes.
    const json =
      body.conversation && typeof body.conversation === "object"
        ? { ...body, conversation: removed(body.conversation as Row) }
        : removed(body as Row);
    return route.fulfill({ response, json });
  });
}

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
