import { meRequest } from "./me";
import type {
  Conversation,
  ConversationParticipant,
  Message,
  MessageKind,
  Pagination,
} from "../types";

/** One page of the conversations index — same shape as `ListingsResult`. */
/**
 * The ONE place that decides whether a conversation is a support thread — the
 * web twin of mobile's `isSupportThread` (src/api/conversations.ts), so the
 * two clients cannot drift. Every support-specific branch reads this, never
 * `kind` directly and never `listing == null`: a null listing also means the
 * listing was deleted (`listingDeleted`, which a support thread ALSO reports
 * as true), so it cannot tell the two apart. Branch on this FIRST.
 */
export function isSupportThread(
  conversation: Pick<Conversation, "kind"> | null | undefined,
): boolean {
  return conversation?.kind === "support";
}

/**
 * SHOP-2: a "Message shop" chat — no product, plain messages only, the shop on
 * both sides. Decided from `shopChat` (like `kind` for Support), never from
 * `listing == null`: the API reports such a chat as listing null + deleted.
 */
/**
 * The chat's shop is not open, so the API refuses new messages (422
 * shop_unavailable) and the history stays readable — mirrors the API's
 * Conversation#shut_by_shop? (api 83c6e15) and mobile af9b2b26: a "Message
 * shop" chat whenever its shop is not active; a product chat while its shop is
 * suspended or pending (a closed shop's product chats are the owner's, open).
 */
export function shopChatShut(
  conversation: Pick<Conversation, "kind" | "shop" | "shopChat" | "listing" | "listingDeleted"> | null | undefined,
): boolean {
  const status = conversation?.shop?.status;
  if (!conversation || !status || isSupportThread(conversation)) return false;
  if (isShopChat(conversation)) return status !== "active";
  return status === "suspended" || status === "pending";
}

export function isShopChat(
  conversation: Pick<Conversation, "kind" | "shop" | "shopChat" | "listing" | "listingDeleted"> | null | undefined,
): boolean {
  if (!conversation || isSupportThread(conversation) || !conversation.shop) return false;
  if (typeof conversation.shopChat === "boolean") return conversation.shopChat;
  // An API before the `shop_chat` key (api 54397ca) sent listing null + not deleted.
  return !conversation.listing && !conversation.listingDeleted;
}

export interface ConversationsResult {
  items: Conversation[];
  pagination: Pagination;
}

/**
 * One page of the conversations index.
 *
 * `GET /conversations` renders through Rails' `paginate_blue`, i.e. 20 rows per
 * page plus `meta.pagination` — this used to return `d.conversations` and drop
 * the meta, so a user with more than 20 threads simply could not reach the rest
 * on the web (mobile pages the same list). Callers that show the whole inbox
 * page through `pagination.nextPage`; callers that only need the most recent
 * threads for a listing (the buyer picker, the duplicate-conversation recovery)
 * read page 1.
 */
export async function getConversations(
  listingId?: number,
  archived?: boolean,
  page?: number,
  /**
   * Server-side search across the WHOLE inbox.
   *
   * Owner report, 2026-09-02: the search "is not connected with backend, it's
   * not search in db". It was filtering already-loaded pages in memory, so a
   * match past page 1 could not be found. Matches the other party's name, the
   * listing title, and any message body — see Conversation.matching in the API.
   */
  search?: string,
  /** SHOP-1: the identity scope for a user WITH a shop (role + shop_id=<id>|none). Omit = as before. */
  scope?: { role: "buying" | "selling"; shopId?: number | "none" },
): Promise<ConversationsResult> {
  const params = new URLSearchParams();
  if (listingId) params.set("listing_id", String(listingId));
  if (scope) {
    params.set("role", scope.role);
    if (scope.shopId !== undefined) params.set("shop_id", String(scope.shopId));
  }
  if (archived) params.set("archived", "true");
  // Trimmed, and omitted when empty: a bare `search=` would make the server run
  // a blank match instead of returning the plain inbox.
  const trimmedSearch = search?.trim();
  if (trimmedSearch) params.set("search", trimmedSearch);
  // Page 1 sends no page param, so the request the page-1 callers make is
  // byte-identical to the one they made before this function paged at all.
  if (page && page > 1) params.set("page[number]", String(page));
  const q = params.toString() ? `?${params}` : "";
  const d = await meRequest<{
    conversations: Conversation[];
    meta?: { pagination?: Pagination };
  }>(`conversations${q}`);
  const items = d.conversations ?? [];
  return {
    items,
    pagination:
      d.meta?.pagination ?? {
        currentPage: page ?? 1,
        nextPage: null,
        prevPage: null,
        totalCount: items.length,
        totalPages: 1,
      },
  };
}

