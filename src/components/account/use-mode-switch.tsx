"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { describeApiError } from "@/lib/api/error-codes";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { setSellerMode } from "@/lib/api/me";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { InvitationRows } from "@/components/shops/shop-invitations";

export type Mode = "buyer" | "seller";

/**
 * Buyer ↔ Seller switching, shared by every control that offers it (the Profile
 * toggle and the header's account menu), so they cannot drift apart. Same rules
 * as mobile (Profile.tsx onModeToggle): persists `seller_mode` on the server,
 * lands on the matching home (Bazaar / My listings), and a user with no shop but
 * pending invitations sees the invitations first.
 *
 * Render `dialog` once wherever the hook is used.
 */
export function useModeSwitch() {
  const t = useTranslations();
  const router = useRouter();
  const { user, setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [invitesOpen, setInvitesOpen] = useState(false);
  const invitesTitleId = useId();

  const seller = !!user?.sellerMode;
  const hasShop = (user?.shops ?? []).some((s) => s.status === "active");
  const pendingInvites = user?.pendingShopInvitesCount ?? 0;

  async function switchTo(value: boolean) {
    if (!user || value === seller || busy) return;
    setBusy(true);
    try {
      const updated = await setSellerMode(value);
      setUser(updated);
      router.push(value ? "/my-listings" : "/bazaar");
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  }

  /** Pick a mode; Seller with no shop but invitations opens the invitations first. */
  function select(mode: Mode) {
    if (mode === "seller" && !hasShop && pendingInvites > 0) setInvitesOpen(true);
    else switchTo(mode === "seller");
  }

  const dialog = (
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
  );

  return { seller, busy, hasShop, pendingInvites, select, dialog };
}
