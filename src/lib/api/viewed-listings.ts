import { meRequest } from "./me";
import { normalizeListing, type RawListing } from "./listings";
import type { Listing, Pagination } from "../types";

export interface ViewedListingsResult {
  listings: Listing[];
  pagination: Pagination;
}

/**
 * Recently viewed listings (mobile ref: RecentlyViewed.tsx / V836).
 *
 * GET /my/viewed_listings?page[number]=N — authed, so it goes through the
 * same-origin /api/me proxy (attaches devise tokens). Results are paginated
 * and ordered by last_viewed_at desc (most recently opened first); the backend
 * filters out any listing that is no longer browsable. Mirrors the saved
 * listings client (getSavedListings) but keeps pagination for infinite scroll.
 */
interface ViewedListingsEnvelope {
  listings: RawListing[];
  meta: { pagination: Pagination };
}

export async function getViewedListings(
  page = 1,
): Promise<ViewedListingsResult> {
  const data = await meRequest<ViewedListingsEnvelope>(
    `my/viewed_listings?page[number]=${page}`,
  );
  return {
    listings: (data.listings ?? []).map(normalizeListing),
    pagination: data.meta.pagination,
  };
}

/**
 * Record that the current (authed) user opened a listing, so it shows up in
 * Recently Viewed. The public detail page is server-rendered as a GUEST, so
 * Rails never attributes the view — this fires an AUTHED `GET listings/:id`
 * (through the /api/me proxy) which triggers `register_view!(current_user)`.
 * The backend dedupes and skips the owner, so it's safe to fire on every open.
 * Fire-and-forget: a failure must never disrupt viewing the listing.
 */
export async function recordListingView(id: number | string): Promise<void> {
  try {
    await meRequest(`listings/${id}`);
  } catch {
    /* non-fatal — recording a view is best-effort */
  }
}
