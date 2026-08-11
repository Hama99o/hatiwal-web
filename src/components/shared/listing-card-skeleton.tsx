import { Skeleton } from "@/components/ui/skeleton";
import type { ListingCardVariant } from "./listing-card";

/**
 * Placeholder for the card's optional action footer (the seller lifecycle row):
 * a full-width primary button next to a square kebab, at the same 40px height
 * the real controls hold. Without it a footered grid grows ~61px taller per card
 * the moment data lands, and the whole grid reflows.
 */
function FooterSkeleton() {
  return (
    <div className="flex gap-2">
      <Skeleton className="h-10 min-w-0 flex-1" />
      <Skeleton className="size-10 shrink-0" />
    </div>
  );
}

/** Loading placeholder matching ListingCard's `grid` and `list` variants. */
export function ListingCardSkeleton({
  variant = "grid",
  withFooter = false,
}: {
  variant?: ListingCardVariant;
  /**
   * Mirror the card's action footer. Pass it wherever the loaded grid renders a
   * `footer`/`footerFor` (e.g. /my-listings) so the placeholder is the same
   * height as the card that replaces it.
   */
  withFooter?: boolean;
}) {
  if (variant === "list") {
    return (
      // Column wrapper + inner row: the same shape as the real list card, whose
      // link is the row and whose footer sits under it.
      <div className="flex flex-col overflow-hidden rounded-lg border bg-card p-2">
        <div className="flex gap-3">
          <Skeleton className="aspect-square w-24 shrink-0 rounded-md sm:w-28" />
          <div className="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        {withFooter && (
          <div className="mt-2 border-t pt-2">
            <FooterSkeleton />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      {withFooter && (
        <div className="border-t px-3 pb-3 pt-2">
          <FooterSkeleton />
        </div>
      )}
    </div>
  );
}
