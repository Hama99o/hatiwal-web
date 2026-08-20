"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { useIsOwner } from "@/components/auth/owner-gate";
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
  const { status } = useAuth();
  const isOwner = useIsOwner(ownerId);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (status !== "authed" || isOwner || hidden) return null;

  async function onClick() {
    setBusy(true);
    try {
      await hideListing(listingId);
      setHidden(true);
      // The buyer came here FROM the feed and will go straight back to it, well
      // inside the 60s staleTime — so the cached page would still hold the
      // listing they just dismissed and the promise would visibly not have been
      // kept. Drop both the feed (it is now fetched as the viewer, so Rails
      // filters this listing out) and the management list it just joined.
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["hidden-listings"] });
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
