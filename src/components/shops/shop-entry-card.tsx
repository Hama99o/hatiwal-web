"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ChevronRight, Plus, Store } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { UserAvatar } from "@/components/shared/user-avatar";
import { getMyShops, type Shop } from "@/lib/api/shops";
import type { User } from "@/lib/types";
import { shopOpenStatus } from "@/lib/shop-hours";
import { useSellingIdentity } from "./use-selling-identity";

/**
 * SHOP-1/2 Profile entry (same as mobile ShopEntryCard):
 *   no shop        → "Open your shop · Sell as a business…"   (no extra request)
 *   one shop       → "My shop · Safi Cosmetics · Open now"    (GET /my/shops for hours)
 *   several shops  → "My shops", one row per shop in the /me order (owned
 *                    first, then oldest), then a small "Open another shop".
 */
export function ShopEntryCard() {
  const t = useTranslations("shops");
  // ANY status: an owner always sees their shops here.
  const { allShops } = useSellingIdentity();
  const { data: myShops } = useQuery({ queryKey: ["my-shops"], queryFn: getMyShops, enabled: allShops.length > 0 });

  if (allShops.length === 0) {
    return (
      <Link href="/shops/new" data-testid="profile-open-shop" className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
          <Store className="size-5 text-primary" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{t("open")}</span>
          <span className="block truncate text-sm text-muted-foreground">{t("openSubtitle")}</span>
        </span>
        <ChevronRight className="size-4 text-muted-foreground rtl:-scale-x-100" />
      </Link>
    );
  }

  const many = allShops.length > 1;
  type MyShopEntry = NonNullable<User["shops"]>[number];
  const statusText = (card: MyShopEntry, full: Shop | undefined) => {
    if (card.status === "pending") return t("status.pending");
    if (card.status === "suspended") return t("status.suspended");
    const status = full ? shopOpenStatus(full) : { state: "unknown" as const };
    return status.state === "open" ? t("openNow") : status.state === "closed" ? t("closedNow") : null;
  };

  return (
    <section className="space-y-2" data-testid="profile-shops">
      {many && <h2 className="font-bold">{t("mineMany")}</h2>}
      {allShops.map((card, i) => {
        const status = statusText(card, myShops?.find((s) => s.id === card.id));
        // One shop keeps the phase-1 card ("My shop" over "name · status").
        const subtitle = many ? status : [card.name, status].filter(Boolean).join(" · ");
        return (
          <Link
            key={card.id}
            href={`/shops/${card.id}`}
            data-testid={i === 0 ? "profile-my-shop" : `profile-my-shop-${card.id}`}
            className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
          >
            <UserAvatar variant="shop" name={card.name} avatarUrl={card.logoUrl} size={44} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate font-bold">{many ? card.name : t("mine")}</span>
                {/* SHOP-3: Owner / Staff. */}
                {card.role && (
                  <span className="rounded-full bg-muted px-2 py-px text-[11px] font-semibold text-muted-foreground" data-testid={`profile-my-shop-role-${card.role}`}>
                    {t(`roles.${card.role}`)}
                  </span>
                )}
              </span>
              {subtitle && (
                <span
                  className={`block truncate text-sm ${card.status === "suspended" ? "text-destructive" : "text-muted-foreground"}`}
                  data-testid={`profile-my-shop-status-${card.status}`}
                >
                  {subtitle}
                </span>
              )}
            </span>
            <ChevronRight className="size-4 text-muted-foreground rtl:-scale-x-100" />
          </Link>
        );
      })}
      <Link href="/shops/new" data-testid="profile-open-another-shop" className="inline-flex items-center gap-2 px-1 py-2 text-sm font-semibold text-primary hover:underline">
        <Plus className="size-4" /> {t("openAnother")}
      </Link>
    </section>
  );
}
