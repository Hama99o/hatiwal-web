"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { MessageSquare, Pencil, SlidersHorizontal } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useIsOwner } from "@/components/auth/owner-gate";
import {
  LIFECYCLE,
  LifecycleDialogs,
  actionsFor,
  useListingLifecycle,
} from "@/components/account/listing-actions";
import { ReviewPromptDialog } from "@/components/shared/review-prompt-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { CountBadge } from "@/components/shared/count-badge";
import {
  ExpiryBadge,
  listingExpiryState,
} from "@/components/shared/expiry-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ListingStatus, Transaction } from "@/lib/types";

/**
 * Every button in the panel, so the row can never clip a translation.
 *
 * `h-auto min-h-10 whitespace-normal` is the house treatment for exactly this
 * problem (see `account/seller-listing-actions.tsx`): the 40px tap target is a
 * FLOOR, and a label longer than its box wraps and grows the button instead of
 * being eaten by `truncate`. The `truncate` this replaced only ever hid the
 * defect — measured on fa, "مشاهده گفتگوها" needs ~184px of button, so between
 * ~392px and ~480px of viewport (where `min-w-40 flex-1` splits the panel 2-up
 * at ~150px a cell) the pill-bearing Chats label rendered as "مشاهده گفت…" and
 * the verb disappeared.
 *
 * `min-w-40` (not `min-w-0`) keeps the wrap-or-stack decision coarse: the row
 * drops to two full-width buttons rather than splitting into a pair of two-line
 * stubs. That means the panel is four stacked buttons at <=375px and two rows of
 * two from ~392px up, which is DELIBERATE — pairing at every width would put the
 * primary in a half-width box on the narrowest phones, and the primary is the
 * one control here that has to be able to out-shout the rest. Lowering the floor
 * to pair at 375px too is the wrong trade; if the four-stack ever needs
 * shortening, demote Chats to a link row (it is navigation, not an action).
 */
const ROW_BUTTON = "h-auto min-h-10 min-w-40 flex-1 whitespace-normal py-2";

/**
 * OwnerListingBar — what the SELLER sees on the public detail page of their own
 * listing.
 *
 * Every buyer control on `/listings/[id]` self-hides for the owner
 * (`StartConversationButton`, `SellerPhoneReveal`, `SaveButton`,
 * `HideListingButton`, `ReportButton` all return `null`), and an ACTIVE listing
 * never reaches the "unavailable" notice branch — so a seller opening their own
 * listing (own share link, Google, a category page, the similar rail) used to get
 * an empty action column. This is the owner's column: it says whose listing it is,
 * where it stands in the lifecycle, and lets them act on it.
 *
 * Renders NOTHING unless the viewer is this listing's seller, so buyers and guests
 * see the page exactly as before.
 *
 * The panel's first button is the listing's most likely next transition, resolved
 * by the SHARED seller lifecycle brain (`actionsFor` + `useListingLifecycle` +
 * `LifecycleDialogs` in `components/account/listing-actions.tsx` — the same one
 * behind `/my-listings` and the manage screen, so the copy, the prompts, the
 * buyer picker and the review prompt can never drift, and web offers the same
 * next step mobile does). That matters most for the statuses this panel would
 * otherwise name without being able to fix: an expired listing showed the red
 * "Expired" pill and then offered only navigation, and an expiring one still
 * does unless Renew comes along for the ride (see `showRenew` below). The
 * remaining transitions, delete and the views chart stay on `ManageListingView`
 * (`/my-listings/[id]`), which the Manage button links to.
 *
 * It deliberately carries NO view/save counts: the page's meta row already shows
 * both to every viewer, owner included, so repeating them here would print the
 * same two numbers twice in one column. The chat count is the exception —
 * nothing else on this page carries it, and "3 buyers are waiting on you" is the
 * one number that should pull a seller into the app. It is hidden at zero, like
 * every other count badge in the app.
 *
 * Styled as a primary-tinted panel (the seller-mode treatment from `ListingForm`)
 * instead of the page's neutral `bg-card`, so it reads as "your controls" rather
 * than one more information card beside location and seller.
 *
 * Client component (the page is a Server Component) because ownership is decided
 * from the session — the SSR fetch is an anonymous request. The page supplies the
 * server-side viewer hint (`ViewerIdProvider`), so for the owner this panel is in
 * the very first paint instead of arriving after the session probe.
 */
