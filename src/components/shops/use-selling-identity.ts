"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiError } from "@/lib/api/client";
import { sellAs } from "@/lib/api/shops";
import type { ShopCard } from "@/lib/types";

/**
 * SHOP-1 "Selling as" on the web, same rules as mobile's useSellingIdentity:
 * the choice lives on the server (me.selling_as_shop) and sticks; a user with
 * no shop gets `hasShop: false` and sees exactly today's site.
 */
export function useSellingIdentity() {
  const t = useTranslations("shops");
  const qc = useQueryClient();
  const { user, refresh } = useAuth();

  const shops = (user?.shops ?? []).filter((s) => s.status === "active");
  const sellingAs: ShopCard | null = user?.sellingAsShop ?? null;

  const mutation = useMutation({
    mutationFn: (shopId: number | null) => sellAs(shopId),
    onSuccess: async (_fresh, shopId) => {
      await refresh();
      qc.invalidateQueries({ queryKey: ["my-listings"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      const name = shopId ? shops.find((s) => s.id === shopId)?.name : t("me");
      if (name) toast.success(t("nowSellingAs", { name }));
    },
    onError: async (err, shopId) => {
      if (err instanceof ApiError && err.code === "cannot_sell_as_shop") {
        const shop = shops.find((s) => s.id === shopId);
        if (shop) toast.error(t("removedNotice", { shop: shop.name }));
      }
      await refresh();
    },
  });

  const counts = user?.unreadCounts;
  return {
    sellingAs,
    shops,
    hasShop: shops.length > 0,
    unreadFor: (shopId: number | null): number | null =>
      counts ? (shopId === null ? counts.sellingMe : counts.shops[String(shopId)] ?? 0) : null,
    unreadBuying: counts ? counts.buying : null,
    switchTo: (shopId: number | null) => {
      if ((sellingAs?.id ?? null) === shopId || mutation.isPending) return;
      mutation.mutate(shopId);
    },
    switching: mutation.isPending,
  };
}
