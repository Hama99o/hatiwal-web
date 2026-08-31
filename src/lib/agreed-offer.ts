import type { Message } from "./types";

/**
 * The terms a thread has already AGREED — read off the offer that an
 * `offer_accepted` answered.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * A seller and buyer settle "3 at 12,000 each" in chat, the seller taps Accept,
 * and then marks the listing sold — where the quantity field defaults to 1 and
 * the price field is blank. So the agreed terms had to be re-entered from
 * memory, and the common failure was silent: accepting an offer for 3 units and
 * recording a sale of 1 left a batch on the market with two units already
 * promised, and nothing anywhere said so.
 *
 * The facts are on the wire, so nobody should be remembering them.
 *
 * ── The walk (the API's own contract) ───────────────────────────────────────
 *
 * An acceptance is its own message (`kind: "offer_accepted"`) whose
 * `respondsToId` points at the offer it answers. The terms live on THAT offer —
 * its `offerAmount` and its `offerQuantity` — never on the acceptance, which
 * carries only a label. So: newest acceptance → follow the pointer → read the
 * offer.
 *
 * Pure and dependency-free on purpose: unit-specced directly
 * (`e2e/agreed-offer.spec.ts`), and used by the chat thread for both mark-sold
 * and place-a-hold so the two can never prefill differently.
 */

export interface AgreedTerms {
  /** Per-unit price agreed, or null when the offer carried no readable amount. */
  amount: number | null;
  /**
   * Units agreed, or null for UNSPECIFIED — which is the answer for every
   * single-item listing and every offer made before offers carried a quantity.
   *
   * Null is not 1. A caller should fall back to its own default (which is 1)
   * rather than render "1 ×" as though the buyer had asked for one unit
   * explicitly.
   */
  quantity: number | null;
}

/** Kinds that can carry terms — the same pair the server accepts a quantity on. */
const OFFER_KINDS: ReadonlyArray<Message["kind"]> = ["offer", "offer_counter"];

/**
 * Parse an amount off an offer message, preferring the server's pre-parsed
 * field and falling back to the pipe-encoded body ("amount|currency|listed")
 * that predates it — the same precedence the offer bubble uses, so the number
 * the seller sees and the number that prefills the sale are always the same one.
 */
function amountOf(offer: Message): number | null {
  if (offer.offerAmount != null && Number.isFinite(offer.offerAmount)) {
    return offer.offerAmount;
  }
  const parsed = Number(offer.body.split("|")[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * The most recently accepted offer's terms, or null when this thread has none.
 *
 * Returns null (rather than a zeroed object) for every thread with no
 * acceptance, an acceptance pointing at a message that is not an offer, or an
 * acceptance whose target is missing from the loaded page — a caller must be
 * able to tell "nothing was agreed" from "nothing was agreed about the price".
 */
export function agreedOfferTerms(
  messages: ReadonlyArray<Message>,
): AgreedTerms | null {
  // Newest acceptance wins: a thread can renegotiate, and the last accepted
  // offer is the deal. Scanned from the end rather than sorted — the thread is
  // already in chronological order and re-sorting would invent an ordering the
  // list does not have.
  for (let i = messages.length - 1; i >= 0; i--) {
    const accepted = messages[i];
    if (accepted.kind !== "offer_accepted" || accepted.deleted) continue;
    if (accepted.respondsToId == null) continue;

    const offer = messages.find((m) => m.id === accepted.respondsToId);
    // A retracted offer's terms are gone from the payload (the server blanks a
    // tombstone), so there is nothing to prefill from — and quietly using a
    // deleted offer's numbers would be worse than asking.
    if (!offer || offer.deleted || !OFFER_KINDS.includes(offer.kind)) continue;

    const quantity =
      offer.offerQuantity != null && offer.offerQuantity > 0
        ? offer.offerQuantity
        : null;
    return { amount: amountOf(offer), quantity };
  }
  return null;
}
