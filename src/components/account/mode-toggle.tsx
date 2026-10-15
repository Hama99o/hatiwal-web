"use client";

import { useTranslations } from "next-intl";
import { ShoppingBag, Store } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { useModeSwitch, type Mode } from "./use-mode-switch";

/**
 * Buyer ↔ Seller mode toggle (mobile parity) on Profile. The switching itself
 * (persist `sellerMode`, land on the matching home, invitations first) lives in
 * `useModeSwitch`, shared with the header's account menu.
 */
export function ModeToggle({ className }: { className?: string }) {
  const t = useTranslations();
  const { user } = useAuth();
  const { seller, busy, hasShop, pendingInvites, select, dialog } = useModeSwitch();

  if (!user) return null;
  // SHOP-1 "Nothing gets missed": in Buyer mode, a dot on the Seller side when a
  // shop owner has unread SELLER messages (as Me or any shop). Never without a shop.
  const counts = user.unreadCounts;
  const sellerUnread = counts ? counts.sellingMe + Object.values(counts.shops).reduce((a, b) => a + b, 0) : 0;
  const showSellerDot = !seller && hasShop && sellerUnread > 0;
  // Owner, 1.1.6: a pending invitation to join a shop, shown on the Seller
  // side even for someone with no shop yet.
  const showInvitesDot = !seller && pendingInvites > 0 && !showSellerDot;

  return (
    <div className="relative">
    <SegmentedControl<Mode>
      className={className}
      fullWidth
      disabled={busy}
      ariaLabel={t("profile.modeToggleLabel")}
      value={seller ? "seller" : "buyer"}
      onChange={select}
      options={[
        { value: "buyer", label: t("profile.buyerMode"), icon: ShoppingBag },
        { value: "seller", label: t("profile.sellerMode"), icon: Store },
      ]}
    />
      {showSellerDot && (
        <span
          data-testid="seller-messages-dot"
          aria-label={t("shops.newSellerMessages")}
          className="absolute end-2 top-1.5 size-2.5 rounded-full border-2 border-card bg-destructive"
        />
      )}
      {showInvitesDot && (
        <span
          data-testid="mode-toggle-invites-dot"
          aria-label={t("shops.invitations.title")}
          className="absolute end-2 top-1.5 size-2.5 rounded-full border-2 border-card bg-destructive"
        />
      )}
      {dialog}
    </div>
  );
}
