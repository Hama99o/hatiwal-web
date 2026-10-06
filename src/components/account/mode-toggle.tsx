"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { ShoppingBag, Store } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { setSellerMode } from "@/lib/api/me";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { InvitationRows } from "@/components/shops/shop-invitations";

type Mode = "buyer" | "seller";

/**
 * Buyer ↔ Seller mode toggle (mobile parity). Persists `sellerMode` to the
 * backend and, like the app, drops you into the matching home — browse for
 * buyers, the listings dashboard for sellers. The header nav reads the same
 * `user.sellerMode` to emphasise the right actions.
 */
export function ModeToggle({ className }: { className?: string }) {
  const t = useTranslations();
  const router = useRouter();
  const { user, setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [invitesOpen, setInvitesOpen] = useState(false);
  const invitesTitleId = useId();

  if (!user) return null;
  const seller = user.sellerMode;
  // SHOP-1 "Nothing gets missed": in Buyer mode, a dot on the Seller side when a
  // shop owner has unread SELLER messages (as Me or any shop). Never without a shop.
  const counts = user.unreadCounts;
  const hasShop = (user.shops ?? []).some((s) => s.status === "active");
  const sellerUnread = counts ? counts.sellingMe + Object.values(counts.shops).reduce((a, b) => a + b, 0) : 0;
  const showSellerDot = !seller && hasShop && sellerUnread > 0;
  // Owner, 1.1.6: a pending invitation to join a shop, shown on the Seller
  // side even for someone with no shop yet.
  const pendingInvites = user.pendingShopInvitesCount ?? 0;
  const showInvitesDot = !seller && pendingInvites > 0 && !showSellerDot;

  async function switchTo(value: boolean) {
    if (value === seller || busy) return;
    setBusy(true);
    try {
      const updated = await setSellerMode(value);
      setUser(updated);
      router.push(value ? "/my-listings" : "/bazaar");
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
    <SegmentedControl<Mode>
      className={className}
      fullWidth
      disabled={busy}
      ariaLabel={t("profile.modeToggleLabel")}
      value={seller ? "seller" : "buyer"}
      onChange={(mode) => {
        // No shop yet, but invited: the invitations come first (a small
        // dialog), then Seller mode. With a shop they are in the Sell-as menu.
        if (mode === "seller" && !hasShop && pendingInvites > 0) setInvitesOpen(true);
        else switchTo(mode === "seller");
      }}
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
      <Dialog open={invitesOpen} onClose={() => setInvitesOpen(false)} labelledBy={invitesTitleId} className="max-w-md">
        <div className="space-y-3 p-5" data-testid="invitations-sheet">
          <h2 id={invitesTitleId} className="text-lg font-extrabold">
            {t("shops.invitations.title")}
          </h2>
          <InvitationRows />
          <Button
            className="w-full"
            variant="outline"
            onClick={() => {
              setInvitesOpen(false);
              switchTo(true);
            }}
            data-testid="invitations-continue-seller"
          >
            {t("shops.invitations.continueSeller")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
