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
