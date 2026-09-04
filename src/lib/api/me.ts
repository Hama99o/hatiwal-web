import { convertKeysToCamel, convertKeysToSnake } from "./case";
import { ApiError, parseOrExplain, readApiError } from "./client";
import { normalizeListing, type RawListing } from "./listings";
import type { Listing, Transaction, User } from "../types";

/**
 * Client-side authed requests, routed through the same-origin authed proxy
 * (/api/me/*) which attaches the devise tokens from cookies and persists
 * rotation. Browser-only (relative URL).
 */
export async function meRequest<T>(
  path: string,
  opts: { method?: string; json?: unknown; form?: FormData } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const init: RequestInit = {
    method: opts.method ?? "GET",
    headers,
    cache: "no-store",
  };
  if (opts.form !== undefined) {
    init.method = opts.method ?? "POST";
    // Let the browser set the multipart Content-Type (with boundary).
    init.body = opts.form;
  } else if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    init.method = opts.method ?? "POST";
    init.body = JSON.stringify(convertKeysToSnake(opts.json));
  }

  const res = await fetch(`/api/me/${path}`, init);
  if (!res.ok) {
    // Carry Rails' own reasons, not just the status. Discarding the body left
    // every authed write able to say no more than "something went wrong": the
    // report dialog had three translated 422 messages ("you already reported
    // this", "you can't report yourself", generic) that could never be reached
    // because the only thing that survived the throw was the number 422.
    //
    // The `code` matters more than the prose and is the reason this reads the
    // whole body rather than just the array: `errors` is English ActiveModel
    // text that must never reach a ps/fa user, while `code` is a stable token
    // each surface maps to its own localized copy (see ./error-codes.ts).
    const { errors, code } = await readApiError(res);
    throw new ApiError(res.status, `me/${path} ${res.status}`, errors, code);
  }
  // Tolerate empty bodies (e.g. 204 from DELETE).
  const text = await res.text();
  // parseOrExplain, not a bare JSON.parse: this is the AUTHENTICATED path, and a
  // bare parse here throws an anonymous "Unexpected token …" that names neither
  // the endpoint nor the body. See its docstring in ./client.ts.
  return (
    text ? convertKeysToCamel<T>(parseOrExplain(text, `me/${path}`, res)) : undefined
  ) as T;
}

/**
 * EVERY saved listing, not just the first page. Rails paginates
 * `my/saved_listings` (20/page) and this list is the shared source of truth for
 * the saved heart on every card, on the listing detail page and in the sticky
 * action bar — truncated to page 1 it showed an OUTLINE heart on a listing the
 * buyer had actually saved, and the next tap POSTed `save` again. Same paging
 * shape and 50-page safety cap as `getMyListings` below.
 */
export async function getSavedListings(): Promise<Listing[]> {
  const out: Listing[] = [];
  for (let page = 1; page <= 50; page++) {
    const data = await meRequest<{
      listings: RawListing[];
      meta?: { pagination?: { nextPage?: number | null } };
    }>(`my/saved_listings?page[number]=${page}`);
    out.push(...(data.listings ?? []).map(normalizeListing));
    if (!data.meta?.pagination?.nextPage) break;
  }
  return out;
}

export interface ProfileUpdate {
  firstname?: string;
  lastname?: string;
  phone?: string | null;
  bio?: string | null;
  city?: string | null;
  province?: string | null;
  preferredLanguage?: "en" | "ps" | "fa";
  /** A SEPARATE WhatsApp number — often a different SIM from `phone`. */
  whatsappNumber?: string | null;
  /** Gates BOTH phone and whatsapp in a listing's seller hash. Server default: true. */
  showPhonePublicly?: boolean;
  /** Gates the user's OWN city/province — never a listing's location. Server default: true. */
  showAddressPublicly?: boolean;
  /**
   * Away mode (mobile W713). ISO datetime to set the away period, or explicit
   * `null` to clear it. Omit the key entirely to leave the current value
   * untouched (e.g. away toggle on but no date entered yet).
   */
  awayUntil?: string | null;
}

