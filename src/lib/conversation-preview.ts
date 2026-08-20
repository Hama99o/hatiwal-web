import type { Conversation } from "./types";

/**
 * conversationPreviewText — the single source of truth for "what does this
 * conversation's last message look like" (web mirror of mobile's
 * `src/screens/chat/conversations/conversationPreviewText.ts`).
 *
 * Shared by:
 *   - the inbox row (`components/chat/conversations-view.tsx`), which renders it
 *   - `filterConversations`, the list-search predicate, which matches on it
 *
 * Both call sites MUST derive the preview from this one function: search may
 * only ever match text the user can actually see. Matching the raw
 * `lastMessageBody` instead would search `"75000|AFN|90000"` for an offer and
 * empty metadata for a meetup, while the row displays "Offer: ؋ ۷۵٬۰۰۰" /
 * "Meetup proposal" — so typing what you see would return nothing.
 *
 * A plain function, not a hook, so the amount formatter is INJECTED
 * (`formatCurrency`) — the caller passes `formatPrice(…, locale)` bound to the
 * active locale. That keeps this module pure (unit-testable, no React) and
 * makes the offer amount locale-formatted, exactly like every other price in
 * the app.
 *
 * One case mobile handles and this cannot: a RETRACTED last message
 * ("Message deleted"). Mobile reads `lastMessageDeleted`, which the web
 * `Conversation` contract has no field for — that is the already-tracked
 * "Retracted last-message preview in inbox" parity gap in
 * `docs/MOBILE_WEB_PARITY.md`, not an omission here. When the field lands, add
 * the branch FIRST (mobile checks it before everything else) so the row and the
 * search predicate move together.
 */

/**
 * The subset of next-intl's translator (`useTranslations()`) this module needs.
 * Declared structurally so the module can be exercised without a next-intl
 * runtime.
 */
export type PreviewTranslate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

/** Matches `(amount, currency) => formatPrice(amount, currency, locale)`. */
export type FormatCurrency = (
  amount: number | null | undefined,
  currency?: string | null,
) => string;

export function conversationPreviewText(
  conversation: Conversation,
  t: PreviewTranslate,
  formatCurrency: FormatCurrency,
): string {
  switch (conversation.lastMessageKind) {
    case "meetup_proposal":
      return t("chat.preview.meetup");
    case "offer":
    case "offer_counter": {
      // Body is "amount|currency|listedPrice" — the same pipe encoding both
      // clients send. The amount goes through `formatCurrency` so the row (and
      // therefore search) shows a grouped, locale-digit price instead of a raw
      // number with Latin digits sitting in a Pashto/Dari list.
      const [amountRaw, currency] = (conversation.lastMessageBody || "").split("|");
      const amount = Number(amountRaw);
      const price = formatCurrency(
        Number.isFinite(amount) ? amount : null,
        currency || undefined,
      );
      const key =
        conversation.lastMessageKind === "offer_counter"
          ? "chat.preview.counterOffer"
          : "chat.preview.offer";
      return t(key, { price });
    }
    case "meetup_accepted":
      return t("chat.preview.meetupAccepted");
    case "meetup_declined":
      return t("chat.preview.meetupDeclined");
    case "offer_accepted":
      return t("chat.preview.offerAccepted");
    case "offer_declined":
      return t("chat.preview.offerDeclined");
    case "document":
      return t("chat.preview.file");
    case "image_message":
      return t("chat.preview.photo");
    default:
      return conversation.lastMessageBody || t("chat.noMessages");
  }
}
