import { ListingCard, type ListingCardVariant } from "./listing-card";
import { ListingCardSkeleton } from "./listing-card-skeleton";
import { cn } from "@/lib/utils";
import type { Listing } from "@/lib/types";

const GRID =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
/** List = one dense row per listing. */
const LIST = "flex flex-col gap-3";

export type ListingViewMode = ListingCardVariant;

export function ListingGrid({
  listings,
  viewMode = "grid",
  showStatus,
  priorityCount = 0,
  hrefFor,
  className,
}: {
  listings: Listing[];
  /** `grid` (default) = multi-column photo cards; `list` = compact rows. */
  viewMode?: ListingViewMode;
  showStatus?: boolean;
  priorityCount?: number;
  /** Override each card's link target (e.g. seller dashboard → /my-listings/[id]). */
  hrefFor?: (listing: Listing) => string;
  className?: string;
}) {
  return (
    <div className={cn(viewMode === "list" ? LIST : GRID, className)}>
      {listings.map((listing, i) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          variant={viewMode}
          showStatus={showStatus}
          priority={i < priorityCount}
          href={hrefFor?.(listing)}
        />
      ))}
    </div>
  );
}

export function ListingGridSkeleton({
  count = 10,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn(GRID, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <ListingCardSkeleton key={i} />
      ))}
    </div>
  );
}
