import { ApiError } from "./client";

/**
 * THE one place a Rails failure `code` becomes a localized message.
 *
 * Rails tags the handful of 422s a user has to ACT on with a stable machine code
 * (`render_unprocessable_entity(record, code: "…")` → `body.code`) and leaves the
 * accompanying `errors` array as English ActiveModel prose. That prose is a
 * fallback for clients predating the codes and is NEVER renderable here, because
 * two of this app's three locales are Pashto and Dari. Showing it is the bug the
 * codes exist to fix: a seller who lowered a quantity below what they had
 * already sold used to get "Something went wrong" — or an English Rails
 * sentence — with nothing to act on.
 *
 * The i18n keys are MOBILE'S keys, not new ones: the same refusal must read the
 * same way on both clients, and mobile already ships all of them in en/ps/fa.
 *
 * ── Why messages resolve through a caller-supplied `t` ──────────────────────
 *
 * Two of these messages name a number ("You've already sold 8 of these…"), and
 * that number is NOT on the wire — the 422 carries the code, not the count. The
 * client already knows it, but only the surface does: the edit form knows the
 * listing's sold units, the offer dialog knows remaining stock. So the mapping
 * lives here, once, and each surface passes the value it has. A code that needs
 * a count and is handed none resolves to `null` rather than rendering a broken
 * string, and the caller falls back to its own generic message.
 */

/**
 * The codes Rails actually sends, as a closed set — so a typo'd string cannot
 * silently become an untranslated message, and adding one server-side shows up
 * here as a type error rather than as an unmapped failure in production.
 */
export const API_ERROR_CODES = {
  /** Edit lowered `quantity` under what has already SOLD. `PATCH /my/listings/:id`. */
  quantityBelowSoldUnits: "quantity_below_sold_units",
  /** Edit lowered `quantity` under what is currently HELD for a buyer. Same endpoint. */
  quantityBelowHeldUnits: "quantity_below_held_units",
  /** Void/reassign refused: the sale carries a review. `PATCH`/`DELETE /my/transactions/:id`. */
  saleHasReview: "sale_has_review",
  /** An offer asked for more units than remain. `POST /conversations/:id/messages`. */
  offerQuantityAboveAvailable: "offer_quantity_above_available_units",
} as const;

export type ApiErrorCode =
  (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

/**
 * code → { key, needsCount }. Full keys (not suffixes) so a caller hands the
 * result straight to a root `useTranslations()` without knowing which namespace
 * a given code happens to live under.
 */
const MESSAGES: Record<ApiErrorCode, { key: string; needsCount: boolean }> = {
  // Mobile: listing.json `form.quantityBelowSoldUnits` — {count} is how many are
  // already sold, which the client reads off the listing it is editing.
  [API_ERROR_CODES.quantityBelowSoldUnits]: {
    key: "listing.form.quantityBelowSoldUnits",
    needsCount: true,
  },
  // Mobile: listing.json `form.quantityBelowHeldUnits` — {count} is held units.
  [API_ERROR_CODES.quantityBelowHeldUnits]: {
    key: "listing.form.quantityBelowHeldUnits",
    needsCount: true,
  },
  [API_ERROR_CODES.saleHasReview]: {
    key: "listing.sale.voidBlockedReviewed",
    needsCount: false,
  },
  [API_ERROR_CODES.offerQuantityAboveAvailable]: {
    key: "listing.stock.offerAboveAvailable",
    needsCount: true,
  },
};

function isKnownCode(code: string | undefined): code is ApiErrorCode {
  return code !== undefined && code in MESSAGES;
}

/** The `code` Rails sent, when it sent one this app knows. */
export function apiErrorCode(error: unknown): ApiErrorCode | null {
  if (!(error instanceof ApiError)) return null;
  return isKnownCode(error.code) ? error.code : null;
}

/**
 * The localized sentence for whatever went wrong, or `null` when the failure
 * carried no code this app can explain (or needs a count the caller could not
 * supply) — in which case the caller shows its own generic message. Never
 * returns the server's English prose.
 *
 * Accepts `unknown` because every call site is a `catch` block.
 */
export function apiErrorMessage(
  error: unknown,
  t: (key: string, values?: Record<string, string | number>) => string,
  values: { count?: number } = {},
): string | null {
  const code = apiErrorCode(error);
  if (!code) return null;
  const { key, needsCount } = MESSAGES[code];
  if (needsCount) {
    if (values.count == null) return null;
    return t(key, { count: values.count });
  }
  return t(key);
}

/**
 * True when this failure is the "that sale has a review" refusal — the one
 * refusal a surface reacts to STRUCTURALLY (withdraw Delete, freeze the buyer
 * field) rather than by only showing a sentence.
 */
export function isReviewedSaleRefusal(error: unknown): boolean {
  return apiErrorCode(error) === API_ERROR_CODES.saleHasReview;
}
