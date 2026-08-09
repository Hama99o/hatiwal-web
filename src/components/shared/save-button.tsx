"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useIsOwner } from "@/components/auth/owner-gate";
import { getSavedListings, toggleSaved } from "@/lib/api/me";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * THE save/favorite heart — web port of mobile's card heart + detail save
 * action. Toggles optimistically via POST /listings/:id/save · DELETE
 * /listings/:id/unsave (through the /api/me proxy), reverts + toasts on error,
 * and invalidates ['saved-listings'] so /saved stays in sync everywhere.
 *
 * True saved-state: public/ISR listing payloads are fetched without auth, so
 * `isSaved` is unreliable there. When signed in we derive the state from the
 * shared ['saved-listings'] query (one cached fetch app-wide) and fall back to
 * `initialSaved`. Guests see the outline heart and are sent to /login on tap.
 */
export function SaveButton({
  listingId,
  initialSaved,
  ownerId,
  variant = "overlay",
  className,
}: {
  listingId: number;
  /** Seed from listing.isSaved when the payload has it (authed contexts). */
  initialSaved?: boolean;
  /** The listing's seller id — the heart hides on your own listing. */
  ownerId?: number;
  /**
   * `overlay` = round icon floating on a photo; `detail` = full-width labeled
   * button; `bar` = icon button with outline chrome, for a solid toolbar row
   * (the sticky `ListingActionBar`) where a translucent floating circle would
   * not match the buttons beside it.
   */
  variant?: "overlay" | "detail" | "bar";
  className?: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const { status } = useAuth();
  const isOwner = useIsOwner(ownerId);
  const queryClient = useQueryClient();
  const [override, setOverride] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const authed = status === "authed";

  // Shared saved-listings cache (same key + fn as the /saved page).
  const { data: savedListings } = useQuery({
    queryKey: ["saved-listings"],
    queryFn: getSavedListings,
    enabled: authed,
    staleTime: 60_000,
  });

  // Never offer save on your own listing.
  if (isOwner) return null;

  const serverSaved = savedListings
    ? savedListings.some((l) => l.id === listingId)
    : (initialSaved ?? false);
  const saved = override ?? serverSaved;
  const label = saved ? t("listing.detail.unsave") : t("listing.detail.save");

  async function onToggle(e: React.MouseEvent) {
    // The card heart sits inside a <Link> — never navigate.
    e.preventDefault();
    e.stopPropagation();
    if (status === "loading" || busy) return;
    if (!authed) {
      router.push("/login");
      return;
    }

    const wasSaved = saved;
    setOverride(!wasSaved); // optimistic fill/unfill
    setBusy(true);
    try {
      await toggleSaved(listingId, wasSaved);
      await queryClient.invalidateQueries({ queryKey: ["saved-listings"] });
    } catch {
      setOverride(wasSaved); // revert
      toast.error(t(wasSaved ? "saved.unsaveError" : "saved.saveError"));
    } finally {
      setBusy(false);
    }
  }

  if (variant === "detail") {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={onToggle}
        aria-pressed={saved}
        className={cn("w-full", className)}
      >
        <Heart
          className={cn(saved && "fill-destructive text-destructive")}
        />
        {label}
      </Button>
    );
  }

  // Icon-only chrome. `overlay` floats on a photo (round + translucent + blur so
  // the picture reads through); `bar` sits in a solid toolbar row, where it has to
  // look like a sibling of the outline buttons next to it, not a floating pill.
  const onPhoto = variant === "overlay";

  return (
    <Button
      type="button"
      variant={onPhoto ? "secondary" : "outline"}
      size="icon"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={saved}
      title={label}
      className={cn(
        // 40px minimum touch target (house convention — see segmented-control.tsx).
        "size-10 shrink-0",
        onPhoto &&
          "rounded-full bg-background/80 shadow-sm backdrop-blur-sm hover:bg-background",
        className,
      )}
    >
      <Heart
        className={cn(
          saved ? "fill-destructive text-destructive" : "text-foreground",
        )}
      />
    </Button>
  );
}
