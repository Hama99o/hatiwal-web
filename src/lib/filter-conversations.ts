import type { Conversation } from "./types";
import { normalizeDigits } from "./normalize-digits";
import {
  conversationPreviewText,
  type FormatCurrency,
  type PreviewTranslate,
} from "./conversation-preview";

/**
 * filterConversations — the list-level search predicate for the web inbox
 * (`components/chat/conversations-view.tsx`), ported from mobile's
 * `src/screens/chat/conversations/filterConversations.ts` so a term typed on
 * either client narrows the list the same way.
 *
 * Case-insensitive, trimmed match against:
 *   - the counterpart's name: `otherParticipant?.name`, falling back to
 *     `buyer?.name` / `seller?.name` when `otherParticipant` isn't populated
 *   - the listing title: `listing?.title`
 *   - the last-message preview — via the SAME `conversationPreviewText` the row
 *     renders, so search only matches text the user can actually see
 *
 * A blank/whitespace-only term means "no filter": the list passes through
 * unchanged (identity, so an unfiltered render keeps its array reference).
 *
 * Digits: both needle and haystack go through `normalizeDigits`, because the
 * offer preview's amount is locale-formatted — "؋ ۷۵٬۰۰۰" on /ps and /fa,
 * "AFN 75,000" on /en. Without normalising, `75000` matched nothing on ps/fa
 * and `۷۵۰۰۰` matched nothing on en, for a number visible on the row.
 *
 * Client-side only: it narrows the pages already LOADED (there is no search
 * endpoint on `GET /conversations`), which is why the view pairs it with the
 * "showing loaded conversations only" notice while more pages exist.
 */

/** The display name to search against for a conversation's counterpart. */
function counterpartName(conversation: Conversation): string {
  return (
    conversation.otherParticipant?.name ??
    conversation.buyer?.name ??
    conversation.seller?.name ??
    ""
  );
}

export function filterConversations(
  conversations: Conversation[],
  term: string,
  t: PreviewTranslate,
  formatCurrency: FormatCurrency,
): Conversation[] {
  const trimmed = term.trim().toLowerCase();
  if (!trimmed) return conversations;
  const needle = normalizeDigits(trimmed);

  return conversations.filter((conversation) => {
    const name = normalizeDigits(counterpartName(conversation).toLowerCase());
    const title = normalizeDigits(
      (conversation.listing?.title ?? "").toLowerCase(),
    );
    const preview = normalizeDigits(
      conversationPreviewText(conversation, t, formatCurrency).toLowerCase(),
    );

    return (
      name.includes(needle) ||
      title.includes(needle) ||
      preview.includes(needle)
    );
  });
}
