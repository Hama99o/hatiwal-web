import { getListing, getListings } from "./listings";
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

  // The listings index (`:list` view) seller sub-object is intentionally lean —
  // it omits the response-rate trust fields because computing them per card
  // would N+1 the browse feed. They live on the listing `:detailed` view seller,
  // so fetch one listing's detail to enrich the profile's response-rate badge.
  // Guest-accessible (the listing detail page renders for guests); no mobile
  // contract change and no per-card cost.
  const enrichedSeller = seller
    ? await enrichSellerResponseRate(seller, result.items[0]?.id, opts.revalidate)
    : null;

  return {
    seller: enrichedSeller,
    listings: result.items,
    totalCount: result.pagination.totalCount,
  };
}

async function enrichSellerResponseRate(
  seller: SellerSummary,
  listingId: number | undefined,
  revalidate?: number,
): Promise<SellerSummary> {
  if (listingId == null) return seller;
  try {
    const detail = await getListing(listingId, { revalidate });
    if (detail.seller?.id === seller.id) {
      return {
        ...seller,
        responseRatePercent: detail.seller.responseRatePercent,
        responseTimeLabel: detail.seller.responseTimeLabel,
        lastActiveLabel: detail.seller.lastActiveLabel,
        // Away mode (W628) lives only on the `:detailed` seller sub-object, so
        // carry it over here to power the public-profile away banner.
        sellerIsAway: detail.seller.sellerIsAway,
        sellerAwayUntil: detail.seller.sellerAwayUntil,
      };
    }
  } catch {
    // Non-fatal: the badge simply won't render if the detail fetch fails.
  }
  return seller;
}
