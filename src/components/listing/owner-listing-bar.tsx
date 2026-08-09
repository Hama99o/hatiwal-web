"use client";

import { useTranslations } from "next-intl";
import { Eye, Heart, MessageSquare, Pencil, SlidersHorizontal } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
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
 * (`/my-listings/[id]`), which this links to rather than duplicating.
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
  viewsCount,
  savesCount,
  className,
}: {
  listingId: number;
  /** The listing's seller. Undefined (seller not on the payload) → never owner. */
  sellerId?: number;
  status: ListingStatus;
  expiresAt?: string | null;
  expired?: boolean;
  viewsCount?: number;
  savesCount?: number;
  className?: string;
}) {
  const t = useTranslations();
  const { status: authStatus, user } = useAuth();

  // `authStatus !== "authed"` covers both the guest case and the pre-resolution
  // "loading" tick, so the panel never flashes for a signed-out visitor.
  if (authStatus !== "authed" || sellerId == null || user?.id !== sellerId) {
    return null;
  }

  return (
    <section
      aria-label={t("listing.detail.ownListingNotice")}
      data-testid="owner-listing-bar"
      className={cn("space-y-3 rounded-lg border bg-card p-4", className)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">
          {t("listing.detail.ownListingNotice")}
        </p>
        <StatusBadge status={status} />
        {/* Self-gates: only an ACTIVE listing expiring within 7 days shows a pill. */}
        <ExpiryBadge status={status} expiresAt={expiresAt} expired={expired} />
      </div>

      {/* The owner's reason to care about this page: how much interest it's drawn. */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Eye className="size-4 shrink-0" />
          {t("listing.viewsCount", { count: viewsCount ?? 0 })}
        </span>
        {savesCount != null && savesCount > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <Heart className="size-4 shrink-0" />
            {t("listing.savesCount", { count: savesCount })}
          </span>
        )}
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
