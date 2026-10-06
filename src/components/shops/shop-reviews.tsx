"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Loader2, Star } from "lucide-react";
import { getShopReviews } from "@/lib/api/reviews";
import type { Review } from "@/lib/types";
import { ReviewCard } from "@/components/shared/review-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The shop page's Reviews tab: the SHOP's reviews (GET /shops/:id/reviews),
 * never the owner's personal ones (as a buyer or on personal sales). Same
 * cards, states and paging as the seller profile's ReviewsSection.
 */
export function ShopReviews({ shopId }: { shopId: number }) {
  const t = useTranslations("shops");
  const tc = useTranslations("common");
  const query = useInfiniteQuery({
    queryKey: ["shop-reviews", shopId],
    queryFn: ({ pageParam }) => getShopReviews(shopId, { page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => last.pagination.nextPage ?? undefined,
  });
  const reviews = useMemo<Review[]>(() => (query.data?.pages ?? []).flatMap((p) => p.items), [query.data]);

  return (
    <section className="mt-6" data-testid="shop-reviews">
      {query.isError ? (
        <EmptyState
          icon={Star}
          title={tc("errorTitle")}
          description={tc("errorDescription")}
          action={{ label: tc("retry"), onClick: () => query.refetch() }}
        />
      ) : query.isPending ? (
        <div className="flex flex-col gap-3">
          {[0, 1].map((n) => (
            <Skeleton key={n} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : reviews.length > 0 ? (
        <div className="flex flex-col gap-3">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
          {query.hasNextPage && (
            <Button variant="outline" className="mx-auto mt-2" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
              {query.isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
              {tc("loadMore")}
            </Button>
          )}
        </div>
      ) : (
        <div data-testid="shop-reviews-empty">
          <EmptyState icon={Star} title={t("empty.reviews")} />
        </div>
      )}
    </section>
  );
}