export async function getConversation(
  id: number | string,
): Promise<Conversation> {
  const d = await meRequest<{ conversation: Conversation }>(
    `conversations/${id}`,
  );
  return d.conversation;
}

export async function startConversation(
  listingId: number,
  message: string,
): Promise<Conversation> {
  const d = await meRequest<{ conversation: Conversation }>(
    `listings/${listingId}/conversations`,
    { method: "POST", json: { message } },
  );
  return d.conversation;
}

/**
 * SHOP-2 "Message shop" (no product): find-or-create the caller's one
 * listing-less chat with the shop (201 the first time, 200 after).
 * 422 own_shop · 404 shop not active · 422 blocked / blocked_by (codes) · 429 throttled.
 */
export async function messageShop(shopId: number, message?: string): Promise<Conversation> {
  const d = await meRequest<{ conversation: Conversation }>(`shops/${shopId}/conversations`, {
    method: "POST",
    json: message ? { message } : {},
  });
  return d.conversation;
}

export async function getMessages(
  conversationId: number | string,
  page = 1,
): Promise<Message[]> {
  const d = await meRequest<{ messages: Message[] }>(
    `conversations/${conversationId}/messages?page[size]=50&page[number]=${page}`,
  );
  // API returns newest-first; present oldest-first for a chat thread.
  return (d.messages ?? []).slice().reverse();
}

/** Sent only in the PERSON's Support thread: Buyer mode or Seller as Me. A shop's thread is stamped by the server. */
export type SupportMessageContext = { mode: "buyer" | "seller" };

export async function sendMessage(
  conversationId: number,
  body: string,
  kind: MessageKind = "text",
  respondsToId?: number,
  /**
   * SF-B11 — how many units an offer is for. Honoured only on `offer` /
   * `offer_counter` AND only on a multi-unit listing; the server discards it
   * (stores null) otherwise, with no 422, so a single-item listing is
   * byte-identical to before this existed.
   *
   * Rejects with `code: "offer_quantity_above_available_units"` when the offer
   * asks for more units than remain.
   *
   * Sent as a real field rather than appended to the body's pipe encoding
   * ("amount|currency|listedPrice"): every client already parses those three
   * segments, and a fourth would change the meaning of a string mobile, web and
   * the API all read.
   */
  offerQuantity?: number,
  /**
   * Support thread only (api a7e1d39): where the message is written from, so
   * the admin can tell (one thread for every mode and shop). Sent only when set.
   */
  context?: SupportMessageContext,
): Promise<Message> {
  const d = await meRequest<{ message: Message }>(
    `conversations/${conversationId}/messages`,
    {
      method: "POST",
      json: {
        body,
        kind,
        respondsToId,
        ...(offerQuantity != null ? { offerQuantity } : {}),
        ...(context ? { context } : {}),
      },
    },
  );
  return d.message;
}

