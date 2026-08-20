"use client";

import { Heart, Loader2 } from "lucide-react";
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
import { useLoginHref } from "@/components/auth/login-href";
import { useIsOwner, useServerViewerId } from "@/components/auth/owner-gate";
import { getSavedListings, toggleSaved } from "@/lib/api/me";
import { Button } from "@/components/ui/button";
import { unsettledProps, useQueuedTap } from "@/lib/unsettled";
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
 * `isSaved` is `false` there whatever the viewer has actually saved. When signed
 * in we derive the state from the shared ['saved-listings'] query (one cached
 * fetch app-wide) and fall back to `initialSaved`. Guests see the outline heart
 * and are sent to /login on tap.
 *
 * INDETERMINATE, not "not saved" (see `unknown` below): until BOTH the session
 * probe and that shared list have landed, this button does not know the answer
 * and says so — muted glyph, `aria-busy`, no `aria-pressed` — instead of painting
 * the outline heart and claiming a state it has not confirmed. A tap in that
 * window is remembered and replayed once the truth arrives, so it can never send
 * `POST save` for a listing that was already saved. The exception is a page that
 * already published the server's answer (`useServerViewerId()` → `null`): a
 * guest's heart needs no probe, so it renders settled on the first frame.
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
  /**
   * Seed from listing.isSaved. Every listing view carries the field (`:list`
   * too, since TASK-BE-SAVEDLIST) — but a payload fetched WITHOUT a bearer
   * reports `false` for a listing the viewer really has saved, so only `true`
   * is believed. See `trusted`.
   */
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
  const loginHref = useLoginHref();
  const { status, user, probeTimedOut } = useAuth();
  const isOwner = useIsOwner(ownerId);
  // What the SERVER already knew about this viewer (see `useServerViewerId`).
  // `null` = the request carried no session at all, which the browser cannot
  // contradict, so a guest's heart is knowable from the first paint instead of
  // announcing itself pending for a probe whose answer is already in this tree.
  const serverViewerId = useServerViewerId();
  const serverGuest = serverViewerId === null;
  // ...and `undefined` = no page published a hint at all. This heart is the ONE
  // control of the unsettled trio that renders on such pages — every ListingCard
  // on `/`, `/bazaar` and `/categories/*` is ISR, which cannot read cookies — so
  // it is also the only one that can wait on a probe with no fallback answer in
  // the tree. If that probe never answers (a hung socket never rejects, so the
  // retry loop in auth-provider.tsx never runs), the heart would announce itself
  // pending forever. After the probe's budget it stops waiting and reads
  // `initialSaved` like a guest; a tap then goes to `/login?next=` — the ONE path
  // by which a signed-in viewer can still be sent to sign in, which is why it
  // carries `next` (login-form.tsx bounces an already-authed visitor straight
  // back, so they land where they were rather than on /profile).
  //
  // Why the tap is not simply HELD until the probe answers, which would avoid
  // that trip entirely: on a hint-less page the two viewers are provably
  // indistinguishable in the browser. `hatiwal_viewer_id` is httpOnly
  // (lib/auth/cookies.ts), so page JS cannot tell "signed in, probe hung" from
  // "guest, probe hung" — and holding forever is exactly the dead control the
  // budget exists to prevent (e2e/saved.spec.ts pins that a guest whose probe
  // never answers can still reach /login from this heart). So the budget keeps its
  // release, and the release was made recoverable instead. Only ever with NO
  // hint: a viewer the server said is signed in must never be demoted this way,
  // and one the server said is a guest was never waiting.
  const probeGaveUp = serverViewerId === undefined && probeTimedOut;
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

  // Only trust the cached list while signed in. (The cache itself is now cleared
  // at every auth transition in auth-provider.tsx, so it can no longer hold a
  // previous session's rows — this guard is just correctness for the guest case.)
  const serverSaved =
    authed && savedListings
      ? savedListings.some((l) => l.id === listingId)
      : (initialSaved ?? false);
  const flip = authed ? flips[listingId] : undefined;
  const saved = flip ?? serverSaved;

  // ── Do we actually KNOW the saved state? ──────────────────────────────────
  // On a cold load the answer is two SEQUENTIAL round-trips away:
  // /api/auth/session (who is this?) then /api/me/my/saved_listings (what have
  // they saved?). `initialSaved` cannot bridge that gap on every surface: an
  // ANONYMOUS listing payload (see lib/api/client.ts — SSR seeds, the home rail,
  // the category hubs) reports `isSaved: false` for a listing the viewer saved
  // months ago. Only `true` is trustworthy: nothing but an authed payload can
  // produce it. So `trusted` is a shortcut that a payload may or may not offer —
  // never a replacement for ['saved-listings'], which is the only source EVERY
  // heart has. Do not "simplify" this to `initialSaved ?? false`.
  //
  // Which payloads can offer it: any view fetched WITH a bearer. That is the
  // serializer's `:detailed` view on a listing page, and — since
  // TASK-BE-SAVEDLIST added `is_saved` to `view :list` — the personalised feed
  // too, whenever the browser routed it through /api/me (`getListingsAsViewer`
  // in lib/api/listings.ts). A card on an ISR surface (`/`, `/categories/*`, the
  // Bazaar's SSR seed) is still fetched anonymously and still says `false`, so
  // those hearts remain `unknown` until ['saved-listings'] lands — which is
  // exactly what the muted/`aria-busy` state below is for.
  //
  // Painting the outline heart meanwhile is a lie the buyer acts on. They tap to
  // save something already saved — server-side a no-op (the controller uses
  // find_or_create_by!), so visibly NOTHING happens — or they mean to unsave and
  // spend the first tap flipping the wrong way. The sticky <ListingActionBar>
  // makes it maximally visible: the heart is pinned from the first paint as one
  // of only three things in the bar.
  const trusted = initialSaved === true;
  // ── Do we know WHO this is? ───────────────────────────────────────────────
  // Named separately from `resolving`/`unknown` because it governs something
  // else: whether a tap may be honoured at all. Any tap taken while this is true
  // has to be held, even when the heart itself looks settled for another reason
  // (a `trusted` payload, an existing optimistic flip) — otherwise `run()` reads
  // `status === "loading"` as "guest" and pushes a signed-in buyer to /login,
  // which is the defect this whole line of work exists to prevent.
  //
  // `status === "loading"` is NOT unresolved when the page already published
  // "this request had no session": a guest's heart then reads `initialSaved` and
  // is final, so the whole action column stops painting itself busy on the first
  // frame of every search visit (measured: 5 `aria-busy="true"` in the guest SSR
  // HTML of a listing page — this heart, the bar's, and the 3 cross-sell hearts).
  // And it stops being unresolved once the budget is spent (`probeGaveUp`), which
  // is the hint-less fallback documented above — the one case where /login is the
  // honest answer because nothing else can be known.
  const identityUnresolved =
    status === "loading" && !serverGuest && !probeGaveUp;
  const resolving = identityUnresolved || (authed && savedQuery.isPending);
  // The list request failed. We still don't know — and silently claiming "not
  // saved" forever, with no toast and no retry, is the same lie with no way out.
  const failed = authed && savedQuery.isError;
  const unknown = flip === undefined && !trusted && (resolving || failed);

  // Replay a queued tap the moment the truth lands — with the RESOLVED value, so
  // a tap during bootstrap can never assume "not saved" OR "not signed in".
  // Guests (a bootstrap that resolves to no session) get the /login push they
  // would have got. Shared with the message CTA beside it (see lib/unsettled.ts).
  //
  // `identityUnresolved` is part of `pending` in its own right, not folded into
  // `unknown`: `unknown` also answers "is it saved?", which a `trusted` payload or
  // an existing flip can settle on its own while the viewer is still anonymous to
  // us. Releasing on `unknown` alone therefore ran this callback with `status`
  // still "loading", read `!authed` as guest, and pushed a signed-in buyer to
  // /login (reproduced with a held probe + a tap on a feed heart).
  const { queued, queue, release } = useQueuedTap(
    identityUnresolved || unknown || toggle.isPending,
    () => {
      if (!authed) {
        router.push(loginHref());
        return;
      }
      toggle.mutate(saved);
    },
  );
  // A tap is in flight, or accepted and waiting for `unknown` to clear.
  const busy = toggle.isPending || queued;

  // Never offer save on your own listing.
  if (isOwner) return null;

  const label = saved ? t("listing.detail.unsave") : t("listing.detail.save");

  async function onToggle(e: React.MouseEvent) {
    // The card heart sits inside a <Link> — never navigate.
    e.preventDefault();
    e.stopPropagation();
    // Already working on one; the heart says so (spinner + aria-disabled) rather
    // than swallowing the tap in silence.
    if (busy) return;
    // Either half unknown is enough to hold the tap: WHAT the state is, or WHOSE
    // it is. The second one is why this is not just `unknown` — see `useQueuedTap`
    // above.
    if (unknown || identityUnresolved) {
      // Don't guess — remember the tap and let `useQueuedTap` run it against the
      // resolved value.
      queue();
      if (failed) {
        // Nothing is coming unless we ask again. If the retry also fails, say so
        // and release the tap instead of pulsing forever.
        const result = await savedQuery.refetch();
        if (result.isError) {
          release();
          toast.error(t("saved.saveError"));
        }
      }
      return;
    }
    if (!authed) {
      router.push(loginHref());
      return;
    }
    toggle.mutate(saved);
  }

  // Unsettled ARIA, from the one shared implementation the message CTA and the
  // Report trigger beside it use (lib/unsettled.ts). `aria-disabled`, not
  // `disabled` — the button stays focusable and the tap is queued, not dropped.
  const stateProps = {
    ...unsettledProps({ unknown: unknown || identityUnresolved, busy }),
    // Never announce a pressed state we have not confirmed.
    "aria-pressed": unknown ? undefined : saved,
  } as const;
  // The two visible cues, and neither one touches opacity (that module has the
  // contrast numbers; `opacity-70` measured 2.47–2.64:1 against WCAG's 3:1
  // non-text floor, and `animate-pulse` troughs lower still):
  //  - COLOUR while the answer is unknown — held, not repainted, because an
  //    unknown state must not claim the empty heart of "not saved";
  //  - GLYPH once a tap is HELD — `Loader2` in place of the heart. A swap is
  //    visible with `prefers-reduced-motion` (where a pulse renders nothing at
  //    all), costs no contrast, and is the same 16/20px box, so nothing reflows.
  //    Only while QUEUED: an in-flight mutation already shows its own cue, the
  //    optimistically flipped heart, which a spinner would hide.
  const heartClass = unknown
    ? "text-muted-foreground"
    : saved
      ? "fill-destructive text-destructive"
      : undefined;
  // `restColor` is what the heart inherits when it carries no state colour of its
  // own: nothing for the labelled `detail` button (it takes the label's), an
  // explicit `text-foreground` for the icon-only chrome.
  const glyph = (restColor?: string) =>
    queued ? (
      <Loader2 className="animate-spin text-muted-foreground" />
    ) : (
      <Heart className={cn(heartClass ?? restColor)} />
    );

  if (variant === "detail") {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={onToggle}
        {...stateProps}
        className={cn("w-full", className)}
      >
        {glyph()}
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
        "shrink-0",
        // 40px is the house minimum for chrome a mouse can reach (see
        // segmented-control.tsx). The sticky bar is `lg:hidden` — the one
        // touch-only surface on the site, and this heart sits 12px from the screen
        // edge — so there it takes the 44px floor docs/DESIGN_SYSTEM.md mandates,
        // matching the CTA beside it. The bar's spacer is ResizeObserver-measured,
        // so it follows on its own.
        //
        // The GLYPH grows with it there, and only there: `ui/button.tsx` forces
        // `[&_svg]:size-4`, so the bar's heart was a 16px mark inside a 44px box
        // beside a `text-lg font-bold` price and a filled 44px CTA — the second
        // most important action on the site's one touch-only surface reading
        // lighter than its target implies. The card overlay keeps 16px: it floats
        // on a photo at 40px and its convention is shared with every feed.
        variant === "bar" ? "size-11 [&_svg]:size-5" : "size-10",
        onPhoto &&
          "rounded-full bg-background/80 shadow-sm backdrop-blur-sm hover:bg-background",
        className,
      )}
    >
      {glyph("text-foreground")}
    </Button>
  );
}
