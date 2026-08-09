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
          <Button asChild variant="ghost" size="sm">
            <Link href={viewAllHref}>
              {viewAllLabel}
              {/* Mirrored in RTL so the arrow always points "forward". */}
              <ArrowRight className="size-4 rtl:-scale-x-100" />
            </Link>
          </Button>
        ) : null}
      </div>
      {isEmpty ? (
        empty
      ) : (
        <ListingGrid listings={listings} priorityCount={priorityCount} />
      )}
    </section>
  );
}
