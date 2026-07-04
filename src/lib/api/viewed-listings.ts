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