export function OwnerListingBar({
  listingId,
  sellerId,
  status,
  expiresAt,
  expired,
  conversationsCount,
  className,
}: {
  listingId: number;
  /** The listing's seller. Undefined (seller not on the payload) → never owner. */
  sellerId?: number;
  status: ListingStatus;
  expiresAt?: string | null;
  expired?: boolean;
  /** Threads opened on this listing (`conversationsCount`, already on the payload). */
  conversationsCount?: number;
  className?: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const noticeId = useId();
  const isOwner = useIsOwner(sellerId);
  // A sale that identified a real buyer invites the seller to rate them (REV2),
  // exactly as on the manage screen. Held here rather than inside the dialogs so
  // it outlives the transition that produced it.
  const [reviewTxn, setReviewTxn] = useState<Transaction | null>(null);
  const lifecycle = useListingLifecycle(listingId, {
    onSaleRecorded: setReviewTxn,
    // This page is SERVER-rendered from an anonymous fetch, so invalidating the
    // React Query caches cannot repaint it: without re-running the RSC the panel
    // would keep showing the old status (and the buyer CTAs the server already
    // decided on) until a manual reload.
    onChanged: () => router.refresh(),
  });
  const { busy, ask } = lifecycle;
  if (!isOwner) return null;

  // The panel and its expiry pill must never disagree: an active listing that is
  // past its run is "Expired", full stop — printing "Active" beside it (the old
  // behaviour, since Rails keeps `status: active` until a renew) reads as a bug
  // and hides the one thing the owner has to act on.
  const expiry = listingExpiryState({ status, expiresAt, expired });
  const isLive = status === "active" && expiry.kind !== "expired";
  // draft→Publish · active→Mark as Reserved · lapsed→Renew · reserved→Mark as
  // Sold · sold→nothing (terminal). `actionsFor` derives "lapsed" from the SAME
  // shared rule as the badge above (it takes the listing, not a flag), so the
  // pill and the button always tell the same story — on every seller surface,
  // not just here.
  const { primary, secondary } = actionsFor({ status, expiresAt, expired });
  const PrimaryIcon = primary ? LIFECYCLE[primary].Icon : null;
  // The amber pill says "Expires tomorrow" / "Expires in 3 days", and the fix is
  // Renew — which for a not-yet-lapsed listing sits in `secondary`, i.e. behind
  // a navigation to the manage screen. A panel that states urgency has to be able
  // to answer it, so Renew joins the action row for the "soon" window (it stays
  // the PRIMARY once the listing has actually lapsed — that is `actionsFor`'s
  // call, and this must not second-guess it, hence the `secondary` membership
  // test rather than a status test).
  const showRenew = expiry.kind === "soon" && secondary.includes("renew");
  const RenewIcon = LIFECYCLE.renew.Icon;

  return (
    // The shared card surface (`ui/card.tsx`) with the tint on top, rather than a
    // fourth hand-rolled `rounded-lg border …` recipe in this column — `asChild`
    // so it is still a real <section>, i.e. a named landmark a screen-reader user
    // can jump to.
    <Card
      asChild
      className={cn(
        // `bg-primary/10` reads as a tint on the near-white page, but 10% of the
        // dark palette's primary over its near-black background lands BELOW
        // `bg-card` — which would make the owner's own controls the flattest
        // surface in a column of `bg-card` info cards. The dark override (the
        // `.dark` variant declared in globals.css) restores the hierarchy.
        "space-y-3 border-primary/30 bg-primary/10 p-4",
        "dark:border-primary/40 dark:bg-primary/15",
        className,
      )}
    >
      <section
        // Labelled BY the notice below rather than repeating it in an aria-label
        // — a duplicate would make a screen reader announce the same sentence
        // twice.
        aria-labelledby={noticeId}
        data-testid="owner-listing-bar"
      >
        <div className="flex flex-wrap items-center gap-2">
          <p id={noticeId} className="text-sm font-semibold">
            {t("listing.detail.ownListingNotice")}
          </p>
          {/* The page's header row already renders a <StatusBadge> for every
            non-active status, so repeating it here would print "Sold" twice in
            the same column. Nothing above says a listing is *live*, though — and
            the owner is the one person who needs to know that — so the badge
            shows here for, and only for, a live active listing. */}
          {isLive && <StatusBadge status={status} />}
          {/* Self-gates: only an ACTIVE listing that is expiring or expired. */}
          <ExpiryBadge
            status={status}
            expiresAt={expiresAt}
            expired={expired}
          />
        </div>

        {/* Lifecycle row: the next transition, Renew when the clock is running
          out, and the way to everything else. See ROW_BUTTON for why nothing in
          here truncates. */}
        <div className="flex flex-wrap gap-2">
          {primary && PrimaryIcon && (
            <Button
              className={ROW_BUTTON}
              disabled={busy}
              onClick={() => ask(primary)}
            >
              <PrimaryIcon className="size-4" />
              <span>{t(`listing.${LIFECYCLE[primary].label}`)}</span>
            </Button>
          )}
          {showRenew && (
            <Button
              variant="outline"
              className={ROW_BUTTON}
              disabled={busy}
              onClick={() => ask("renew")}
            >
              <RenewIcon className="size-4" />
              <span>{t(`listing.${LIFECYCLE.renew.label}`)}</span>
            </Button>
          )}
          {/* Filled only for a SOLD listing, which has no transition left — then
            managing it is the panel's primary action. Otherwise it steps down to
            outline so the lifecycle button above owns the emphasis. */}
          <Button
            asChild
            variant={primary ? "outline" : "default"}
            className={ROW_BUTTON}
          >
            <Link href={`/my-listings/${listingId}`}>
              <SlidersHorizontal className="size-4" />
              <span>{t("listing.ownerDetail.actions")}</span>
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className={ROW_BUTTON}>
            <Link href={`/listings/${listingId}/edit`}>
              <Pencil className="size-4" />
              <span>{t("common.edit")}</span>
            </Link>
          </Button>
          {/* Same `?listing=` filter the manage screen links to (Chats reads it and
            scopes the thread list to this listing), and the same "Chats"
            vocabulary as the nav and that screen — one name per destination. The
            count comes free on the detail payload (`conversations_count`), and
            it's the difference between a link a seller ignores and one they
            click. `secondary`, not `ghost`: on a tinted panel a borderless
            button beside a filled and an outlined one reads as static text. */}
          <Button asChild variant="secondary" className={ROW_BUTTON}>
            <Link href={`/conversations?listing=${listingId}`}>
              <MessageSquare className="size-4" />
              <span
                // The longest label in the panel and the only one followed by a
                // pill, so the spec measures THIS one for clipping in all three
                // locales (fa is the binding case — see ROW_BUTTON).
                data-testid="owner-chats-label"
              >
                {t("listing.ownerDetail.viewConversations")}
              </span>
              {/* The shared count pill: hides itself at zero (Rails always emits
                `conversations_count`, so most owner views would otherwise read
                "View Chats 0"), formats its digits for the locale, and spells
                the number out for screen readers through the same pluralized key
                the manage screen uses ("… 3 chats", "… 1 chat"). */}
              <CountBadge
                count={conversationsCount}
                label={t("listing.conversationsCount", {
                  count: conversationsCount ?? 0,
                })}
              />
            </Link>
          </Button>
        </div>

        {/* The confirm prompt / buyer picker for whatever transition was asked for
          — the shared ones, so this panel behaves exactly like /my-listings. */}
        <LifecycleDialogs lifecycle={lifecycle} />

        {reviewTxn && (
          <ReviewPromptDialog
            transaction={reviewTxn}
            // Only the owner can record a sale, and the lifecycle payload's own
            // `role` is null (serialized without a current_user), so state it.
            role="seller"
            onClose={() => setReviewTxn(null)}
          />
        )}
      </section>
    </Card>
  );
}
