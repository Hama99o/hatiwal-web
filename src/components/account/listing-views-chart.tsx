"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { getListingAnalytics } from "@/lib/api/me";
import { formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * 7-day views bar chart on the manage-listing page (mobile parity). Dependency
 * free — bars are flex divs sized by count, so no charting library is pulled in.
 */
export function ListingViewsChart({ id }: { id: number | string }) {
  const t = useTranslations();
  const locale = useLocale();
  const { data, isPending, isError } = useQuery({
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

  // Distinguish a fetch failure from a genuine no-views state — otherwise an
  // error silently renders as "no views yet".
  if (isError) {
    return (
      <section className="mt-8 max-w-3xl">
        <h2 className="text-lg font-semibold">{t("listing.analytics.title")}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t("common.errorDescription")}
        </p>
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
          {/* Every digit in this chart goes through `formatNumber` — the bar
              labels and the tooltip used to print the raw count, so on /ps a
              Latin "12" sat under the Arabic-Indic total above and beside the
              listing's Arabic-Indic price (see `src/lib/format.ts`: it is the
              only place a number is formatted). */}
          {entries.map((e, i) => (
            <div
              key={`${e.date}-${i}`}
              className="flex flex-1 flex-col items-center justify-end gap-1"
              title={`${e.date}: ${formatNumber(e.count, locale)}`}
            >
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {formatNumber(e.count, locale)}
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
