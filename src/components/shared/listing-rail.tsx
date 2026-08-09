import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ListingGrid } from "./listing-grid";
import { cn } from "@/lib/utils";
import type { Listing } from "@/lib/types";

/**
 * A cross-sell rail: section heading + optional "view all" link + a listing grid.
 *
 * Renders **nothing** when there are no listings, so a page can drop one in
 * unconditionally without ever showing a dangling heading over an empty grid.
 * Used by listing detail for both "More from this Seller" and "Similar Listings".
 */
export function ListingRail({
  title,
  listings,
  viewAllHref,
  viewAllLabel,
  className,
}: {
  title: string;
  listings: Listing[];
  /** Pass both href + label to show the trailing link; omit for a bare rail. */
  viewAllHref?: string;
  viewAllLabel?: string;
  className?: string;
}) {
  if (listings.length === 0) return null;

  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
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
      <ListingGrid listings={listings} />
    </section>
  );
}
