"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { BellRing } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Switch } from "@/components/ui/switch";
import { flattenCategories } from "@/lib/api/categories";
import { getSavedSearches } from "@/lib/api/saved-searches";
import { sameSearch, searchCriteria } from "@/lib/saved-search-alerts";
import { useSearchAlert } from "@/lib/use-search-alert";
import type { Category } from "@/lib/types";
import type { BrowseFilters } from "./filters";

/**
 * Saved-search alerts (docs/design/SAVED_SEARCH_ALERTS.md §3, Handshake's
 * pattern): one slim row above the results — "🔔 Get alerts for new matches"
 * and a switch — that follows the search on screen. Signed-in only, and only
 * when there is a search worth following (a keyword or a filter).
 */
export function SearchAlertBanner({ filters, categories }: { filters: BrowseFilters; categories: Category[] }) {
  const t = useTranslations("browse.alerts");
  const { status } = useAuth();
  const flat = useMemo(() => flattenCategories(categories), [categories]);
  const criteria = searchCriteria(filters, flat);
  const worthFollowing = Object.values(criteria).some((v) => v !== undefined);

  const listQ = useQuery({ queryKey: ["saved-searches"], queryFn: getSavedSearches, enabled: status === "authed" });
  const toggle = useSearchAlert();

  if (status !== "authed" || !worthFollowing) return null;
  const saved = listQ.data?.find((s) => sameSearch(s, criteria));
  const on = Boolean(saved?.alert);

  return (
    <div
      data-testid="search-alert-banner"
      className="mb-4 flex animate-fade-in-up items-center gap-3 rounded-lg border bg-secondary/60 px-3 py-2"
    >
      <BellRing className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{t("bannerTitle")}</p>
        <p className="text-xs text-muted-foreground">{t("bannerHint")}</p>
      </div>
      <Switch
        checked={on}
        aria-label={t("bannerTitle")}
        disabled={toggle.isPending || listQ.isLoading}
        onCheckedChange={(alert) => toggle.mutate({ saved, criteria, alert })}
      />
    </div>
  );
}
