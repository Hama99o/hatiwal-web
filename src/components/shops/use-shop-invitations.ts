"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { sellAs } from "@/lib/api/shops";
import {
  acceptShopInvite,
  declineShopInvite,
  getMyShopInvites,
  teamErrorMessage,
  type MyShopInvite,
} from "@/lib/api/shop-team";

export const MY_SHOP_INVITES_QK = ["my-shop-invites"] as const;

/** How often (at most) coming back to the tab re-reads the session user. */
const FOCUS_REFRESH_MS = 30_000;

/**
 * "Invitations to join a shop" (owner, 1.1.6): ONE data source for the two
 * places that show them (Profile and the Selling-as menu, plus the no-shop
 * invitations dialog): `me.pendingShopInvitesCount` says whether there are
 * any, GET /my/shop_invites lists them. Mobile has the same hook.
 */
export function useShopInvitations() {
  const t = useTranslations("shops");
  const tRoot = useTranslations();
  const qc = useQueryClient();
  const { user, setUser, refresh } = useAuth();
  const count = user?.pendingShopInvitesCount ?? 0;

  const { data: invites = [] } = useQuery({
    queryKey: MY_SHOP_INVITES_QK,
    queryFn: getMyShopInvites,
    enabled: !!user && count > 0,
  });

  // The count lives on the session user: re-read it when the person comes
  // back to the tab (an invite sent meanwhile shows without a reload).
  const lastRefresh = useRef(0);
  useEffect(() => {
    if (!user) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefresh.current < FOCUS_REFRESH_MS) return;
      lastRefresh.current = now;
      refresh().catch(() => undefined);
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, refresh]);

  const settle = () => {
    qc.invalidateQueries({ queryKey: MY_SHOP_INVITES_QK });
    qc.invalidateQueries({ queryKey: ["my-shops"] });
  };

  const accept = useMutation({
    // Accepting answers "who do you sell as?" (the app does the same, mobile
    // 18bfbbd): mark the ask-once Selling-as dialog answered and sell as the
    // joined shop, so Seller mode lands there with no question.
    mutationFn: async (invite: MyShopInvite) => {
      const res = await acceptShopInvite(invite.token);
      const uid = res.me?.id ?? user?.id;
      if (uid != null) {
        try {
          window.localStorage.setItem(`hatiwal.sell-as-asked-${uid}`, "1");
        } catch {
          /* storage blocked: the dialog may ask once, harmless */
        }
      }
      const selling = await sellAs<NonNullable<typeof res.me>>(invite.shop.id).catch(() => null);
      return { ...res, me: selling ?? res.me };
    },
    onSuccess: ({ me }, invite) => {
      // The fresh `me` has the shop in shops[] (and the count down by one).
      if (me) setUser(me);
      settle();
      toast.success(t("invitations.joined", { shop: invite.shop.name }));
    },
    onError: (err) => {
      settle();
      refresh().catch(() => undefined);
      toast.error(teamErrorMessage(err, tRoot));
    },
  });

  const decline = useMutation({
    mutationFn: (invite: MyShopInvite) => declineShopInvite(invite.token),
    onSuccess: () => {
      settle();
      refresh().catch(() => undefined);
      toast.success(t("invitations.declined"));
    },
    onError: (err) => {
      settle();
      toast.error(teamErrorMessage(err, tRoot));
    },
  });

  return { count, invites: count > 0 ? invites : [], accept, decline };
}
