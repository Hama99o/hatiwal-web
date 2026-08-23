import { apiGet, buildQuery, type QueryParams } from "./client";
import { meRequest } from "./me";
import type {
  Listing,
  ListingsResult,
  ListingSort,
  Pagination,
} from "../types";

/** Filters accepted by the listings index — mirrors the mobile getListings query. */
export interface ListingsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: number;
  condition?: string;
  userId?: number;
  priceMin?: number;
  priceMax?: number;
  sort?: ListingSort;
  latitude?: number;
  longitude?: number;
  radius?: number;
  location?: string;
  /** Trust filter — only listings whose seller signed in within the last N days. */
  sellerActiveDays?: number;
}

/** Raw listing as it arrives (after snake→camel) — price/lat/lng are strings. */
export interface RawListing
  extends Omit<Listing, "price" | "latitude" | "longitude" | "images"> {
  price: string | number;
  latitude: string | number | null;
  longitude: string | number | null;
  images?: string[];
  imageUrls?: string[];
}

function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

/** Normalize Rails string numerics and unify the image arrays. */
export function normalizeListing(raw: RawListing): Listing {
  const images =
    raw.images && raw.images.length
      ? raw.images
      : raw.imageUrls && raw.imageUrls.length
        ? raw.imageUrls
        : raw.thumbnailUrl
          ? [raw.thumbnailUrl]
          : [];

  return {
    ...raw,
    price: num(raw.price) ?? 0,
    latitude: num(raw.latitude),
    longitude: num(raw.longitude),
    images,
  };
}

function toParams(q: ListingsQuery): QueryParams {
  return {
    "page[number]": q.page,
    "page[size]": q.pageSize,
    search: q.search,
    category_id: q.categoryId,
    condition: q.condition,
    user_id: q.userId,
    // No `status`: GET /listings is the browsable feed
    // (active.not_expired.not_removed) and the server drops this param. Sending
    // it made the query look like it chose a status — the comment on
    // getSimilarListings below even reasons about `status` leaking non-browsable
    // stock, which it cannot do. Sold stock: GET /users/:id/sold_listings.
    price_min: q.priceMin,
    price_max: q.priceMax,
    sort: q.sort,
    latitude: q.latitude,
    longitude: q.longitude,
    radius: q.radius,
    location: q.location,
    seller_active_days: q.sellerActiveDays,
  };
}

interface ListingsEnvelope {
  listings: RawListing[];
  meta: { pagination: Pagination };
}

export async function getListings(
  query: ListingsQuery = {},
  opts: { revalidate?: number } = {},
): Promise<ListingsResult> {
  const data = await apiGet<ListingsEnvelope>("listings", {
    params: toParams(query),
    revalidate: opts.revalidate,
  });
  return {
    items: data.listings.map(normalizeListing),
    pagination: data.meta.pagination,
  };
}

/**
 * The SAME feed, fetched AS THE SIGNED-IN VIEWER (browser only).
 *
 * `GET /listings` is personalised by Rails whenever a bearer is present
 * (listings_controller#index), in exactly THREE ways:
 *   1. `not_hidden_for(current_user)` drops the buyer's "Not interested" listings;
 *   2. `viewed_ids:` fills `is_viewed` — the card's "Seen" pill + dim;
 *   3. `saved_ids:` fills `is_saved` — the card's heart (TASK-BE-SAVEDLIST; both
 *      Sets are pre-computed for the page, never a per-row `exists?`).
 * None of them can arrive through `apiGet`: no transport it picks attaches devise
 * tokens (see client.ts), so every anonymous fetch of this endpoint claims the
 * viewer has hidden nothing, seen nothing and saved nothing.
 *
 * That last one is why an anonymous `is_saved: false` must never be believed:
 * the field is on the wire for guests too, reporting `false` for a listing the
 * viewer saved months ago. Only `true` is trustworthy — see `trusted` in
 * components/shared/save-button.tsx, which still reconciles every heart against
 * the shared `['saved-listings']` query and takes the payload only as a shortcut.
 *
 * So route it through the authed proxy instead, which attaches the tokens from
 * the httpOnly cookies and persists rotation. Same `toParams` mapping, same
 * `ListingsResult` shape, same `normalizeListing` — no caller learns a second
 * envelope, and the choice of transport stays here in the fetch layer rather
 * than being made again on every surface that renders a feed.
 *
 * NOT usable from a Server Component: devise rotates the access token on every
 * request and an RSC cannot write the rotated cookie back, so an authed fetch
 * there manufactures a 401 and signs a valid session out. SSR seeds stay
 * anonymous by design; the client reconciles.
 *
 * FALLBACK: anything that makes the AUTHED transport fail while the anonymous
 * one would have worked falls back to `getListings()`, because a personalisation
 * gap is a far better outcome than an empty or errored Bazaar. That is
 * 401/403 (session expired mid-browse, cookies cleared, proxy allow-list miss)
 * AND 5xx AND a bare network throw: `/api/me` answers 502 `upstream_failed`
 * whenever its Rails fetch throws (see that route handler), so without the
 * wider guard a single upstream blip gave a SIGNED-IN buyer an error panel on a
 * feed a guest on the same blip still saw in full. A 4xx that is not an auth
 * failure (a malformed filter, say) is a real bug in our own request and still
 * surfaces — retrying it anonymously would only hide it.
 */
