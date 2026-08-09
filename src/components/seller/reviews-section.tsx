"use client";

import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Star, Store, ShoppingBag, Loader2 } from "lucide-react";
import { getUserReviews } from "@/lib/api/reviews";
import type { Review, ReviewRole } from "@/lib/types";
import { ReviewCard } from "@/components/shared/review-card";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Ratings & Reviews list (REV3, mobile parity) — used by the public seller
 * profile and by your own `/profile`. The review LIST is lazy-loaded per role
 * via TanStack Query, mirroring `SellerListingsTabs`, and paginated with a
 * Load-more button so sellers with many reviews aren't truncated to the first
 * page. Only VISIBLE (double-blind–revealed) reviews are ever returned.
 *
 * The score itself is deliberately NOT repeated here: every page that renders
 * this section already shows the person's `RatingDisplay` in its header, next
 * to who they are. Two copies of one score on a page mean neither is the hero.
 */
export function ReviewsSection({
  sellerId,
  title,
  headingSize = "lg",
}: {
  sellerId: number;
  /**
   * Heading override — defaults to "Ratings & Reviews" (public seller profile).
   * The signed-in user's own `/profile` passes "My reviews" instead; everything
   * else (role tabs, pagination, states) is identical, so never fork this.
   */
  title?: string;
  /**
   * Heading scale. `lg` is a page-level section (public seller profile); `sm`
   * matches the small card labels on `/profile`, so sibling `h2`s there are not
   * two different sizes.
   */
  headingSize?: "sm" | "lg";
}) {
  const t = useTranslations("reviews");
  const tc = useTranslations("common");
  const [role, setRole] = useState<ReviewRole>("of_seller");

  const query = useInfiniteQuery({
    queryKey: ["seller-reviews", sellerId, role],
    queryFn: ({ pageParam }) =>
      getUserReviews(sellerId, { role, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => last.pagination.nextPage ?? undefined,
  });

  const reviews = useMemo<Review[]>(
    () => (query.data?.pages ?? []).flatMap((p) => p.items),
    [query.data],
  );

  return (
    <section className="mt-10">
      <h2
        className={cn(
          "font-semibold text-foreground",
          headingSize === "lg" ? "text-lg" : "text-sm",
        )}
      >
        {title ?? t("sectionTitle")}
      </h2>

      <SegmentedControl<ReviewRole>
        className="mt-4 max-w-sm"
        fullWidth
        ariaLabel={t("tabsLabel")}
        value={role}
        onChange={setRole}
        options={[
          { value: "of_seller", label: t("asSeller"), icon: Store },
          { value: "of_buyer", label: t("asBuyer"), icon: ShoppingBag },
        ]}
      />

      <div className="mt-6">
        {query.isError ? (
          <EmptyState
            icon={Star}
            title={tc("errorTitle")}
            description={tc("errorDescription")}
            action={{ label: tc("retry"), onClick: () => query.refetch() }}
          />
        ) : query.isPending ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((n) => (
              <Skeleton key={n} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        ) : reviews.length > 0 ? (
          <div className="flex flex-col gap-3">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
            {query.hasNextPage && (
              <Button
                variant="outline"
                className="mx-auto mt-2"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                {query.isFetchingNextPage && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {tc("loadMore")}
              </Button>
            )}
          </div>
        ) : (
          <EmptyState
            icon={Star}
            /* Role-specific so the empty state says which reputation is empty
               (and doesn't echo the generic "No reviews yet" summary label). */
            title={t(role === "of_seller" ? "emptyAsSeller" : "emptyAsBuyer")}
            description={t("emptyDescription")}
          />
        )}
      </div>
    </section>
  );
}
