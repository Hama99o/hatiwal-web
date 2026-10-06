"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { setSellerMode } from "@/lib/api/me";
import { useSellingIdentity } from "@/components/shops/use-selling-identity";
import type { Conversation } from "@/lib/types";

/**
 * Owner, 2026-10-06 (mobile 6736017 + 1c4c5af): opening a thread on the SELLER
 * side (anyone who isn't the buyer: the seller or a shop's team member), e.g.
 * from a direct link, puts the viewer in Seller mode and sells as the chat's
 * shop (or Me for a personal selling chat), so the chat is in the inbox when
 * they go back. Once per thread open, after the session user has loaded.
 * A shop they're no longer in: a toast, no switch.
 */
export function useSellerSideEntry(conversation: Conversation | undefined, isSupport: boolean) {
  const t = useTranslations("shops");
  const { user, setUser } = useAuth();
  const { sellingAs, allShops, switchToAsync } = useSellingIdentity();
  const done = useRef<number | null>(null);

  const sellerSide =
    !!conversation && !!user && !isSupport && conversation.viewerRole !== "buyer" && conversation.buyer?.id !== user.id;
  const shopId = conversation?.shop?.id ?? null;

  useEffect(() => {
    if (!sellerSide || !conversation || !user || done.current === conversation.id) return;
    done.current = conversation.id;
    if (shopId !== null) {
      const mine = allShops.find((s) => s.id === shopId && s.status === "active");
      if (!mine) {
        toast.error(t("team.noLongerOnTeam"));
        return;
      }
    }
    void (async () => {
      if (!user.sellerMode) {
        const updated = await setSellerMode(true).catch(() => null);
        if (updated) setUser(updated);
      }
      if ((sellingAs?.id ?? null) !== shopId) await switchToAsync(shopId);
    })();
    // Once per thread: the ref guards repeats; the identity values are read fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerSide, conversation?.id, user?.id]);

  return { sellerSide, shopName: shopId !== null ? conversation?.shop?.name ?? null : null };
}
