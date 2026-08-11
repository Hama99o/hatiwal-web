"use client";

import { useEffect, useState } from "react";
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
 * INDETERMINATE, not "not saved" (see `unknown` below): until BOTH the session
 * probe and that shared list have landed, this button does not know the answer
 * and says so — dimmed heart, `aria-busy`, no `aria-pressed` — instead of
 * painting the outline heart and calling it "Save listing". A tap in that window
 * is remembered and replayed once the truth arrives, so it can never send
 * `POST save` for a listing that was already saved.
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
  const savedQuery = useQuery({
    queryKey: SAVED_LISTINGS_KEY,
    queryFn: getSavedListings,
    enabled: authed,
    staleTime: 60_000,
  });
  const savedListings = savedQuery.data;

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

  // A tap taken while the state was still `unknown`, waiting for the truth.
  const [queued, setQueued] = useState(false);

  // A guest's cache may still hold the previous session's list (logout doesn't
  // clear it), so only trust it while signed in.
  const serverSaved =
    authed && savedListings
      ? savedListings.some((l) => l.id === listingId)
      : (initialSaved ?? false);
  const flip = authed ? flips[listingId] : undefined;
  const saved = flip ?? serverSaved;

  // ── Do we actually KNOW the saved state? ──────────────────────────────────
  // On a cold load the answer is two SEQUENTIAL round-trips away:
  // /api/auth/session (who is this?) then /api/me/my/saved_listings (what have
  // they saved?). `initialSaved` cannot bridge that gap — every public listing
  // payload on this site is fetched anonymously (see lib/api/client.ts), so
  // `isSaved` comes back false for a listing the viewer saved months ago. Only
  // `true` is trustworthy there: nothing but an authed payload can produce it.
  //
  // Painting the outline heart meanwhile is a lie the buyer acts on. They tap to
  // save something already saved — server-side a no-op (the controller uses
  // find_or_create_by!), so visibly NOTHING happens — or they mean to unsave and
  // spend the first tap flipping the wrong way. The sticky <ListingActionBar>
  // makes it maximally visible: the heart is pinned from the first paint as one
  // of only three things in the bar.
  const trusted = initialSaved === true;
  const resolving = status === "loading" || (authed && savedQuery.isPending);
  // The list request failed. We still don't know — and silently claiming "not
  // saved" forever, with no toast and no retry, is the same lie with no way out.
  const failed = authed && savedQuery.isError;
  const unknown = flip === undefined && !trusted && (resolving || failed);
  // A tap is in flight, or accepted and waiting for `unknown` to clear.
  const busy = toggle.isPending || queued;

  // Replay a queued tap the moment the truth lands — with the RESOLVED value, so
  // a tap during bootstrap can never assume "not saved". Guests (a bootstrap
  // that resolves to no session) get the /login push they would have got.
  const { mutate: runToggle } = toggle;
  useEffect(() => {
    if (!queued || unknown || toggle.isPending) return;
    setQueued(false);
    if (!authed) {
      router.push("/login");
      return;
    }
    runToggle(saved);
  }, [queued, unknown, toggle.isPending, authed, saved, runToggle, router]);

  // Never offer save on your own listing.
  if (isOwner) return null;

  const label = saved ? t("listing.detail.unsave") : t("listing.detail.save");

  async function onToggle(e: React.MouseEvent) {
    // The card heart sits inside a <Link> — never navigate.
    e.preventDefault();
    e.stopPropagation();
    // Already working on one; the heart says so (dimmed + aria-disabled) rather
    // than swallowing the tap in silence.
    if (busy) return;
    if (unknown) {
      // Don't guess — remember the tap and let the effect above run it against
      // the resolved value.
      setQueued(true);
      if (failed) {
        // Nothing is coming unless we ask again. If the retry also fails, say so
        // and release the tap instead of pulsing forever.
        const result = await savedQuery.refetch();
        if (result.isError) {
          setQueued(false);
          toast.error(t("saved.saveError"));
        }
      }
      return;
    }
    if (!authed) {
      router.push("/login");
      return;
    }
    toggle.mutate(saved);
  }

  // Unsettled chrome: the control must never render byte-identical to its ready
  // state while it cannot honour a tap immediately. `aria-disabled`, not
  // `disabled` — the button stays focusable, and the tap is queued, not dropped.
  const stateProps = {
    "aria-busy": unknown || busy || undefined,
    "aria-disabled": busy || undefined,
    // Never announce a pressed state we have not confirmed.
    "aria-pressed": unknown ? undefined : saved,
  } as const;
  const unsettledClass = cn(
    (unknown || busy) && "opacity-70",
    // A tap we have accepted but cannot run yet needs an "I heard you" cue; the
    // in-flight case already has one (the heart flipped optimistically).
    queued && "animate-pulse motion-reduce:animate-none",
  );
  // Held, not repainted: an unknown state must not claim the empty heart of
  // "not saved", so it goes muted until the answer arrives.
  const heartClass = unknown
    ? "text-muted-foreground"
    : saved
      ? "fill-destructive text-destructive"
      : undefined;

  if (variant === "detail") {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={onToggle}
        {...stateProps}
        className={cn("w-full", unsettledClass, className)}
      >
        <Heart className={heartClass} />
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
      title={label}
      {...stateProps}
      className={cn(
        // 40px minimum touch target (house convention — see segmented-control.tsx).
        "size-10 shrink-0",
        onPhoto &&
          "rounded-full bg-background/80 shadow-sm backdrop-blur-sm hover:bg-background",
        unsettledClass,
        className,
      )}
    >
      <Heart className={cn(heartClass ?? "text-foreground")} />
    </Button>
  );
}
