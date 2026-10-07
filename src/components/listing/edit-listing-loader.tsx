"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { getMyListing } from "@/lib/api/me";
import type { Category } from "@/lib/types";
import { ListingForm } from "./listing-form";
import { EmptyState } from "@/components/shared/empty-state";
import { TriangleAlert } from "lucide-react";

/** Fetches the seller's own listing (authed) then renders the edit form. */
export function EditListingLoader({
  id,
  categories,
}: {
  id: string;
  categories: Category[];
}) {
  const t = useTranslations();
  // "Edit & relaunch" (owner, 2026-10-12): the expired listing's link adds
  // ?relaunch=1, and saving then also relaunches it.
  const relaunch = useSearchParams().get("relaunch") === "1";
  const { data, isPending, isError } = useQuery({
    queryKey: ["my-listing", id],
    queryFn: () => getMyListing(id),
  });

  if (isPending) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <EmptyState icon={TriangleAlert} title={t("common.error")} />
      </div>
    );
  }
  return <ListingForm categories={categories} listing={data} relaunch={relaunch} />;
}
