import type * as React from "react";
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
  showSave,
  priorityCount = 0,
  hrefFor,
  footerFor,
  className,
}: {
  listings: Listing[];
  /** `grid` (default) = multi-column photo cards; `list` = compact rows. */
  viewMode?: ListingViewMode;
  showStatus?: boolean;
  /** Save-heart on each card (default true). Turn off in owner contexts. */
  showSave?: boolean;
  priorityCount?: number;
  /** Override each card's link target (e.g. seller dashboard → /my-listings/[id]). */
  hrefFor?: (listing: Listing) => string;
  /** Per-card action row under the body (e.g. seller lifecycle quick-actions). */
  footerFor?: (listing: Listing) => React.ReactNode;
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
          showSave={showSave}
          priority={i < priorityCount}
          href={hrefFor?.(listing)}
          footer={footerFor?.(listing)}
        />
      ))}
    </div>
  );
}

export function ListingGridSkeleton({
  count = 10,
  viewMode = "grid",
  className,
}: {
  count?: number;
  /** Match the layout being loaded so the skeleton doesn't jump shape. */
  viewMode?: ListingViewMode;
  className?: string;
}) {
  return (
    <div className={cn(viewMode === "list" ? LIST : GRID, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <ListingCardSkeleton key={i} variant={viewMode} />
      ))}
    </div>
  );
}
