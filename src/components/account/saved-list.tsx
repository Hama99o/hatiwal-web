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

export function SavedList() {
  const t = useTranslations();
  const { data, isPending, isError } = useQuery({
    queryKey: ["saved-listings"],
    queryFn: getSavedListings,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t("saved.title")}</h1>
      {isError ? (
        <EmptyState
          icon={Heart}
          title={t("common.error")}
          description={t("saved.emptyDescription")}
        />
      ) : isPending ? (
        <ListingGridSkeleton count={8} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Heart}
          title={t("saved.empty")}
          description={t("saved.emptyDescription")}
          action={{ label: t("saved.browseButton"), href: "/browse" }}
        />
      ) : (
        <ListingGrid listings={data} priorityCount={4} />
      )}
    </div>
  );
}
