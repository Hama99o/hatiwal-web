import { meRequest } from "./me";
import type {
  Conversation,
  ConversationParticipant,
  Message,
  MessageKind,
  Pagination,
} from "../types";

/** One page of the conversations index — same shape as `ListingsResult`. */
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
): Promise<ConversationsResult> {
  const params = new URLSearchParams();
  if (listingId) params.set("listing_id", String(listingId));
  if (archived) params.set("archived", "true");
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
