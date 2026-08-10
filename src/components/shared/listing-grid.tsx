import type * as React from "react";
import {
  ListingCard,
  type ListingCardTracks,
  type ListingCardVariant,
} from "./listing-card";
import { ListingCardSkeleton } from "./listing-card-skeleton";
import { cn } from "@/lib/utils";
import type { Listing } from "@/lib/types";

/**
 * Column tracks per context. `page` is the browse/feed layout that fills the
 * widest container it is given. `rail` is a fixed 2→4 for the capped cross-sell
 * rails: 4 cards divide evenly into both 2 and 4 columns, so a rail never wraps
 * a lone orphan card onto its own row and never leaves a hole in the last row
 * (which `sm:grid-cols-3`/`xl:grid-cols-5` would at a cap of 4).
 *
 * Typed by `ListingCardTracks` so every track set here has a matching photo
 * `sizes` hint in the card (`CARD_IMAGE_SIZES`) — adding one without the other
 * is a type error, not a silently oversized download.
 */
const GRID_COLUMNS: Record<ListingCardTracks, string> = {
  page: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
  rail: "grid-cols-2 md:grid-cols-4",
};

export type ListingGridColumns = ListingCardTracks;

const GRID = "grid gap-3";
/** List = one dense row per listing. */
const LIST = "flex flex-col gap-3";

export type ListingViewMode = ListingCardVariant;

export function ListingGrid({
  listings,
  viewMode = "grid",
  columns = "page",
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
  /** `page` (default) = full feed tracks; `rail` = 2→4 for a capped rail. */
  columns?: ListingGridColumns;
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
    <div
      className={cn(
        viewMode === "list" ? LIST : [GRID, GRID_COLUMNS[columns]],
        className,
      )}
    >
      {listings.map((listing, i) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          variant={viewMode}
          tracks={columns}
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
  columns = "page",
  className,
}: {
  count?: number;
  /** Match the layout being loaded so the skeleton doesn't jump shape. */
  viewMode?: ListingViewMode;
  /** Match the grid it stands in for, so the shape doesn't jump on load. */
  columns?: ListingGridColumns;
  className?: string;
}) {
  return (
    <div
      className={cn(
        viewMode === "list" ? LIST : [GRID, GRID_COLUMNS[columns]],
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <ListingCardSkeleton key={i} variant={viewMode} />
      ))}
    </div>
  );
}