/** Send a photo or file as a chat message (multipart, mirrors mobile sendFile). */
export async function sendFile(
  conversationId: number,
  file: File,
): Promise<Message> {
  const kind: MessageKind = file.type.startsWith("image/")
    ? "image_message"
    : "document";
  const form = new FormData();
  form.append("kind", kind);
  form.append("body", file.name);
  form.append("attachment", file);
  const d = await meRequest<{ message: Message }>(
    `conversations/${conversationId}/messages`,
    { method: "POST", form },
  );
  return d.message;
}

/**
 * Soft-delete (retract) one of your own messages. The server flips it to a
 * tombstone (body/attachment suppressed) and broadcasts the update over the
 * conversation channel so the other participant sees it live. Returns the
 * updated (tombstoned) message.
 */
export async function deleteMessage(
  conversationId: number,
  messageId: number,
): Promise<Message> {
  const d = await meRequest<{ message: Message }>(
    `conversations/${conversationId}/messages/${messageId}`,
    { method: "DELETE" },
  );
  return d.message;
}

export async function markRead(conversationId: number): Promise<void> {
  await meRequest(`conversations/${conversationId}/messages/mark_read`, {
    method: "PUT",
  });
}

/**
 * Mark an entire conversation as read from the list (unread badge → 0) without
 * opening it. Mirrors mobile's `conversationsAPI.markRead`.
 * PUT /conversations/:id/mark_read
 */
export async function markConversationRead(id: number): Promise<void> {
  await meRequest(`conversations/${id}/mark_read`, { method: "PUT" });
}

/**
 * Restore the most recent inbound message to unread so the row re-shows the
 * unread badge. Mirrors mobile's `conversationsAPI.markUnread`.
 * PUT /conversations/:id/mark_unread
 */
export async function markConversationUnread(id: number): Promise<void> {
  await meRequest(`conversations/${id}/mark_unread`, { method: "PUT" });
}

export async function deleteConversation(id: number): Promise<void> {
  await meRequest(`conversations/${id}`, { method: "DELETE" });
}

/**
 * Archive a conversation for the current user. It moves out of the default
 * inbox (still viewable under the Archived tab); history is preserved.
 * Mirrors mobile's `conversationsAPI.archiveConversation`.
 */
export async function archiveConversation(id: number): Promise<void> {
  await meRequest(`conversations/${id}/archive`, { method: "PUT" });
}

/**
 * Open (or create) a Hatiwal Support thread: the person's own, or with
 * `shopId` that shop's (members only). Idempotent, and it brings back a thread
 * the user archived. Mirrors mobile's `conversationsAPI.openSupportConversation`.
 */
export async function openSupportConversation(shopId?: number): Promise<Conversation> {
  const query = shopId ? `?shop_id=${shopId}` : "";
  const d = await meRequest<{ conversation: Conversation }>(`support_conversation${query}`, { method: "POST" });
  return d.conversation;
}

/** Unarchive a conversation — restores it to the default inbox. */
export async function unarchiveConversation(id: number): Promise<void> {
  await meRequest(`conversations/${id}/unarchive`, { method: "PUT" });
}

export async function getBlockedUsers(): Promise<ConversationParticipant[]> {
  const d = await meRequest<{ users: ConversationParticipant[] }>("blocks");
  return d.users ?? [];
}

export async function blockUser(userId: number): Promise<void> {
  await meRequest(`users/${userId}/block`, { method: "POST" });
}

export async function unblockUser(userId: number): Promise<void> {
  await meRequest(`users/${userId}/block`, { method: "DELETE" });
}

/**
 * privacy-b (api c178ae9): block / unblock a SHOP by its id — its owner
 * underneath, without the web ever holding the owner's personal id. 204 both
 * ways; 403 for a member of the shop, 404 for a closed shop. A block made this
 * way comes back from `GET /blocks` as an `asShop` row with `id: null`.
 */
export async function blockShop(shopId: number): Promise<void> {
  await meRequest(`shops/${shopId}/block`, { method: "POST" });
}

export async function unblockShop(shopId: number): Promise<void> {
  await meRequest(`shops/${shopId}/block`, { method: "DELETE" });
}
