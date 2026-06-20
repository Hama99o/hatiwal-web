import { convertKeysToCamel, convertKeysToSnake } from "./case";
import { normalizeListing, type RawListing } from "./listings";
import type { Listing, User } from "../types";

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
  const json: unknown = await res.json();
  return convertKeysToCamel<T>(json);
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
}

export async function updateProfile(input: ProfileUpdate): Promise<User> {
  const data = await meRequest<{ user: User }>("users/me", {
    method: "PUT",
    json: { user: input },
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

export async function getMyListings(): Promise<Listing[]> {
  const data = await meRequest<{ listings: RawListing[] }>("my/listings");
  return (data.listings ?? []).map(normalizeListing);
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

export async function listingLifecycle(
  id: number,
  action: LifecycleAction,
): Promise<Listing> {
  const data = await meRequest<{ listing: RawListing }>(
    `my/listings/${id}/${action}`,
    { method: "PUT" },
  );
  return normalizeListing(data.listing);
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
