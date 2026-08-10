"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useIsOwner } from "@/components/auth/owner-gate";
import { getSavedListings, toggleSaved } from "@/lib/api/me";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Listing } from "@/lib/types";

/** The list the /saved page renders — also the server truth for every heart. */
const SAVED_LISTINGS_KEY: QueryKey = ["saved-listings"];

/** listingId → optimistic saved flag, for saves the server hasn't confirmed. */
type SavedFlips = Record<number, boolean>;
const NO_FLIPS: SavedFlips = {};

/**
 * Cache key for the flip map. Scoped by viewer because logging out does not
 * clear the query cache, and one buyer's optimistic hearts must never show up
 * for the next person to sign in on the same tab.
 */
function savedFlipsKey(userId?: number): QueryKey {
  return ["saved-flips", userId ?? null];
}

/** Write (or, with `undefined`, drop) ONE listing's flip, leaving the rest. */
function writeFlip(
  qc: QueryClient,
  key: QueryKey,
  listingId: number,
  value: boolean | undefined,
) {
  qc.setQueryData<SavedFlips>(key, (old) => {
    const next = { ...(old ?? NO_FLIPS) };
    if (value === undefined) delete next[listingId];
    else next[listingId] = value;
    return next;
  });
}

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
 *
 * SHARED optimistic state (not component state): the listing detail page mounts
 * TWO hearts for the same listing — the inline one and the sticky
 * <ListingActionBar>'s — and the bar is hidden with CSS, never unmounted, so
 * both live for the whole page. With a per-instance `override` they diverged
 * permanently: unsave from the inline heart and the bar's stayed filled, then
 * its next tap sent DELETE for an already-unsaved listing. So the flip lives in
 * one cache entry (see `savedFlipsKey`) that every heart for that listing reads,
 * exactly like the optimistic list writes in <ConversationsView>.
 *
 * (Why a flip map and not a write into ['saved-listings'] itself: removing on
 * unsave would work, but ADDING needs a whole Listing, which the id-only call
 * sites don't have — a stub would render as a broken card on /saved.)
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
  const { status, user } = useAuth();
  const isOwner = useIsOwner(ownerId);
  const queryClient = useQueryClient();

  const authed = status === "authed";
  const flipsKey = savedFlipsKey(user?.id);

  // Shared saved-listings cache (same key + fn as the /saved page).
  const { data: savedListings } = useQuery({
    queryKey: SAVED_LISTINGS_KEY,
    queryFn: getSavedListings,
    enabled: authed,
    staleTime: 60_000,
  });

  // Client-only store, never fetched: `initialData` + an infinite `staleTime`
  // mean this query has data from the first render and never runs its queryFn;
  // `setQueryData` on the key re-renders every heart subscribed to it.
  const { data: flips } = useQuery<SavedFlips>({
    queryKey: flipsKey,
    queryFn: () => NO_FLIPS,
    initialData: NO_FLIPS,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const toggle = useMutation({
    mutationFn: (wasSaved: boolean) => toggleSaved(listingId, wasSaved),
    onMutate: (wasSaved) => {
      const previous = queryClient.getQueryData<SavedFlips>(flipsKey) ?? NO_FLIPS;
      writeFlip(queryClient, flipsKey, listingId, !wasSaved);
      // Only this listing's entry, so a rollback can't undo another heart's flip.
      return { previous: previous[listingId] };
    },
    onError: (_err, wasSaved, ctx) => {
      writeFlip(queryClient, flipsKey, listingId, ctx?.previous);
      toast.error(t(wasSaved ? "saved.unsaveError" : "saved.saveError"));
    },
    onSuccess: async (_data, wasSaved) => {
      // `invalidateQueries` resolves once the refetch has landed, so we can hand
      // the truth back to the server list and drop the flip — a flip left in
      // place forever would outvote a change made on another device. If the
      // refetch failed (or nothing is observing the list, so it was only marked
      // stale) the list still disagrees and the flip stays as the local truth.
      await queryClient.invalidateQueries({ queryKey: SAVED_LISTINGS_KEY });
      const list = queryClient.getQueryData<Listing[]>(SAVED_LISTINGS_KEY);
      const listSaved = list?.some((l) => l.id === listingId);
      if (listSaved === !wasSaved) {
        writeFlip(queryClient, flipsKey, listingId, undefined);
      }
    },
  });

  // Never offer save on your own listing.
  if (isOwner) return null;

  // A guest's cache may still hold the previous session's list (logout doesn't
  // clear it), so only trust it while signed in.
  const serverSaved =
    authed && savedListings
      ? savedListings.some((l) => l.id === listingId)
      : (initialSaved ?? false);
  const saved = (authed ? flips[listingId] : undefined) ?? serverSaved;
  const label = saved ? t("listing.detail.unsave") : t("listing.detail.save");

  function onToggle(e: React.MouseEvent) {
    // The card heart sits inside a <Link> — never navigate.
    e.preventDefault();
    e.stopPropagation();
    if (status === "loading" || toggle.isPending) return;
    if (!authed) {
      router.push("/login");
      return;
    }
    toggle.mutate(saved);
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
