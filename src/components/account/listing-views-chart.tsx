"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getListingAnalytics } from "@/lib/api/me";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * 7-day views bar chart on the manage-listing page (mobile parity). Dependency
 * free — bars are flex divs sized by count, so no charting library is pulled in.
 */
export function ListingViewsChart({ id }: { id: number | string }) {
  const t = useTranslations();
  const { data, isPending } = useQuery({
    queryKey: ["listing-analytics", String(id)],
    queryFn: () => getListingAnalytics(id),
  });

  if (isPending) {
    return (
      <section className="mt-8 max-w-3xl">
        <Skeleton className="h-32 w-full rounded-lg" />
      </section>
    );
  }

  const entries = data ?? [];
  const total = entries.reduce((s, e) => s + e.count, 0);
  const max = Math.max(1, ...entries.map((e) => e.count));

  return (
    <section className="mt-8 max-w-3xl">
      <h2 className="text-lg font-semibold">{t("listing.analytics.title")}</h2>
      <p className="mb-3 mt-0.5 text-sm text-muted-foreground">
        {t("listing.analytics.totalViews", { count: total })}
      </p>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("listing.analytics.noData")}
        </p>
      ) : (
        <div className="flex h-28 items-end gap-1.5 rounded-lg border bg-card p-3">
          {entries.map((e, i) => (
            <div
              key={`${e.date}-${i}`}
              className="flex flex-1 flex-col items-center justify-end gap-1"
              title={`${e.date}: ${e.count}`}
            >
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {e.count}
              </span>
              <div
                className="w-full rounded-t bg-primary/70"
                style={{ height: `${Math.max(4, (e.count / max) * 80)}px` }}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
