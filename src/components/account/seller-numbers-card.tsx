"use client";

import { useLocale, useTranslations } from "next-intl";
import { BarChart3, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useSellingIdentity } from "@/components/shops/use-selling-identity";
import { formatNumber } from "@/lib/format";
import { useSellerAnalytics } from "./use-seller-analytics";

/**
 * Profile (Seller mode): the numbers that left Profile on 2026-10-07 come back,
 * labelled with WHOSE they are — "Me" or the shop the user sells as (owner,
 * 2026-10-12; item 2). Three numbers and the way into /analytics.
 */
export function SellerNumbersCard() {
  const t = useTranslations();
  const locale = useLocale();
  const { sellingAs } = useSellingIdentity();
  const shopId = sellingAs?.id ?? null;
  const { data } = useSellerAnalytics(shopId);
  const whose = shopId != null ? sellingAs?.name ?? "" : t("shops.me");
  const cells: [string, string, number | undefined][] = [
    ["active", t("seller.analytics.active"), data?.active],
    ["sold", t("seller.analytics.sold"), data?.sold],
    ["expired", t("seller.analytics.expired"), data?.expired],
  ];

  return (
    <Link
      href={`/analytics?shop=${shopId ?? "me"}`}
      className="block space-y-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid="profile-seller-numbers"
    >
      <div className="flex items-center gap-2">
        <BarChart3 className="size-4 text-primary" />
        <span className="min-w-0 flex-1 truncate font-semibold" data-testid="profile-seller-numbers-title">
          {t("seller.analytics.cardTitle", { name: whose })}
        </span>
        <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" />
      </div>
      <div className="grid grid-cols-3 divide-x text-center rtl:divide-x-reverse">
        {cells.map(([key, label, value]) => (
          <div key={key} data-testid={`profile-seller-numbers-${key}`}>
            <div className="text-xl font-bold text-primary">{value == null ? "–" : formatNumber(value, locale)}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
    </Link>
  );
}
