import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

/*
 * closed-shop-face (api a3ca16b, side branch `closed-shop-face`).
 *
 * When a shop closes its product chats go back to the owner, but what the team
 * wrote AS the shop before the closure stays the shop's: the shop's name, a
 * "Closed" marker, a neutral shop square — never a member's personal name.
 * What the owner writes after the closure is personal. The conversation carries
 * `closed_shop: {name, closed_at}`, which the composer note and the inbox row read.
 *
 * Mock fixture: conversation 430 (e2e/mock-api/server.mjs), the buyer persona's
 * chat with "Rahimi Perfumes", now owned personally by "Hamid Rahimi".
 */
test.use({ storageState: BUYER_STATE });

const SHOP = "Rahimi Perfumes";
const OWNER = "Hamid Rahimi";
/** A member's personal name that must never surface on the shop's messages. */
const MEMBER = "Farid Noori";

test.describe("closed shop's product chat — buyer", () => {
  test("the shop's old messages show the shop + Closed; the new one shows the owner", async ({ page }) => {
    await page.goto("/en/conversations/430");
    await expect(page.getByText("Salaam! Yes, we have it in stock.")).toBeVisible();

    // One run of two shop messages → one label, the shop's name + Closed + a
    // neutral shop square (no logo, no person).
    const shopLabel = page.getByTestId("message-closed-shop-sender");
    await expect(shopLabel).toHaveCount(1);
    await expect(shopLabel.getByTestId("message-closed-shop-name")).toHaveText(SHOP);
    await expect(shopLabel.getByTestId("message-closed-shop-badge")).toHaveText("Closed");
    await expect(shopLabel.getByTestId("shop-closed-avatar")).toBeVisible();
    await expect(shopLabel).not.toContainText(OWNER);
    await expect(shopLabel.locator("img")).toHaveCount(0);

    // The owner's reply after the closure is personal.
    const personal = page.getByTestId("message-personal-sender");
    await expect(personal).toHaveCount(1);
    await expect(personal.getByTestId("message-personal-sender-name")).toHaveText(OWNER);

    // No member's personal name anywhere in the thread.
    await expect(page.getByText(MEMBER)).toHaveCount(0);
  });

  test("the composer note says the shop closed and who writes now", async ({ page }) => {
    await page.goto("/en/conversations/430");
    await expect(page.getByTestId("chat-closed-shop-note")).toHaveText(
      `${SHOP} has closed — new messages come from the seller personally`,
    );
    await expect(page.getByTestId("chat-replying-as")).toHaveCount(0);
    // The composer is still there: the chat goes on with the owner.
    await expect(page.getByPlaceholder("Type a message...")).toBeVisible();
  });

  test("RTL (fa): the note and the Closed marker are translated", async ({ page }) => {
    await page.goto("/fa/conversations/430");
    await expect(page.getByTestId("chat-closed-shop-note")).toContainText(SHOP);
    await expect(page.getByTestId("chat-closed-shop-note")).toContainText("دوکان");
    await expect(page.getByTestId("message-closed-shop-badge")).toHaveText("بسته شده");
    expect(await page.locator("html").getAttribute("dir")).toBe("rtl");
  });

  test("a chat whose shop has not closed shows none of it", async ({ page }) => {
    await page.goto("/en/conversations/1");
    await expect(page.getByTestId("chat-closed-shop-note")).toHaveCount(0);
    await expect(page.getByTestId("message-closed-shop-sender")).toHaveCount(0);
    await expect(page.getByTestId("message-personal-sender")).toHaveCount(0);
  });
});

test("the owner sees the seller-side note, and the shop's old messages on their side", async ({ page }) => {
  // Same chat, from the OWNER's side (the signed-in persona, id 1, plays the owner).
  await page.route("**/api/me/conversations/430", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    const json = await res.json();
    json.conversation = {
      ...json.conversation,
      viewer_role: "seller",
      other_participant: { id: 7, name: "Zarghona Popal", city: "Kabul", verified: false, avatar_url: null },
      buyer: { id: 7, name: "Zarghona Popal", city: "Kabul", avatar_url: null },
      seller: { id: 1, name: "Ahmad Karimi", city: "Kabul", avatar_url: null },
    };
    await route.fulfill({ response: res, json });
  });
  await page.route(/\/api\/me\/conversations\/430\/messages/, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    const json = await res.json();
    const shopSender = { id: 1, name: SHOP, avatar_url: null, as_shop: true, shop_closed: true };
    json.messages = [
      { id: 4311, body: "Is the attar still available?", kind: "text", read_at: null, created_at: "2026-10-04T09:00:00Z", responds_to_id: null, sender: { id: 7, name: "Zarghona Popal", avatar_url: null }, attachment_url: null },
      { id: 4310, body: "Salaam! Yes, we have it in stock.", kind: "text", read_at: null, created_at: "2026-10-01T09:30:00Z", responds_to_id: null, sender: shopSender, sent_by: { id: 1, name: "Ahmad Karimi" }, attachment_url: null },
    ];
    await route.fulfill({ response: res, json });
  });
  await page.goto("/en/conversations/430");
  await expect(page.getByTestId("chat-closed-shop-note")).toHaveText(
    `${SHOP} has closed — you're now replying as yourself`,
  );
  // The owner's own shop message sits on their side: no other-side shop label.
  await expect(page.getByText("Salaam! Yes, we have it in stock.")).toBeVisible();
  await expect(page.getByTestId("message-closed-shop-sender")).toHaveCount(0);
});

test("inbox: the row names the owner and says which shop closed", async ({ page }) => {
  const ROW = {
    id: 430, kind: "listing", status: "open", viewer_role: "buyer", last_message_at: "2026-10-04T10:00:00Z", created_at: "2026-10-01T09:00:00Z",
    listing: { id: 9043, title: "Rose Attar (12 ml)", thumbnail_url: null, status: "active", price: 1200, currency: "AFN", location: "Kabul" },
    shop: null,
    closed_shop: { name: SHOP, closed_at: "2026-10-03T09:00:00Z" },
    other_participant: { id: 6, name: OWNER, city: "Kabul", verified: false, avatar_url: null },
    buyer: { id: 1, name: "Ahmad Karimi", city: "Kabul", avatar_url: null },
    seller: { id: 6, name: OWNER, city: "Kabul", avatar_url: null },
    unread_count: 0, last_message_body: "I can still sell it to you myself.", last_message_kind: "text", blocked_with_participant: false,
  };
  await page.route(/\/api\/me\/conversations(\?.*)?$/, (route) =>
    route.fulfill({ json: { conversations: [ROW], meta: { pagination: { current_page: 1, next_page: null, prev_page: null, total_count: 1, total_pages: 1 } } } }),
  );
  await page.goto("/en/conversations");
  const line = page.getByTestId("conversation-closed-shop-430");
  await expect(line).toHaveText(`${SHOP} · closed`);
  const row = page.locator("li", { has: line });
  await expect(row).toContainText(OWNER);
  await expect(row).toContainText("Rose Attar (12 ml)");
});
