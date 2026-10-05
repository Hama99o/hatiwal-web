"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ChevronRight, Store } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { UserAvatar } from "@/components/shared/user-avatar";
import { getMyShops } from "@/lib/api/shops";
import { shopOpenStatus } from "@/lib/shop-hours";
import { useSellingIdentity } from "./use-selling-identity";

/**
 * SHOP-1 Profile entry (same as mobile ShopEntryCard):
 *   no shop → "Open your shop · Sell as a business…"   (no extra request)
 *   owner   → "My shop · Safi Cosmetics · Open now"    (GET /my/shops for hours)
 */
export function ShopEntryCard() {
  const t = useTranslations("shops");
  // ANY status: an owner never sees "Open your shop" again (that path 422s).
  const { allShops } = useSellingIdentity();
  const { data: myShops } = useQuery({ queryKey: ["my-shops"], queryFn: getMyShops, enabled: allShops.length > 0 });

  const card = allShops[0];
  const full = myShops?.find((s) => s.id === card?.id);
  const status = full ? shopOpenStatus(full) : { state: "unknown" as const };
  const statusText =
    card?.status === "pending"
      ? t("status.pending")
      : card?.status === "suspended"
        ? t("status.suspended")
        : status.state === "open"
          ? t("openNow")
          : status.state === "closed"
            ? t("closedNow")
            : null;

  return (
    <Link
      href={card ? `/shops/${card.id}` : "/shops/new"}
      data-testid={card ? "profile-my-shop" : "profile-open-shop"}
      className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
    >
      {card ? (
        <UserAvatar variant="shop" name={card.name} avatarUrl={card.logoUrl} size={44} />
      ) : (
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
          <Store className="size-5 text-primary" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{card ? t("mine") : t("open")}</span>
        <span
          className={`block truncate text-sm ${card?.status === "suspended" ? "text-destructive" : "text-muted-foreground"}`}
          data-testid={card ? `profile-my-shop-status-${card.status}` : undefined}
        >
          {card ? [card.name, statusText].filter(Boolean).join(" · ") : t("openSubtitle")}
        </span>
      </span>
      <ChevronRight className="size-4 text-muted-foreground rtl:-scale-x-100" />
    </Link>
  );
}
