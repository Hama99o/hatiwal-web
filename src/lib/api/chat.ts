import { meRequest } from "./me";
import type {
  Conversation,
  ConversationParticipant,
  Message,
  MessageKind,
} from "../types";

export async function getConversations(
  listingId?: number,
): Promise<Conversation[]> {
  const q = listingId ? `?listing_id=${listingId}` : "";
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

export async function markRead(conversationId: number): Promise<void> {
  await meRequest(`conversations/${conversationId}/messages/mark_read`, {
    method: "PUT",
  });
}

export async function deleteConversation(id: number): Promise<void> {
  await meRequest(`conversations/${id}`, { method: "DELETE" });
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
