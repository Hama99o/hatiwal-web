"use client";

import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MessageSquare, Pencil, SlidersHorizontal } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useIsOwner } from "@/components/auth/owner-gate";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  ExpiryBadge,
  listingExpiryState,
} from "@/components/shared/expiry-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ListingStatus } from "@/lib/types";

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
 * where it stands in the lifecycle, and gives the three things they'd actually
 * want next.
 *
 * Renders NOTHING unless the viewer is this listing's seller, so buyers and guests
 * see the page exactly as before. It is deliberately link-only — publish / reserve
 * / mark sold / renew / delete all live on `ManageListingView`
 * (`/my-listings/[id]`), which this links to rather than duplicating. It also
 * deliberately carries NO view/save counts: the page's meta row already shows both
 * to every viewer, owner included, so repeating them here would print the same two
 * numbers twice in one column. The conversations count is the exception — nothing
 * else on this page carries it, and "3 buyers are waiting on you" is the one
 * number that should pull a seller into the app.
 *
 * Styled as a primary-tinted panel (the same treatment as the seller-mode banner on
 * `ListingForm`) instead of the page's neutral `bg-card`, so it reads as "your
 * controls" rather than one more information card beside location and seller.
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
  const noticeId = useId();
  const isOwner = useIsOwner(sellerId);
  if (!isOwner) return null;

  // The panel and its expiry pill must never disagree: an active listing that is
  // past its run is "Expired", full stop — printing "Active" beside it (the old
  // behaviour, since Rails keeps `status: active` until a renew) reads as a bug
  // and hides the one thing the owner has to act on.
  const expiry = listingExpiryState({ status, expiresAt, expired });
  const isLive = status === "active" && expiry.kind !== "expired";

  return (
    <section
      // Labelled BY the notice below rather than repeating it in an aria-label —
      // a duplicate would make a screen reader announce the same sentence twice.
      aria-labelledby={noticeId}
      data-testid="owner-listing-bar"
      className={cn(
        "space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4",
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

      <div className="flex flex-wrap gap-2">
        {/* min-w-0 on both the button and its label so a long translation
            actually ellipsises: a flex item defaults to min-width:auto, which
            makes `truncate` inert no matter how narrow the column gets. */}
        <Button asChild className="min-w-40 flex-1">
          <Link href={`/my-listings/${listingId}`}>
            <SlidersHorizontal className="size-4" />
            <span className="min-w-0 truncate">
              {t("listing.ownerDetail.actions")}
            </span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="min-w-0">
          <Link href={`/listings/${listingId}/edit`}>
            <Pencil className="size-4" />
            <span className="min-w-0 truncate">{t("common.edit")}</span>
          </Link>
        </Button>
        {/* Same `?listing=` filter the manage screen links to (Conversations
            reads it and scopes the thread list to this listing). The count comes
            free on the detail payload (`conversations_count`), and it's the
            difference between a link a seller ignores and one they click. */}
        <Button asChild variant="ghost" className="min-w-0">
          <Link href={`/conversations?listing=${listingId}`}>
            <MessageSquare className="size-4" />
            <span className="min-w-0 truncate">
              {t("listing.ownerDetail.viewConversations")}
            </span>
            {conversationsCount != null && (
              <>
                {/* `secondary`, not the primary-tinted default: this pill sits
                    on a primary-tinted panel, where primary-on-primary washes
                    out in both themes. */}
                <Badge
                  aria-hidden
                  variant="secondary"
                  className="shrink-0 px-1.5"
                >
                  {formatNumber(conversationsCount, locale)}
                </Badge>
                {/* The bare number is meaningless to a screen reader, so the
                    accessible name spells it out ("… 3 conversations"). */}
                <span className="sr-only">
                  {t("listing.ownerDetail.conversationsCount", {
                    count: formatNumber(conversationsCount, locale),
                  })}
                </span>
              </>
            )}
          </Link>
        </Button>
      </div>
    </section>
  );
}
