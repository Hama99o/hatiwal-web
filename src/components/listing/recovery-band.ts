/**
 * Price-band maths for the sold/reserved recovery CTA (<UnavailableActions>).
 *
 * Deliberately a PURE module — no React, no next-intl, no imports at all — so
 * the rules below can be exercised directly from `e2e/recovery-band.spec.ts`
 * without booting a browser or a server. Every edge case that used to live only
 * in a comment is a test there.
 */

/** The band is ±30% of the dead listing's price. */
export const BAND_SPREAD = 0.3;

/**
 * The ONE currency whose numbers may be handed to the Bazaar's price filter.
 *
 * Rails filters on the raw `price` column — `price_at_least` / `price_at_most`
 * in `listings_controller#index` — with no currency scoping whatsoever, and the
 * feed is overwhelmingly AFN. A band derived from a USD or EUR price would
 * therefore filter AFN stock by dollar numbers: "see similar" on a $900 laptop
 * would ask for AFN 630–1,170 and land the buyer on a page of junk (or on
 * nothing at all). There is no `currency` param to scope the query with, and
 * inventing one is a shared-contract change this card explicitly rules out — so
 * a non-AFN listing simply gets a category-only CTA, which is always truthful.
 */
export const BANDABLE_CURRENCY = "AFN";

/** Empty band = emit no `min`/`max` params at all. */
const NO_BAND = { min: "", max: "" } as const;

export interface PriceBand {
  /** URL-ready `min` param, or "" to omit it. */
  min: string;
  /** URL-ready `max` param, or "" to omit it. */
  max: string;
}

/**
 * ±30% price band around a listing price, as URL-ready strings.
 *
 * Returns an empty band (→ no `min`/`max` params) when:
 *  - the price is missing, zero, negative or non-finite — a free/priceless item
 *    must not send a bogus band; or
 *  - the currency isn't AFN (see {@link BANDABLE_CURRENCY}) — the Bazaar's price
 *    filter is currency-blind, so the numbers would mean nothing.
 *
 * `min` is floored at 0 and, for any positive price, is always ≤ `max`.
 */
export function priceBand(
  price: number | null | undefined,
  currency: string | null | undefined,
): PriceBand {
  if (String(currency ?? "").toUpperCase() !== BANDABLE_CURRENCY) {
    return { ...NO_BAND };
  }
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) return { ...NO_BAND };
  const min = Math.max(0, Math.round(p * (1 - BAND_SPREAD)));
  const max = Math.round(p * (1 + BAND_SPREAD));
  // Belt-and-braces: never emit an inverted range (unreachable for p > 0, but a
  // silently empty result set is worse than simply dropping the band).
  if (min > max) return { ...NO_BAND };
  return { min: String(min), max: String(max) };
}

/**
 * The band to actually put on the CTA: {@link priceBand}, but only when it can
 * be SHOWN to contain live stock.
 *
 * `similarPrices` are the prices of the active listings the CTA's category
 * already has (the same `GET /listings/:id/similar` set the rail below renders —
 * Rails `Listing.similar_to`, i.e. browsable stock in this category and its
 * children). If none of them fall inside the band, the band would send the buyer
 * to an EMPTY Bazaar — the exact dead end this whole card exists to remove — so
 * it is dropped and the CTA falls back to the category alone, which those very
 * listings prove is non-empty.
 */
export function recoveryBand(
  price: number | null | undefined,
  currency: string | null | undefined,
  similarPrices: ReadonlyArray<number | null | undefined>,
): PriceBand {
  const band = priceBand(price, currency);
  if (!band.min || !band.max) return { ...NO_BAND };

  const min = Number(band.min);
  const max = Number(band.max);
  const inBand = similarPrices.some((p) => {
    const n = Number(p);
    return Number.isFinite(n) && n >= min && n <= max;
  });
  return inBand ? band : { ...NO_BAND };
}
