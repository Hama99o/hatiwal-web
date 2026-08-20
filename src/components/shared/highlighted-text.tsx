import { splitHighlight } from "@/lib/message-search";

/**
 * Renders `text` with every occurrence of `query` wrapped in a `<mark>` — the
 * ONE highlight treatment in the app (web mirror of mobile's
 * `components/common/HighlightedText.tsx`), shared by in-thread message search
 * (`MessageBubble`) and the inbox list search (`ConversationsView`: counterpart
 * name, listing title and last-message preview).
 *
 * Returns a bare fragment of inline nodes, so the caller keeps ownership of the
 * text element and its typography/truncation (`truncate`, `line-clamp-*`,
 * colors) — highlighting must never change how a line is laid out.
 *
 * Matching is owned by the caller's predicate (`filterConversations` /
 * `filterMessages`); this can only highlight, never disagree about what
 * matched. A blank query renders the plain string.
 *
 * Known gap, deliberate and at parity with mobile (see the same note on
 * `hatiwal-mobile/src/components/common/HighlightedText.tsx`):
 * `filterConversations` runs both needle and haystack through
 * `normalizeDigits` (Latin ↔ Eastern-Arabic/Persian numerals) before matching,
 * but this component matches on the RAW string. So typing `75000` on /ps
 * correctly SELECTS the row whose preview renders "؋ ۷۵٬۰۰۰" — and that amount
 * is not highlighted, because the two strings share no literal substring.
 * Closing it means matching on the normalized text and mapping the offsets back
 * onto the original, which changes this component's matching behaviour for
 * every caller (in-thread message search included) — so it stays out of scope
 * here rather than diverging the two clients. Do not "fix" it by
 * de-normalizing the filter: that would re-break cross-numeral SEARCH, which
 * is the acceptance-tested behaviour.
 */
export function HighlightedText({
  text,
  query,
}: {
  text: string;
  query?: string | null;
}) {
  const trimmed = query?.trim();
  if (!trimmed || !text) return <>{text}</>;

  return (
    <>
      {splitHighlight(text, trimmed).map((part, i) =>
        part.isMatch ? (
          <mark key={i} className="rounded-sm bg-brand-gold/40 text-inherit">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}
