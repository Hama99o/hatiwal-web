import type { Listing } from "@/lib/types";

/**
 * Multi-quantity stock rules — docs/SPIKE_LISTING_QUANTITY.md, Tier 1.
 *
 * A direct port of hatiwal-mobile's `src/utils/stock.ts`, thresholds included.
 * The two clients read the SAME listing from the SAME API, so if web called
 * 3-of-15 "low" and mobile didn't, the same seller would see two different
 * answers about their own stock on the same day. Change one file, change both.
 */

type StockFields = Pick<Listing, "quantity" | "availableUnits" | "multiUnit">;

/**
 * Units currently HELD for one buyer — the public, identity-free count behind
 * the "13 available · 2 held" clause on the stock pill.
 *
 * Advisory, NOT reserved inventory: held units are deliberately not subtracted
 * from `availableUnits`, so another buyer can still ask about them. A real
 * per-unit hold would need expiry and leak machinery that a marketplace with no
 * payment step cannot enforce anyway.
 */
export function heldUnitsOf(
  listing: Pick<Listing, "heldUnits"> | null | undefined,
): number {
  return Math.max(0, listing?.heldUnits ?? 0);
}

/**
 * Whether this listing has an open hold for a buyer — the ONE check that is
 * correct for both item counts, and the gate for every release-hold affordance.
 *
 * Read the sale, NEVER `status === "reserved"`. A multi-unit batch holding units
 * for a buyer deliberately stays `status: "active"`, so the status test misses
 * it entirely; that single wrong assumption caused three separate bugs on mobile
 * (a hidden 403, a phantom hold that survived its own sale, and a hold with no
 * date). `sale.status === "reserved"` is true for a single-item hold (whose
 * listing status DOES flip) and for a multi-unit hold (whose status does not).
 *
 * Owner-only: `sale` is absent from the public feed/detail payloads by design,
 * so this answers `false` for a buyer — which is correct, since releasing a hold
 * is a seller action. Buyers learn a hold exists from `heldUnitsOf` and the
 * "Reserved" ribbon instead.
 */
export function hasOpenHold(
  listing: Pick<Listing, "sale"> | null | undefined,
): boolean {
  return listing?.sale?.status === "reserved";
}

/**
 * The buyer a hold is for, or null. Owner-only, and null for a hold placed
 * through a path that recorded no buyer.
 */
export function heldForBuyer(listing: Pick<Listing, "sale"> | null | undefined) {
  return hasOpenHold(listing) ? (listing?.sale?.buyer ?? null) : null;
}

/**
 * Whether this listing is LIVE — on the market, browsable, and message-able.
 *
 * The whole presentation model turns on this one predicate. The database keeps
 * four statuses; a seller is shown THREE states (Draft / Live / Sold), and both
 * `active` and `reserved` fold into Live. A held listing is Live plus a badge —
 * never a fourth tab, never a dead end. Only `sold` is terminal.
 *
 * Mirrors the server's own `Listing#live?` / `scope :live` exactly, so what the
 * feed returns and what a client treats as contactable cannot drift apart.
 */
export function isLive(
  // A loose `status` on purpose: this is asked of a full `Listing`, of the
  // trimmed listing hash pinned to a conversation (typed `string` there, since
  // ConversationSerializer hand-rolls it), and of a raw payload. One predicate
  // for all three is the point — a second, narrower copy is how the feed and the
  // chat header would come to disagree about the same listing.
  listing: { status?: string | null } | null | undefined,
): boolean {
  return listing?.status === "active" || listing?.status === "reserved";
}

/**
 * What is LEFT — never the original count. Showing 15 when 13 are gone is the
 * stale-number failure that damages trust more than showing nothing at all:
 * there is no payment step or delivery to reverse a wasted trip across Kabul.
 *
 * Falls back to `quantity` for a payload that predates `available_units`, and to
 * 1 for one that predates the columns entirely — an older listing is a
 * single-item listing.
 */
export function availableUnitsOf(
  listing: StockFields | null | undefined,
): number {
  if (!listing) return 0;
  return Math.max(0, listing.availableUnits ?? listing.quantity ?? 1);
}

/** The seller's original count, for the "3 of 15 left" phrasing. */
export function totalUnitsOf(listing: StockFields | null | undefined): number {
  if (!listing) return 0;
  return Math.max(0, listing.quantity ?? 1);
}

/**
 * Whether ANY stock UI belongs on screen.
 *
 * The spike's governing rule: a single-item listing must look exactly as it did
 * before this feature existed. Deliberately strict — the server's own
 * `multi_unit` decides, never a client-side `quantity > 1` guess.
 */
export function hasStockToShow(
  listing: StockFields | null | undefined,
): boolean {
  return listing?.multiUnit === true;
}

/**
 * Whether any units have actually sold yet.
 *
 * Drives the seller's phrasing: "15 of 15 left" is literally true on a listing
 * nobody has bought from, but the second number just repeats the first and there
 * is no progress to show. Found on-device during mobile QA (UI-009) and mirrored
 * here — this module and mobile's `src/utils/stock.ts` are a deliberate 1:1
 * pair, so a rule added to one belongs in both.
 */
export function hasSoldSome(
  listing: StockFields | null | undefined,
): boolean {
  if (!listing) return false;
  return availableUnitsOf(listing) < totalUnitsOf(listing);
}

/**
 * How many units have already left the shelf.
 *
 * Derived, because the API sends the two ends rather than the middle. It is the
 * number a seller has to be told when they try to set the quantity BELOW what
 * they have sold — the refusal is meaningless without it ("you have already sold
 * 8 of these").
 */
export function soldUnitsOf(
  listing: StockFields | null | undefined,
): number {
  return Math.max(0, totalUnitsOf(listing) - availableUnitsOf(listing));
}

/**
 * Running out — the amber treatment.
 *
 * Two rules OR'd: "2 left" is urgent whether the batch was 3 or 300, and a fifth
 * of the batch is urgent whatever the absolute number. Sold out is NOT low
 * stock — by then the listing is `sold` and its status banner says so far more
 * clearly than an amber count would.
 */
export function isLowStock(
  availableUnits: number,
  totalUnits: number,
): boolean {
  if (totalUnits <= 1) return false;
  if (availableUnits <= 0) return false;
  return availableUnits <= 2 || availableUnits / totalUnits <= 0.2;
}
