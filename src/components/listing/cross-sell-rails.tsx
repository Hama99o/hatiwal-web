import { getTranslations } from "next-intl/server";
import {
  getListings,
  getSimilarListings,
  EMPTY_LISTINGS,
} from "@/lib/api/listings";
import { safe } from "@/lib/api/safe";
import { HideForOwner } from "@/components/auth/owner-gate";
import { ListingRail } from "@/components/shared/listing-rail";
import { ListingGridSkeleton } from "@/components/shared/listing-grid";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Listing } from "@/lib/types";

/**
 * Cards per rail. 4 is the count the shared rail's 2→4 column tracks divide
 * evenly, so a rail never wraps a lone orphan card onto its own row and never
 * leaves a hole in the last row.
 */
const RAIL_SIZE = 4;

/**
 * The two cross-sell rails under a listing: the seller's other active stock
 * first ("More from this Seller" — mirrors mobile TASK-M547), then same-category
 * "Similar Listings".
 *
 * Its own async Server Component so the page above it never waits on it: the
 * detail route renders the photo, price and seller card immediately and streams
 * these in behind a <Suspense> skeleton. Two Rails requests, issued in parallel,
 * each skipped when its key is missing; a failure degrades through `safe()` to
 * an empty list, i.e. that rail simply doesn't render.
 */
export async function CrossSellRails({
  listingId,
  sellerId,
  categorySlug,
  isActive,
  className,
}: {
  listingId: number;
  /** Omitted → the seller rail is skipped entirely (no request, no section). */
  sellerId?: number;
  /** Powers the similar rail's "view all"; omitted → bare rail. */
  categorySlug?: string;
  /**
   * Active listings own both "view all" links. On a sold/reserved listing
   * <UnavailableActions> already carries a prominent CTA to this seller AND one
   * to the same category, so the rails drop their duplicates and stay pure
   * browsing surfaces — one destination, one CTA.
   */
  isActive: boolean;
  className?: string;
}) {
  const t = await getTranslations();

  const [similarAll, sellerResult] = await Promise.all([
    // Similarity is defined once, server-side (Listing.similar_to), and shared
    // with mobile — never re-approximated here from category_id.
    safe(getSimilarListings(listingId), [] as Listing[]),
    // RAIL_SIZE + 1, not a page of 12: the only reason to fetch past the cap is
    // that this listing may itself come back in the page and get filtered out.
    sellerId
      ? safe(
          getListings({
            userId: sellerId,
            pageSize: RAIL_SIZE + 1,
          }),
          EMPTY_LISTINGS,
        )
      : EMPTY_LISTINGS,
  ]);

  const sellerListings = sellerResult.items
    .filter((l) => l.id !== listingId)
    .slice(0, RAIL_SIZE);

  // The two rails overlap whenever the seller has another listing in this same
  // category — the seller rail runs first and wins, so the buyer is never shown
  // the same card twice under two different headings. (`similar_to` already
  // excludes the source listing; the guard below costs nothing and keeps this
  // component honest if that ever changes.)
  const alreadyShown = new Set(sellerListings.map((l) => l.id));
  const similar = similarAll
    .filter((l) => l.id !== listingId && !alreadyShown.has(l.id))
    .slice(0, RAIL_SIZE);

  const bothRails = sellerListings.length > 0 && similar.length > 0;

  return (
    // empty:hidden so a listing with neither rail doesn't end in this block's
    // top margin as a strip of dead space above the footer.
    <div className={cn("empty:hidden", className)}>
      {/* Seller stock sits first: the buyer has just read the trust card
          (verified badge, rating, response rate), so this is the moment to show
          what else that seller has.

          Hidden from the seller themselves (mirrors mobile's `!isOwnListing`):
          "More from this Seller" is buyer copy and its "view all" would send the
          owner to their own public profile. Only the guard runs in the browser —
          the rail itself stays server-rendered, because the SSR fetch is
          anonymous and cannot know who is looking. */}
      {sellerListings.length > 0 && (
        <HideForOwner ownerId={sellerId}>
          <ListingRail
            testId="seller-rail"
            title={t("listing.detail.moreFromSeller")}
            listings={sellerListings}
            viewAllHref={
              isActive && sellerId ? `/sellers/${sellerId}` : undefined
            }
            viewAllLabel={t("home.viewAll")}
          />
          {/* Two grids of identical cards run together into one long wall.
              The rule marks where the seller's shelf ends and the category's
              begins — and it lives inside the owner gate so it disappears WITH
              the rail above it rather than dangling over the similar rail. */}
          {bothRails && <Separator className="my-10" data-testid="rail-divider" />}
        </HideForOwner>
      )}

      <ListingRail
        testId="similar-rail"
        title={t("listing.detail.similarListings")}
        listings={similar}
        viewAllHref={
          isActive && categorySlug ? `/categories/${categorySlug}` : undefined
        }
        viewAllLabel={t("home.viewAll")}
      />
    </div>
  );
}

/**
 * <Suspense> fallback for the rails: a heading bar plus one rail of card
 * skeletons on the very same 2→4 tracks, so the space the real rail takes is
 * already reserved when it arrives.
 *
 * Deliberately ONE rail, not two — most listings get both, but a skeleton that
 * promises more than the data delivers collapses on load, which reads worse
 * than filling in.
 */
export function CrossSellRailsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)} aria-hidden>
      <Skeleton className="h-7 w-48" />
      <ListingGridSkeleton count={RAIL_SIZE} columns="rail" />
    </div>
  );
}