/**
 * Ask the API to send the confirmation email again.
 *
 * DeviseTokenAuth's POST /auth/confirmation. Routed through the authed proxy like
 * every other client call, even though the endpoint itself needs no session — it
 * keeps one path for token rotation and error shape.
 *
 * Resend is the part that makes the prompt worth having: without it a confirmation
 * mail that lands in spam leaves the account stranded with no way back.
 */
export async function resendConfirmation(email: string): Promise<void> {
  await meRequest<unknown>("auth/confirmation", {
    method: "POST",
    json: { email },
  });
}

export async function updateProfile(input: ProfileUpdate): Promise<User> {
  const data = await meRequest<{ user: User }>("users/me", {
    method: "PUT",
    json: { user: input },
  });
  return data.user;
}

/** Upload a new avatar — multipart PUT /users/me, mirroring mobile's updateAvatar. */
export async function updateAvatar(file: File): Promise<User> {
  const form = new FormData();
  form.append("user[avatar]", file);
  const data = await meRequest<{ user: User }>("users/me", {
    method: "PUT",
    form,
  });
  return data.user;
}

export interface AnalyticsEntry {
  date: string;
  count: number;
}

/** Per-day view counts for a listing (7 entries, oldest→newest) — mobile parity. */
export async function getListingAnalytics(
  id: number | string,
): Promise<AnalyticsEntry[]> {
  const d = await meRequest<{ analytics: AnalyticsEntry[] }>(
    `my/listings/${id}/analytics`,
  );
  return d.analytics ?? [];
}

/** Undo a scheduled account deletion within the grace window (mobile parity). */
export async function restoreAccount(): Promise<User> {
  const data = await meRequest<{ user: User }>("users/me/restore", {
    method: "POST",
  });
  return data.user;
}

/** Switch buyer/seller mode (persists sellerMode), mirroring mobile's mode store. */
export async function setSellerMode(value: boolean): Promise<User> {
  const data = await meRequest<{ user: User }>("users/me", {
    method: "PUT",
    json: { user: { sellerMode: value } },
  });
  return data.user;
}

/** Toggle save state. `currentlySaved` = whether it's saved now (→ unsave). */
export async function toggleSaved(
  listingId: number,
  currentlySaved: boolean,
): Promise<void> {
  await meRequest(`listings/${listingId}/${currentlySaved ? "unsave" : "save"}`, {
    method: currentlySaved ? "DELETE" : "POST",
  });
}

// ── Seller dashboard (Phase 3) ──────────────────────────────────────────────

/**
 * ALL of the seller's listings across every status. Rails paginates
 * `/my/listings` at 20/page, so page through to the end — the seller dashboard
 * derives the shop count and every status-tab count from this full set, which
 * would be wrong if truncated to the first 20. Safety-capped at 50 pages.
 */
export async function getMyListings(): Promise<Listing[]> {
  const out: Listing[] = [];
  for (let page = 1; page <= 50; page++) {
    const data = await meRequest<{
      listings: RawListing[];
      meta?: { pagination?: { nextPage?: number | null } };
    }>(`my/listings?page[number]=${page}`);
    out.push(...(data.listings ?? []).map(normalizeListing));
    if (!data.meta?.pagination?.nextPage) break;
  }
  return out;
}

export async function getMyListing(id: number | string): Promise<Listing> {
  const data = await meRequest<{ listing: RawListing }>(`my/listings/${id}`);
  return normalizeListing(data.listing);
}

export type LifecycleAction =
  | "publish"
  | "unpublish"
  | "reserve"
  | "activate"
  | "sold"
  | "renew";

export interface LifecycleResult {
  listing: Listing;
  /** Present when reserve/sold was called with a buyer — the created/advanced
   *  sale, which the caller can immediately review. */
  transaction: Transaction | null;
}

