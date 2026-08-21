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
