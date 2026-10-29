"use client";

import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Camera, ImageOff, SearchX, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { ListingGrid, ListingGridSkeleton } from "@/components/shared/listing-grid";
import { getPendingPhoto } from "@/lib/image-search/pending-photo";
import { shrinkPhoto } from "@/lib/image-search/shrink-photo";
import {
  imageSearchErrorKey,
  precheckPhoto,
  searchByImage,
} from "@/lib/api/image-search";
import { localizeDigits } from "@/lib/format";
import { PhotoPicker } from "./photo-picker";
import { useStartImageSearch } from "./image-search-button";

class PrecheckError extends Error {
  constructor(public key: ReturnType<typeof imageSearchErrorKey>) {
    super(key);
  }
}

/**
 * Search by image — the results page (docs/design/IMAGE_SEARCH.md in
 * hatiwal-mobile): the buyer's photo stays on top as a thumbnail (SHEIN), the
 * shared listing grid below it, best match first, and "Try another photo"
 * always one tap away. No match says what to do and offers text search
 * instead (Amazon).
 */
export function ImageSearchView() {
  const t = useTranslations("imageSearch");
  const locale = useLocale();
  const pending = getPendingPhoto(useSearchParams().get("p"));
  const start = useStartImageSearch();

  const query = useQuery({
    // One search per picked photo: Back from a listing returns to the same
    // results from the cache instead of uploading the photo again.
    queryKey: ["image-search", pending?.id],
    queryFn: async () => {
      const photo = await shrinkPhoto(pending!.photo);
      const refused = precheckPhoto(photo);
      if (refused) throw new PrecheckError(refused);
      const original = pending!.photo;
      return searchByImage(photo, {
        filename: original instanceof File ? original.name : undefined,
      });
    },
    enabled: Boolean(pending),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
  });

  const tryAnother = (label: string, variant: "default" | "outline" = "default") => (
    <PhotoPicker onPick={start} align="start">
      <Button variant={variant} data-testid="image-search-try-another">
        <Camera aria-hidden />
        {label}
      </Button>
    </PhotoPicker>
  );

  if (!pending) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState icon={Camera} title={t("startTitle")} description={t("startHint")} />
        <div className="mt-4 flex justify-center">{tryAnother(t("choosePhoto"))}</div>
      </div>
    );
  }

  const loading = query.isPending;
  const items = query.data?.items ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8" data-testid="image-search-view">
      <header className="mb-6 flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, never optimisable */}
        <img
          src={pending.previewUrl}
          alt={t("yourPhoto")}
          className="size-16 shrink-0 rounded-xl bg-surface object-cover sm:size-20"
          data-testid="image-search-preview"
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-foreground sm:text-xl">{t("title")}</h1>
          <p className="text-sm text-muted-foreground" aria-live="polite" data-testid="image-search-status">
            {loading
              ? t("searching")
              : query.isSuccess
                ? localizeDigits(t("count", { count: query.data.pagination.totalCount }), locale)
                : null}
          </p>
        </div>
        <div className="hidden sm:block">{tryAnother(t("tryAnother"), "outline")}</div>
      </header>

      {loading && <ListingGridSkeleton count={10} />}

      {query.isError && (
        <div className="flex flex-col items-center gap-4">
          <EmptyState
            icon={ImageOff}
            title={t(`errors.${errorKey(query.error)}`)}
            className="w-full"
          />
          {tryAnother(t("tryAnother"))}
        </div>
      )}

      {query.isSuccess && items.length === 0 && (
        <div className="flex flex-col items-center gap-4">
          <EmptyState icon={SearchX} title={t("emptyTitle")} description={t("emptyHint")} className="w-full" />
          <div className="flex flex-wrap justify-center gap-3">
            {tryAnother(t("tryAnother"))}
            <Button variant="outline" asChild>
              <Link href="/bazaar">
                <Type aria-hidden />
                {t("searchByText")}
              </Link>
            </Button>
          </div>
        </div>
      )}

      {query.isSuccess && items.length > 0 && (
        <>
          <ListingGrid listings={items} priorityCount={4} />
          <div className="mt-8 flex justify-center sm:hidden">{tryAnother(t("tryAnother"), "outline")}</div>
        </>
      )}
    </div>
  );
}

function errorKey(error: unknown) {
  return error instanceof PrecheckError ? error.key : imageSearchErrorKey(error);
}
