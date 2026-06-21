"use client";

import { useQuery } from "@tanstack/react-query";
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
  return <ListingForm categories={categories} listing={data} />;
}
