"use client";

import { useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { History, Loader2 } from "lucide-react";
import { getViewedListings } from "@/lib/api/viewed-listings";
import {
  ListingGrid,
  ListingGridSkeleton,
} from "@/components/shared/listing-grid";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import type { Listing } from "@/lib/types";

export function RecentlyViewedList() {
  const t = useTranslations();

  const query = useInfiniteQuery({
    queryKey: ["viewed-listings"],
    queryFn: ({ pageParam }) => getViewedListings(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => last.pagination.nextPage ?? undefined,
  });

  // Flatten pages, de-duplicating by id: last_viewed_at can shift between page
  // fetches, so the same listing could theoretically arrive on two pages.
  const listings = useMemo<Listing[]>(() => {
    const seen = new Set<number>();
    const out: Listing[] = [];
    for (const page of query.data?.pages ?? []) {
      for (const listing of page.listings) {
        if (seen.has(listing.id)) continue;
        seen.add(listing.id);
        out.push(listing);
      }
    }
    return out;
  }, [query.data]);

  // Infinite scroll: load the next page when the sentinel enters the viewport.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t("recentlyViewed.title")}</h1>

      {query.isError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <History className="size-6" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              {t("common.errorTitle")}
            </p>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              {t("common.errorDescription")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            {query.isFetching && <Loader2 className="size-4 animate-spin" />}
            {t("common.retry")}
          </Button>
        </div>
      ) : query.isPending ? (
        <ListingGridSkeleton count={8} />
      ) : listings.length === 0 ? (
        <EmptyState
          icon={History}
          title={t("recentlyViewed.empty")}
          description={t("recentlyViewed.emptyDescription")}
          action={{ label: t("recentlyViewed.browseButton"), href: "/bazaar" }}
        />
      ) : (
        <>
          <ListingGrid listings={listings} priorityCount={4} />
          <div ref={sentinelRef} className="h-1" />
          {isFetchingNextPage && (
            <div className="flex justify-center py-6">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
