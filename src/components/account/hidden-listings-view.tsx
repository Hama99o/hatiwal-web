"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { EyeOff, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { getHiddenListings, unhideListing } from "@/lib/api/hidden-listings";
import { ListingCard } from "@/components/shared/listing-card";
import { ListingGridSkeleton } from "@/components/shared/listing-grid";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import type { Listing } from "@/lib/types";

/**
 * "Hidden Listings" management screen (mobile parity). Lists listings the user
 * marked "Not interested" and lets them restore each one to their Browse feed.
 * Restore is optimistic: the card leaves immediately and comes back on error.
 */
export function HiddenListingsView() {
  const t = useTranslations();
  const [restored, setRestored] = useState<Set<number>>(new Set());
  const [busyId, setBusyId] = useState<number | null>(null);

  const query = useInfiniteQuery({
    queryKey: ["hidden-listings"],
    queryFn: ({ pageParam }) => getHiddenListings(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => last.pagination.nextPage ?? undefined,
  });

  const listings = useMemo<Listing[]>(() => {
    const seen = new Set<number>();
    const out: Listing[] = [];
    for (const page of query.data?.pages ?? []) {
      for (const l of page.listings) {
        if (seen.has(l.id) || restored.has(l.id)) continue;
        seen.add(l.id);
        out.push(l);
      }
    }
    return out;
  }, [query.data, restored]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  async function restore(id: number) {
    setBusyId(id);
    setRestored((prev) => new Set(prev).add(id)); // optimistic remove
    try {
      await unhideListing(id);
      toast.success(t("hidden.restoreSuccess"));
    } catch {
      setRestored((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.error(t("hidden.restoreError"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t("hidden.title")}</h1>

      {query.isError ? (
        <EmptyState
          icon={EyeOff}
          title={t("common.errorTitle")}
          description={t("common.errorDescription")}
          action={{ label: t("common.retry"), onClick: () => query.refetch() }}
        />
      ) : query.isPending ? (
        <ListingGridSkeleton count={8} />
      ) : listings.length === 0 ? (
        <EmptyState
          icon={EyeOff}
          title={t("hidden.empty")}
          description={t("hidden.emptyDescription")}
          action={{ label: t("hidden.browseButton"), href: "/bazaar" }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {listings.map((l) => (
              <div key={l.id} className="flex flex-col gap-2">
                <ListingCard listing={l} showSave={false} priority={false} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => restore(l.id)}
                  disabled={busyId === l.id}
                >
                  {busyId === l.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RotateCcw className="size-4" />
                  )}
                  {t("hidden.restore")}
                </Button>
              </div>
            ))}
          </div>
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
