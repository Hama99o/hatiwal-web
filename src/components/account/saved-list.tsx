"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Heart } from "lucide-react";
import { getSavedListings } from "@/lib/api/me";
import {
  ListingGrid,
  ListingGridSkeleton,
} from "@/components/shared/listing-grid";
import { EmptyState } from "@/components/shared/empty-state";
import type { Listing } from "@/lib/types";

/**
 * Which saved cards carry a lifecycle badge: only what is off the market. A
 * SOLD listing (mobile 45526855) and an EXPIRED one, which stays saved but is
 * out of the feed (e5 run-312: it read as live). Reserved stays unlabelled, as
 * in the feed: a hold never stops a buyer from messaging. Mirrors mobile's
 * `savedCardShowsStatus`.
 */
export function savedCardShowsStatus(listing: Listing): boolean {
  return listing.status === "sold" || listing.expired === true;
}

export function SavedList() {
  const t = useTranslations();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["saved-listings"],
    queryFn: getSavedListings,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t("saved.title")}</h1>
      {isError ? (
        <EmptyState
          icon={Heart}
          title={t("common.errorTitle")}
          description={t("common.errorDescription")}
          action={{ label: t("common.retry"), onClick: () => refetch() }}
        />
      ) : isPending ? (
        <ListingGridSkeleton count={8} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Heart}
          title={t("saved.empty")}
          description={t("saved.emptyDescription")}
          action={{ label: t("saved.browseButton"), href: "/bazaar" }}
        />
      ) : (
        <ListingGrid listings={data} priorityCount={4} showStatus={savedCardShowsStatus} />
      )}
    </div>
  );
}
