import { apiGet } from "./client";
import { getListing, getListings } from "./listings";
import type { Listing, SellerSummary } from "../types";

/**
 * Seller profile for the PUBLIC (guest) web page.
 *
 * We derive the seller summary + active-listings grid from the guest-accessible
 * listings index (`?user_id=`), then enrich it: response-rate trust fields from
 * one listing's `:detailed` view, and the rating summary (`avgRating`/
 * `reviewCount`, REV3) from the now guest-readable `/users/:id/public_profile`.
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
  //
  // When the user has NO active listings (a buyer, or a seller who's sold out),
  // the index is empty and there's no seller sub-object to derive from — but the
  // profile is still linked from every chat thread. Build it from the
  // guest-readable public_profile instead so the page isn't a 404.
  const enrichedSeller = seller
    ? await enrichSellerRating(
        await enrichSellerResponseRate(seller, result.items[0]?.id, opts.revalidate),
        userId,
        opts.revalidate,
      )
    : await buildSellerFromPublicProfile(userId, opts.revalidate);

  return {
    seller: enrichedSeller,
    listings: result.items,
    totalCount: result.pagination.totalCount,
  };
}

interface PublicProfileUser {
  id: number;
  fullName?: string;
  province?: string | null;
  city?: string | null;
  verified?: boolean;
  avatarUrl?: string | null;
  responseRatePercent?: number | null;
  responseTimeLabel?: string | null;
  lastActiveLabel?: SellerSummary["lastActiveLabel"];
  isAway?: boolean;
  awayUntil?: string | null;
  avgRating?: number | null;
  reviewCount?: number;
}

// Build a full seller summary straight from public_profile (guest-readable) for
// users with no active listings. Returns null only when the user truly doesn't
// exist (endpoint 404s), so the page can legitimately notFound().
async function buildSellerFromPublicProfile(
  userId: number | string,
  revalidate?: number,
): Promise<SellerSummary | null> {
  try {
    const { user } = await apiGet<{ user: PublicProfileUser }>(
      `users/${userId}/public_profile`,
      { revalidate },
    );
    return {
      id: user.id,
      name: user.fullName ?? "",
      city: user.province ?? user.city ?? null,
      verified: user.verified,
      avatarUrl: user.avatarUrl,
      responseRatePercent: user.responseRatePercent,
      responseTimeLabel: user.responseTimeLabel,
      lastActiveLabel: user.lastActiveLabel,
      sellerIsAway: user.isAway,
      sellerAwayUntil: user.awayUntil,
      avgRating: user.avgRating,
      reviewCount: user.reviewCount,
    };
  } catch {
    return null;
  }
}

// Rating summary lives on the public-profile `:public` view (guest-readable),
// not on the listings-index seller sub-object. Non-fatal: on failure the
// profile simply renders without a rating badge.
async function enrichSellerRating(
  seller: SellerSummary,
  userId: number | string,
  revalidate?: number,
): Promise<SellerSummary> {
  try {
    const { user } = await apiGet<{
      user: { avgRating?: number | null; reviewCount?: number };
    }>(`users/${userId}/public_profile`, { revalidate });
    return { ...seller, avgRating: user.avgRating, reviewCount: user.reviewCount };
  } catch {
    return seller;
  }
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
