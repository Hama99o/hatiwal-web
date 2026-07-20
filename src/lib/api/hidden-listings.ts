import { meRequest } from "./me";
import { normalizeListing, type RawListing } from "./listings";
import type { Listing, Pagination } from "../types";

/**
 * Hidden ("not interested") listings — the buyer-side hide feature (mobile
 * parity). Hidden listings drop out of the caller's Browse feed and live here
 * so they can be restored. All three calls are authed → routed through the
 * same-origin /api/me proxy.
 *   POST   /listings/:id/hide     — hide from my feed
 *   DELETE /listings/:id/unhide   — restore
 *   GET    /my/hidden_listings    — paginated list of what I've hidden
 */
export interface HiddenListingsResult {
  listings: Listing[];
  pagination: Pagination;
}

interface HiddenEnvelope {
  listings: RawListing[];
  meta: { pagination: Pagination };
}

export async function getHiddenListings(
  page = 1,
): Promise<HiddenListingsResult> {
  const data = await meRequest<HiddenEnvelope>(
    `my/hidden_listings?page[number]=${page}`,
  );
  return {
    listings: (data.listings ?? []).map(normalizeListing),
    pagination: data.meta.pagination,
  };
}

export async function hideListing(id: number | string): Promise<void> {
  await meRequest(`listings/${id}/hide`, { method: "POST" });
}

export async function unhideListing(id: number | string): Promise<void> {
  await meRequest(`listings/${id}/unhide`, { method: "DELETE" });
}
