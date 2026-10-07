"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, TriangleAlert } from "lucide-react";
import { getMyListing } from "@/lib/api/me";
import type { Category } from "@/lib/types";
import { EmptyState } from "@/components/shared/empty-state";
import { ListingForm } from "./listing-form";

/**
 * /listings/new, and `?duplicateFrom=<id>` (owner, 2026-10-12; item 5): the
 * new listing starts from the seller's own listing — its text, price, category
 * and place, not its photos (mobile does the same). The copy is posted as
 * whoever the user sells as; the "Duplicate to…" menu switches that first.
 */
export function NewListingLoader({ categories }: { categories: Category[] }) {
  const t = useTranslations();
  const from = useSearchParams().get("duplicateFrom");
  const valid = from != null && /^\d+$/.test(from);
  const { data, isPending, isError } = useQuery({
    queryKey: ["my-listing", from],
    queryFn: () => getMyListing(from!),
    enabled: valid,
  });

  if (!valid) return <ListingForm categories={categories} />;
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
  return <ListingForm categories={categories} prefill={data} />;
}
