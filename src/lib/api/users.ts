import { getListings } from "./listings";
import type { Listing, SellerSummary } from "../types";

/**
 * Seller profile for the PUBLIC (guest) web page.
 *
 * The Rails `/users/:id/public_profile` endpoint requires auth (401 for guests),
 * so for the crawlable seller page we derive what we can from the guest-accessible
 * listings index (`?user_id=`): the seller summary embedded on each listing, plus
 * their active listings grid.
 *
 * TODO(backend): make `public_profiles#show` guest-readable to enrich this with
 * bio, member-since, and sold count. Tracked in docs/WEB_BACKLOG.md.
 */
export interface PublicSellerProfile {
  seller: SellerSummary | null;
  listings: Listing[];
  totalCount: number;
}

export async function getPublicSeller(
  userId: number | string,
  opts: { revalidate?: number; pageSize?: number } = {},
): Promise<PublicSellerProfile> {
  const result = await getListings(
    { userId: Number(userId), status: "active", pageSize: opts.pageSize ?? 24 },
    { revalidate: opts.revalidate },
  );

  const seller =
    result.items.find((l) => l.seller?.id === Number(userId))?.seller ??
    result.items[0]?.seller ??
    null;

  return {
    seller,
    listings: result.items,
    totalCount: result.pagination.totalCount,
  };
}