export async function listingLifecycle(
  id: number,
  action: LifecycleAction,
  opts: { buyerId?: number; finalPrice?: number; quantity?: number } = {},
): Promise<LifecycleResult> {
  // reserve/sold optionally take a buyer (+ final price) so Rails records a
  // Transaction (the thing a review hangs off). buyer_id/final_price are flat
  // params, not nested under listing[]. Other actions send a bare PUT.
  const hasBuyer = opts.buyerId != null;
  // A quantity must travel even with NO buyer: the body used to be built only when a
  // buyer was identified, so an off-platform sale sent a bare PUT and Rails read the
  // missing quantity as "sold the lot".
  const hasQuantity = opts.quantity != null;
  const data = await meRequest<{
    listing: RawListing;
    transaction?: Transaction | null;
  }>(`my/listings/${id}/${action}`, {
    method: "PUT",
    ...(hasBuyer || hasQuantity
      ? {
          json: {
            ...(hasBuyer
              ? { buyerId: opts.buyerId, finalPrice: opts.finalPrice }
              : {}),
            // How many units this sale covers, sent WITH OR WITHOUT a buyer. Rails
            // reads a missing quantity as the whole remaining stock, so a bare PUT on
            // an off-platform sale retired the listing — 50 in stock, one sale, "0 of
            // 50 left", reported from a device. The buyer being unknown says nothing
            // about how many units left the shelf
            // (docs/SPIKE_LISTING_QUANTITY.md §0b).
            ...(hasQuantity ? { quantity: opts.quantity } : {}),
          },
        }
      : {}),
  });
  return {
    listing: normalizeListing(data.listing),
    transaction: data.transaction ?? null,
  };
}

export async function deleteMyListing(id: number): Promise<void> {
  await meRequest(`my/listings/${id}`, { method: "DELETE" });
}

/**
 * ── The sales ledger, and correcting it (SF-B3/B4/B5) ──────────────────────
 *
 * ONE pair of endpoints serves BOTH the "Undo" on the mark-sold toast and the
 * editable rows on the Sales screen. There is deliberately no "correct a sale"
 * form and no separate reopen action: putting units back on the shelf is a side
 * effect of fixing the row, and Rails re-opens a listing that had gone sold-out
 * by mistake as part of the same write.
 *
 * There is no server-side undo WINDOW either — the toast's Undo and a
 * correction made a week later call the identical endpoint. The only guard is
 * that a sale carrying a review cannot be voided or reassigned
 * (`sale_has_review`); that is the rail that matters, not a clock.
 */

/** What a correction changes. Every field optional — send only what moved. */
export interface SaleCorrection {
  /**
   * The new unit count. `0` is how a client says "this sale did not happen" —
   * the server treats a non-positive quantity as a void, same as DELETE.
   */
  quantity?: number;
  /** Reassign the sale to a different buyer from this listing's threads. */
  buyerId?: number;
  /** Reassign to "someone not on Hatiwal" (stored as a null buyer). */
  clearBuyer?: boolean;
  /** Per-unit price, not the deal total. */
  finalPrice?: number;
}

/**
 * Both correction calls answer with the listing re-rendered `:owner_detailed`,
 * so a caller repaints stock, status and the `sale` block from the response
 * instead of refetching. `transaction` is absent when the sale was voided —
 * there is nothing left to render.
 */
export interface SaleCorrectionResult {
  listing: Listing;
  transaction: Transaction | null;
}

/** PATCH /my/transactions/:id — fix a recorded sale's quantity, buyer or price. */
export async function correctMySale(
  transactionId: number,
  correction: SaleCorrection,
): Promise<SaleCorrectionResult> {
  const data = await meRequest<{
    listing: RawListing;
    transaction?: Transaction | null;
  }>(`my/transactions/${transactionId}`, {
    method: "PATCH",
    // Flat params (not nested under a resource key): a correction is a command
    // about a sale, and it reuses the exact four names the reserve/sold
    // lifecycle commands already established rather than inventing a second
    // vocabulary for the same four facts.
    json: correction,
  });
  return {
    listing: normalizeListing(data.listing),
    transaction: data.transaction ?? null,
  };
}