export async function getListingsAsViewer(
  query: ListingsQuery = {},
): Promise<ListingsResult> {
  try {
    const data = await meRequest<ListingsEnvelope>(
      `listings${buildQuery(toParams(query))}`,
    );
    return {
      items: data.listings.map(normalizeListing),
      pagination: data.meta.pagination,
    };
  } catch (err) {
    const status = (err as { status?: number } | null)?.status;
    // `undefined` = the fetch itself rejected (offline, DNS, aborted) — no
    // response, so nothing to distinguish it from a dead proxy.
    const authFailure = status === 401 || status === 403;
    const transportFailure = status === undefined || status >= 500;
    if (authFailure || transportFailure) return getListings(query);
    throw err;
  }
}

/**
 * Sold listings for a seller's public profile (F742).
 *
 * Reuses the same guest-accessible endpoint mobile uses
 * (`GET /users/:id/sold_listings`, `:list` view) — no contract change.
 */
export async function getSoldListings(
  userId: number | string,
  page?: number,
  opts: { revalidate?: number } = {},
): Promise<ListingsResult> {
  const data = await apiGet<ListingsEnvelope>(
    `users/${userId}/sold_listings`,
    { params: { "page[number]": page }, revalidate: opts.revalidate },
  );
  return {
    items: data.listings.map(normalizeListing),
    pagination: data.meta.pagination,
  };
}

/**
 * The "Similar Listings" rail on listing detail.
 *
 * Uses the dedicated `GET /listings/:id/similar` endpoint — the ONE definition
 * of "similar" both clients share (`Listing.similar_to`: browsable only, same
 * category incl. its children, source listing excluded, newest first, max 8).
 * Do not re-approximate it here with a `category_id` query: it would need the
 * source listing filtered out client-side and would drift from what mobile shows
 * for the same listing. (It could not "leak non-browsable stock" as this comment
 * used to claim — GET /listings is browsable-only server-side.)
 *
 * Returns a bare array — this endpoint is a fixed-size rail, so it has no
 * pagination envelope.
 */
export async function getSimilarListings(
  id: number | string,
  opts: { revalidate?: number } = {},
): Promise<Listing[]> {
  const data = await apiGet<{ listings: RawListing[] }>(
    `listings/${id}/similar`,
    { revalidate: opts.revalidate },
  );
  return (data.listings ?? []).map(normalizeListing);
}

export async function getListing(
  id: number | string,
  opts: { revalidate?: number } = {},
): Promise<Listing> {
  const data = await apiGet<{ listing: RawListing }>(`listings/${id}`, {
    revalidate: opts.revalidate,
  });
  return normalizeListing(data.listing);
}

/** Safe empty result for ISR fallbacks (see lib/api/safe). */
export const EMPTY_LISTINGS: ListingsResult = {
  items: [],
  pagination: {
    currentPage: 1,
    nextPage: null,
    prevPage: null,
    totalCount: 0,
    totalPages: 0,
  },
};
