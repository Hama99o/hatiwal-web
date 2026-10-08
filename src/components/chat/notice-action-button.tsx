"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { useSellingIdentity } from "@/components/shops/use-selling-identity";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/client";
import { getMyListing, setSellerMode } from "@/lib/api/me";
import { getPublicInvite } from "@/lib/api/shop-team";
import {
  GONE_INVITE,
  GONE_LISTING,
  isKnownNoticeAction,
  noticeActionPlan,
  noticeActionLabelKey,
  type NoticeAction,
} from "@/lib/notice-action";

const gone = (err: unknown) => err instanceof ApiError && [403, 404, 410].includes(err.status);

/**
 * The button under a tappable Support notice (owner, 2026-10-12), mobile's
 * NoticeActionButton: one outlined pill on the incoming side, right under the
 * bubble. Checks the target still exists (an invite still open, a listing
 * still the viewer's), enters Seller mode as the right identity for a shop or
 * listing, then opens it; a target that is gone is a friendly toast.
 */
export function NoticeActionButton({ action }: { action: NoticeAction | null | undefined }) {
  const t = useTranslations();
  const router = useRouter();
  const { user, setUser } = useAuth();
  const { shops, allShops, switchToAsync } = useSellingIdentity();
  const [pending, setPending] = useState(false);
  if (!isKnownNoticeAction(action)) return null;

  // Relabelled for the state NOW: "Under review" / "Verified ✓".
  const labelKey = noticeActionLabelKey(action);
  const label = labelKey && t.has(labelKey) ? t(labelKey) : t("chat.noticeAction.open");

  const open = async () => {
    const plan = noticeActionPlan(action, {
      memberShopIds: allShops.map((s) => s.id),
      activeShopIds: shops.map((s) => s.id),
    });
    if (plan.kind === "none") return;
    if (plan.kind === "gone") {
      toast.error(t(plan.messageKey));
      return;
    }
    setPending(true);
    try {
      if (plan.check && "invite" in plan.check) {
        // Expired, answered or cancelled: say so here. Any other error opens
        // the invite page, which has its own error state.
        const stillOpen = await getPublicInvite(plan.check.invite)
          .then((invite) => invite.status === "pending")
          .catch((err) => !gone(err));
        if (!stillOpen) return void toast.error(t(GONE_INVITE));
      }
      if (plan.check && "listing" in plan.check) {
        const mine = await getMyListing(plan.check.listing)
          .then(() => true)
          .catch((err) => !gone(err));
        if (!mine) return void toast.error(t(GONE_LISTING));
      }
      if (plan.sellerMode && user && !user.sellerMode) {
        const updated = await setSellerMode(true).catch(() => null);
        if (updated) setUser(updated);
      }
      if (plan.switchTo !== undefined) await switchToAsync(plan.switchTo);
      router.push(plan.path);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex justify-start">
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid={`notice-action-${action.type}`}
        aria-busy={pending}
        disabled={pending}
        onClick={open}
        className="h-9 gap-1.5 rounded-full border-primary text-primary hover:bg-primary/10 hover:text-primary"
      >
        {label}
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        )}
      </Button>
    </div>
  );
}
