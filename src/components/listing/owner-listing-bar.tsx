"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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
import {
  ExpiryBadge,
  listingExpiryState,
} from "@/components/shared/expiry-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ListingStatus, Transaction } from "@/lib/types";

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
 * buyer picker and the review prompt can never drift). That matters most for the
 * one status this panel used to name without being able to fix: an expired
 * listing showed the red "Expired" pill and then offered only navigation. The
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
  const locale = useLocale();
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
  // draft→Publish · active→Mark as Sold · lapsed→Renew · reserved→Mark as Sold ·
  // sold→nothing (terminal). Gated on the SAME expiry state as the badge above,
  // so the pill and the button always tell the same story.
  const { primary } = actionsFor(status, expiry.kind === "expired");
  const PrimaryIcon = primary ? LIFECYCLE[primary].Icon : null;
  // Count badges hide at zero everywhere in the app: Rails always serves
  // `conversations_count`, and "0" beside a link is discouragement, not a pull.
  const hasChats = conversationsCount != null && conversationsCount > 0;

  return (
    <section
      // Labelled BY the notice below rather than repeating it in an aria-label —
      // a duplicate would make a screen reader announce the same sentence twice.
      aria-labelledby={noticeId}
      data-testid="owner-listing-bar"
      className={cn(
        // `bg-primary/10` reads as a tint on the near-white page, but 10% of the
        // dark palette's primary over its near-black background lands BELOW
        // `bg-card` — which would make the owner's own controls the flattest
        // surface in a column of `bg-card` info cards. The dark override (the
        // `.dark` variant declared in globals.css) restores the hierarchy.
        "space-y-3 rounded-lg border border-primary/30 bg-primary/10 p-4",
        "dark:border-primary/40 dark:bg-primary/15",
        className,
      )}
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
        <ExpiryBadge status={status} expiresAt={expiresAt} expired={expired} />
      </div>

      {/* min-w-0 on both the button and its label so a long translation actually
          ellipsises: a flex item defaults to min-width:auto, which makes
          `truncate` inert no matter how narrow the column gets. */}
      <div className="flex flex-wrap gap-2">
        {primary && PrimaryIcon && (
          <Button
            className="min-w-40 flex-1"
            disabled={busy}
            onClick={() => ask(primary)}
          >
            <PrimaryIcon className="size-4" />
            <span className="min-w-0 truncate">
              {t(`listing.${LIFECYCLE[primary].label}`)}
            </span>
          </Button>
        )}
        {/* Filled only for a SOLD listing, which has no transition left — then
            managing it is the panel's primary action. Otherwise it steps down to
            outline so the lifecycle button above owns the emphasis. */}
        <Button
          asChild
          variant={primary ? "outline" : "default"}
          className="min-w-40 flex-1"
        >
          <Link href={`/my-listings/${listingId}`}>
            <SlidersHorizontal className="size-4" />
            <span className="min-w-0 truncate">
              {t("listing.ownerDetail.actions")}
            </span>
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" className="min-w-0 flex-1">
          <Link href={`/listings/${listingId}/edit`}>
            <Pencil className="size-4" />
            <span className="min-w-0 truncate">{t("common.edit")}</span>
          </Link>
        </Button>
        {/* Same `?listing=` filter the manage screen links to (Chats reads it and
            scopes the thread list to this listing), and the same "Chats"
            vocabulary as the nav and that screen — one name per destination. The
            count comes free on the detail payload (`conversations_count`), and
            it's the difference between a link a seller ignores and one they
            click. `secondary`, not `ghost`: on a tinted panel a borderless
            button beside a filled and an outlined one reads as static text. */}
        <Button asChild variant="secondary" className="min-w-0 flex-1">
          <Link href={`/conversations?listing=${listingId}`}>
            <MessageSquare className="size-4" />
            <span className="min-w-0 truncate">
              {t("listing.ownerDetail.viewConversations")}
            </span>
            {hasChats && (
              <>
                {/* The `default` (primary-tinted) badge, not `secondary`: this
                    pill sits ON a secondary button, where secondary-on-secondary
                    disappears in both themes. */}
                <Badge aria-hidden className="shrink-0 px-1.5">
                  {formatNumber(conversationsCount, locale)}
                </Badge>
                {/* The bare number is meaningless to a screen reader, so the
                    accessible name spells it out — via the same pluralized key
                    the manage screen uses ("… 3 chats", "… 1 chat"). */}
                <span className="sr-only">
                  {t("listing.conversationsCount", {
                    count: conversationsCount,
                  })}
                </span>
              </>
            )}
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
  );
}
