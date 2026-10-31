"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { TrendingUp } from "lucide-react";
import { getPriceGuide } from "@/lib/api/price-guide";
import { formatNumber } from "@/lib/format";

/**
 * IDEA-4: under the Sell form's price, what similar items sold for — only when
 * the server published a range for this subcategory + currency. Informational,
 * never a warning; nothing otherwise. Same line as mobile's PriceGuideLine.
 */
export function PriceGuideLine({ categoryId, currency }: { categoryId: number | null; currency: string }) {
  const t = useTranslations("listing.priceGuide");
  const locale = useLocale();
  const { data } = useQuery({
    queryKey: ["price-guide", categoryId, currency],
    queryFn: () => getPriceGuide(categoryId as number, currency),
    staleTime: 12 * 60 * 60 * 1000,
    enabled: categoryId != null && !!currency,
  });
  if (!data || !data.available) return null;

  return (
    <p data-testid="price-guide-line" className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <TrendingUp className="size-3.5 shrink-0" aria-hidden />
      {t("line", {
        low: formatNumber(data.low, locale),
        high: formatNumber(data.high, locale),
        currency: data.currency,
        n: formatNumber(data.count, locale),
      })}
    </p>
  );
}
