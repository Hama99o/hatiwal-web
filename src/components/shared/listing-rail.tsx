import type * as React from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ListingGrid } from "./listing-grid";
import { cn } from "@/lib/utils";
import type { Listing } from "@/lib/types";

/**
 * THE listing section: heading + optional "view all" link + a listing grid.
 *
 * One component for every "titled group of listings" on the site — the home
 * page's "Recent listings" block and both cross-sell rails on listing detail
 * ("More from this Seller", "Similar Listings"). Two size variants keep the
 * typography each context had before it was consolidated here:
 *
 *   - `sm` (default) — a secondary cross-sell rail further down a page.
 *   - `lg` — a primary, page-level section (home).
 *
 * `sm` also switches the grid to the `rail` column tracks (2→4), which divide a
 * capped 4-card rail evenly at every breakpoint — no orphan card on its own row
 * and no empty slot in the last row.
 *
 * With no listings it renders `empty` when given (home shows an EmptyState under
 * the heading), and otherwise **nothing at all** — so a cross-sell page can drop
 * a rail in unconditionally and never show a dangling heading over a void.
 */
export function ListingRail({
  title,
  listings,
  viewAllHref,
  viewAllLabel,
  priorityCount,
  size = "sm",
  empty,
  testId,
  className,
}: {
  title: string;
  listings: Listing[];
  /** Pass both href + label to show the trailing link; omit for a bare rail. */
  viewAllHref?: string;
  viewAllLabel?: string;
  /** Cards to mark `priority` for LCP — only worth it above the fold. */
  priorityCount?: number;
  /** `sm` = secondary rail (default); `lg` = primary page section. */
  size?: "sm" | "lg";
  /** Shown in place of the grid when the list is empty; omit to render nothing. */
  empty?: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  const isEmpty = listings.length === 0;
  if (isEmpty && !empty) return null;

  const large = size === "lg";

  return (
    <section
      data-testid={testId}
      /* Names the region so it is announced (and reachable in a screen
         reader's landmark list) as "Similar Listings" / "More from this
         Seller" — a <section> with no accessible name is not a landmark at
         all, and two unnamed ones stacked are indistinguishable. */
      aria-label={title}
      className={cn(large ? "space-y-5" : "space-y-4", className)}
    >
      <div className="flex items-end justify-between gap-3">
        <h2
          className={cn(
            large ? "text-2xl font-bold tracking-tight" : "text-lg font-semibold",
          )}
        >
          {title}
        </h2>
        {viewAllHref && viewAllLabel ? (
          /* Default size, not `sm`: `sm` is 36px tall and this is a primary
             navigation target that has to clear the 40px touch minimum. */
          <Button asChild variant="ghost">
            <Link href={viewAllHref}>
              {viewAllLabel}
              {/* "View all" is identical on every rail, so on its own it says
                  nothing about where it goes — a screen reader's link list
                  would show it three times over. The section title is appended
                  invisibly, AFTER the visible words, so the accessible name
                  still starts with the label voice control has to match
                  (WCAG 2.5.3 Label in Name). No new string: the title is
                  already localized. */}
              <span className="sr-only">{` ${title}`}</span>
              {/* Mirrored in RTL so the arrow always points "forward". */}
              <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
            </Link>
          </Button>
        ) : null}
      </div>
      {isEmpty ? (
        empty
      ) : (
        <ListingGrid
          listings={listings}
          columns={large ? "page" : "rail"}
          priorityCount={priorityCount}
        />
      )}
    </section>
  );
}
