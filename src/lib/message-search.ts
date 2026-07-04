import type { Message } from "@/lib/types";

/**
 * Client-side, in-thread message search helpers (WEB-N803).
 *
 * Mirrors the mobile implementation (see
 * `hatiwal-mobile/src/screens/chat/__tests__/conversationSearch.test.ts`) so a
 * thread searched on either client behaves identically. Searches only the
 * messages already loaded in memory — there is no search endpoint.
 */

/**
 * True when `m` is a plain text message (not deleted, non-empty body) whose
 * body contains `query` (case-insensitive). Structured kinds (offer, meetup,
 * system, attachments) are excluded from search results.
 */
export function messageMatchesQuery(m: Message, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (m.deleted) return false;
  if (m.kind !== "text") return false;
  const body = m.body?.trim();
  if (!body) return false;
  return body.toLowerCase().includes(q);
}

/**
 * Returns only the loaded messages that match `query`. An empty/whitespace
 * query returns the list unchanged.
 */
export function filterMessages(messages: Message[], query: string): Message[] {
  if (!query.trim()) return messages;
  return messages.filter((m) => messageMatchesQuery(m, query));
}

/**
 * Count of searchable (text, non-deleted, non-empty) messages — the "Y" in the
 * "X of Y" match count.
 */
export function searchableCount(messages: Message[]): number {
  return messages.filter(
    (m) => !m.deleted && m.kind === "text" && Boolean(m.body?.trim()),
  ).length;
}

/**
 * Splits `text` into alternating non-match / match segments so matches can be
 * highlighted. The original casing is preserved in match segments; the query is
 * trimmed and regex-escaped so special characters never throw.
 */
export function splitHighlight(
  text: string,
  query: string,
): Array<{ text: string; isMatch: boolean }> {
  const trimmed = query.trim();
  if (!trimmed || !text) {
    return text ? [{ text, isMatch: false }] : [];
  }
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  return text
    .split(regex)
    .filter((p) => p.length > 0)
    .map((part) => ({
      text: part,
      isMatch: part.toLowerCase() === trimmed.toLowerCase(),
    }));
}
