import { Skeleton } from "@/components/ui/skeleton";
import type { ListingCardVariant } from "./listing-card";

/** Loading placeholder matching ListingCard's `grid` and `list` variants. */
export function ListingCardSkeleton({
  variant = "grid",
}: {
  variant?: ListingCardVariant;
}) {
  if (variant === "list") {
    return (
      <div className="flex gap-3 overflow-hidden rounded-lg border bg-card p-2">
        <Skeleton className="aspect-square w-24 shrink-0 rounded-md sm:w-28" />
        <div className="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
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
    </div>
  );
}
