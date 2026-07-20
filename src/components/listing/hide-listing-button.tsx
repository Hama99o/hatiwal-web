"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { hideListing } from "@/lib/api/hidden-listings";

/**
 * "Not interested" — hides a listing from the buyer's own Browse feed (mobile
 * parity). Only shown to an authed buyer who isn't the owner. After hiding it
 * removes itself; the listing can be restored from the Hidden Listings screen.
 */
export function HideListingButton({
  listingId,
  ownerId,
}: {
  listingId: number;
  ownerId?: number;
}) {
  const t = useTranslations("hidden");
  const { status, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);

  const isOwner = ownerId != null && user?.id === ownerId;
  if (status !== "authed" || isOwner || hidden) return null;

  async function onClick() {
    setBusy(true);
    try {
      await hideListing(listingId);
      setHidden(true);
      toast.success(t("hiddenUndo"));
    } catch {
      toast.error(t("hideError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <EyeOff className="size-4" />
      )}
      {t("notInterested")}
    </button>
  );
}