/**
 * DELETE /my/transactions/:id — the toast's "Undo" and the ledger row's Delete.
 * Restores the units to stock, gives back the trust counters, and re-opens the
 * listing if this sale was what retired it.
 */
export async function voidMySale(
  transactionId: number,
): Promise<SaleCorrectionResult> {
  const data = await meRequest<{ listing: RawListing }>(
    `my/transactions/${transactionId}`,
    { method: "DELETE" },
  );
  return { listing: normalizeListing(data.listing), transaction: null };
}

/**
 * GET /my/transactions?listing_id=…&as=seller&status=sold — one listing's sales,
 * newest first. Many buyers per batch, each its own row, outside-buyer sales
 * (`buyer: null`) included.
 *
 * Pages through to the end with the same 50-page safety cap as every other
 * paginated `my/*` reader here: a ledger is read whole (the header tallies it),
 * and a truncated one would under-report a seller's own sales.
 */
export async function getListingSales(
  listingId: number | string,
): Promise<Transaction[]> {
  const out: Transaction[] = [];
  for (let page = 1; page <= 50; page++) {
    const data = await meRequest<{
      transactions?: Transaction[];
      meta?: { pagination?: { nextPage?: number | null } };
    }>(
      `my/transactions?listing_id=${listingId}&as=seller&status=sold&page[number]=${page}`,
    );
    out.push(...(data.transactions ?? []));
    if (!data.meta?.pagination?.nextPage) break;
  }
  return out;
}

export interface ListingInput {
  title: string;
  description?: string;
  price: number;
  currency: string;
  condition?: string;
  categoryId: number;
  location?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  /** Whether the price is open to offers. Defaults to true on the backend. */
  negotiable?: boolean;
  /**
   * How many identical units the seller has (docs/SPIKE_LISTING_QUANTITY.md).
   * Omit for a single item — the backend column defaults to 1, so a listing
   * created without it behaves exactly as it did before the feature existed.
   */
  quantity?: number;
}

/** Build the multipart body Rails expects (listing[...] fields + images[]). */
function buildListingForm(
  input: ListingInput,
  files: File[],
  removedImageIds: string[] = [],
): FormData {
  const f = new FormData();
  f.append("listing[title]", input.title);
  if (input.description) f.append("listing[description]", input.description);
  f.append("listing[price]", String(input.price));
  f.append("listing[currency]", input.currency);
  if (input.condition) f.append("listing[condition]", input.condition);
  if (input.negotiable != null)
    f.append("listing[negotiable]", String(input.negotiable));
  if (input.quantity != null)
    f.append("listing[quantity]", String(input.quantity));
  f.append("listing[category_id]", String(input.categoryId));
  if (input.location) f.append("listing[location]", input.location);
  if (input.address) f.append("listing[address]", input.address);
  if (input.latitude != null) f.append("listing[latitude]", String(input.latitude));
  if (input.longitude != null)
    f.append("listing[longitude]", String(input.longitude));
  for (const file of files) f.append("listing[images][]", file);
  for (const id of removedImageIds)
    f.append("listing[removed_image_ids][]", id);
  return f;
}

export async function createListing(
  input: ListingInput,
  files: File[],
): Promise<Listing> {
  const data = await meRequest<{ listing: RawListing }>("my/listings", {
    method: "POST",
    form: buildListingForm(input, files),
  });
  return normalizeListing(data.listing);
}

export async function updateListing(
  id: number,
  input: ListingInput,
  files: File[],
  removedImageIds: string[] = [],
): Promise<Listing> {
  const data = await meRequest<{ listing: RawListing }>(`my/listings/${id}`, {
    method: "PUT",
    form: buildListingForm(input, files, removedImageIds),
  });
  return normalizeListing(data.listing);
}
