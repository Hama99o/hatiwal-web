"use client";

import { useTranslations } from "next-intl";
import { MessageSquare, Pencil, SlidersHorizontal } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useIsOwner } from "@/components/auth/owner-gate";
import { StatusBadge } from "@/components/shared/status-badge";
import { ExpiryBadge } from "@/components/shared/expiry-badge";
import { Button } from "@/components/ui/button";
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
 * Renders NOTHING unless the viewer is signed in AND is this listing's seller, so
 * buyers and guests see the page exactly as before. It is deliberately link-only —
 * publish / reserve / mark sold / renew / delete all live on `ManageListingView`
 * (`/my-listings/[id]`), which this links to rather than duplicating. It also
 * deliberately carries NO view/save counts: the page's meta row already shows both
 * to every viewer, owner included, so repeating them here would print the same two
 * numbers twice in one column.
 *
 * Styled as a primary-tinted panel (the same treatment as the seller-mode banner on
 * `ListingForm`) instead of the page's neutral `bg-card`, so it reads as "your
 * controls" rather than one more information card beside location and seller.
 *
 * Client component (the page is a Server Component) because ownership can only be
 * decided from the browser session — the SSR fetch is an anonymous request.
 */
export function OwnerListingBar({
  listingId,
  sellerId,
  status,
  expiresAt,
  expired,
  className,
}: {
  listingId: number;
  /** The listing's seller. Undefined (seller not on the payload) → never owner. */
  sellerId?: number;
  status: ListingStatus;
  expiresAt?: string | null;
  expired?: boolean;
  className?: string;
}) {
  const t = useTranslations();
  // `useIsOwner` is false for guests AND during the pre-resolution "loading"
  // tick, so the panel never flashes for a signed-out visitor.
  const isOwner = useIsOwner(sellerId);
  if (!isOwner) return null;

  return (
    <section
      aria-label={t("listing.detail.ownListingNotice")}
      data-testid="owner-listing-bar"
      className={cn(
        "space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">
          {t("listing.detail.ownListingNotice")}
        </p>
        {/* The page's header row already renders a <StatusBadge> for every
            non-active status, so repeating it here would print "Sold" twice in
            the same column. Nothing above says a listing is *live*, though — and
            the owner is the one person who needs to know that — so the badge
            shows here for, and only for, `active`. */}
        {status === "active" && <StatusBadge status={status} />}
        {/* Self-gates: only an ACTIVE listing expiring within 7 days shows a pill. */}
        <ExpiryBadge status={status} expiresAt={expiresAt} expired={expired} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild className="min-w-40 flex-1">
          <Link href={`/my-listings/${listingId}`}>
            <SlidersHorizontal className="size-4" />
            <span className="truncate">{t("listing.ownerDetail.actions")}</span>
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/listings/${listingId}/edit`}>
            <Pencil className="size-4" />
            {t("common.edit")}
          </Link>
        </Button>
        {/* Same `?listing=` filter the manage screen links to (Conversations
            reads it and scopes the thread list to this listing). */}
        <Button asChild variant="ghost">
          <Link href={`/conversations?listing=${listingId}`}>
            <MessageSquare className="size-4" />
            <span className="truncate">
              {t("listing.ownerDetail.viewConversations")}
            </span>
          </Link>
        </Button>
      </div>
    </section>
  );
}
