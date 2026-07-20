import { convertKeysToCamel, convertKeysToSnake } from "./case";
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
    const err = new Error(`me/${path} ${res.status}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  // Tolerate empty bodies (e.g. 204 from DELETE).
  const text = await res.text();
  return (text ? convertKeysToCamel<T>(JSON.parse(text)) : undefined) as T;
}

export async function getSavedListings(): Promise<Listing[]> {
  const data = await meRequest<{ listings: RawListing[] }>(
    "my/saved_listings",
  );
  return (data.listings ?? []).map(normalizeListing);
}

export interface ProfileUpdate {
  firstname?: string;
  lastname?: string;
  phone?: string | null;
  bio?: string | null;
  city?: string | null;
  province?: string | null;
  preferredLanguage?: "en" | "ps" | "fa";
  /**
   * Away mode (mobile W713). ISO datetime to set the away period, or explicit
   * `null` to clear it. Omit the key entirely to leave the current value
   * untouched (e.g. away toggle on but no date entered yet).
   */
  awayUntil?: string | null;
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
  opts: { buyerId?: number; finalPrice?: number } = {},
): Promise<LifecycleResult> {
  // reserve/sold optionally take a buyer (+ final price) so Rails records a
  // Transaction (the thing a review hangs off). buyer_id/final_price are flat
  // params, not nested under listing[]. Other actions send a bare PUT.
  const hasBuyer = opts.buyerId != null;
  const data = await meRequest<{
    listing: RawListing;
    transaction?: Transaction | null;
  }>(`my/listings/${id}/${action}`, {
    method: "PUT",
    ...(hasBuyer
      ? { json: { buyerId: opts.buyerId, finalPrice: opts.finalPrice } }
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
