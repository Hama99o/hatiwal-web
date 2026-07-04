import { meRequest } from "./me";
import type {
  Conversation,
  ConversationParticipant,
  Message,
  MessageKind,
} from "../types";

export async function getConversations(
  listingId?: number,
  archived?: boolean,
): Promise<Conversation[]> {
  const params = new URLSearchParams();
  if (listingId) params.set("listing_id", String(listingId));
  if (archived) params.set("archived", "true");
  const q = params.toString() ? `?${params}` : "";
  const d = await meRequest<{ conversations: Conversation[] }>(
    `conversations${q}`,
  );
  return d.conversations ?? [];
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
): Promise<Message> {
  const d = await meRequest<{ message: Message }>(
    `conversations/${conversationId}/messages`,
    { method: "POST", json: { body, kind, respondsToId } },
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
