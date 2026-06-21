"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Bookmark, BookmarkPlus, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { categoryName, flattenCategories } from "@/lib/api/categories";
import {
  createSavedSearch,
  deleteSavedSearch,
  getSavedSearches,
  type SavedSearch,
} from "@/lib/api/saved-searches";
import type { BrowseFilters } from "./filters";
import type { Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Saved searches in the browse sidebar (mirrors mobile): save the current
 * category + price + location filters, then one-tap re-apply or delete them.
 * Auth-only — hidden for guests.
 */
export function SavedSearches({
  filters,
  categories,
  onApply,
}: {
  filters: BrowseFilters;
  categories: Category[];
  onApply: (patch: Partial<BrowseFilters>) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const { status } = useAuth();
  const qc = useQueryClient();
  const flat = useMemo(() => flattenCategories(categories), [categories]);

  const listQ = useQuery({
    queryKey: ["saved-searches"],
    queryFn: getSavedSearches,
    enabled: status === "authed",
  });

  const createMut = useMutation({
    mutationFn: () => {
      const cat = flat.find((c) => c.slug === filters.categorySlug);
      return createSavedSearch({
        categoryId: cat?.id,
        priceMin: filters.priceMin ? Number(filters.priceMin) : undefined,
        priceMax: filters.priceMax ? Number(filters.priceMax) : undefined,
        latitude: filters.lat ? Number(filters.lat) : undefined,
        longitude: filters.lng ? Number(filters.lng) : undefined,
        radius: filters.radius ? Number(filters.radius) : undefined,
      });
    },
    onSuccess: () => {
      toast.success(t("browse.savedSearchCreated"));
      qc.invalidateQueries({ queryKey: ["saved-searches"] });
    },
    onError: () => toast.error(t("common.error")),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteSavedSearch(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-searches"] }),
    onError: () => toast.error(t("common.error")),
  });

  if (status !== "authed") return null;

  // Something worth saving = at least one of category / price / location set.
  const canSave = Boolean(
    filters.categorySlug ||
      filters.priceMin ||
      filters.priceMax ||
      (filters.lat && filters.lng),
  );

  function summarize(s: SavedSearch): string {
    const parts: string[] = [];
    if (s.categoryId) {
      const cat = flat.find((c) => c.id === s.categoryId);
      parts.push(cat ? categoryName(cat, locale) : (s.categoryName ?? ""));
    }
    if (s.priceMin || s.priceMax) {
      parts.push(`${s.priceMin ?? ""}–${s.priceMax ?? ""}`);
    }
    if (s.locationBased && s.radius) {
      parts.push(`📍 ${s.radius} ${t("browse.km")}`);
    }
    return parts.filter(Boolean).join(" · ") || t("browse.savedSearchAll");
  }

  function apply(s: SavedSearch) {
    const cat = s.categoryId
      ? flat.find((c) => c.id === s.categoryId)
      : undefined;
    onApply({
      categorySlug: cat?.slug ?? "",
      priceMin: s.priceMin != null ? String(s.priceMin) : "",
      priceMax: s.priceMax != null ? String(s.priceMax) : "",
      lat: s.latitude != null ? String(s.latitude) : "",
      lng: s.longitude != null ? String(s.longitude) : "",
      radius: s.radius != null ? String(s.radius) : "",
    });
  }

  const searches = listQ.data ?? [];

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <Bookmark className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">
          {t("browse.savedSearches")}
        </h3>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mb-2 w-full"
        disabled={!canSave || createMut.isPending}
        onClick={() => createMut.mutate()}
      >
        <BookmarkPlus className="size-4" />
        {t("browse.saveSearch")}
      </Button>

      {searches.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("browse.noSavedSearches")}
        </p>
      ) : (
        <ul className="space-y-1">
          {searches.map((s) => (
            <li
              key={s.id}
              className={cn(
                "flex items-center gap-1 rounded-md border px-2 py-1.5",
                "bg-card transition-colors hover:bg-accent",
              )}
            >
              <button
                type="button"
                onClick={() => apply(s)}
                className="min-w-0 flex-1 truncate text-start text-sm"
              >
                {summarize(s)}
              </button>
              <button
                type="button"
                aria-label={t("browse.deleteSavedSearch")}
                onClick={() => deleteMut.mutate(s.id)}
                disabled={deleteMut.isPending}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
