import { MapPin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { RemoteImage } from "./remote-image";
import { PriceTag } from "./price-tag";
import { StatusBadge } from "./status-badge";
import { ConditionBadge } from "./condition-badge";
import { ExpiryBadge } from "./expiry-badge";
import { PriceDropBadge } from "./price-drop-badge";
import { FirmPriceBadge } from "./firm-price-badge";
import { SaveButton } from "./save-button";
import { formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Listing } from "@/lib/types";

/** Grid = photo-first card; list = compact horizontal row. */
export type ListingCardVariant = "grid" | "list";

/**
 * `sizes` for the cover photo, one entry per track set `ListingGrid` can lay a
 * card out on (`GRID_COLUMNS` there is keyed by the same names, so the two can
 * never drift). It lives with the card because the card owns the `<Image>`, and
 * the grid passes the entry matching the tracks it actually used — a hint that
 * describes a different layout makes the browser pick a photo two to three
 * times the size it renders at.
 *
 *   page — the full-width feed: 2 → 3 → 4 → 5 columns of the viewport.
 *   rail — a capped cross-sell rail: 2 → 4 columns inside a max-w-6xl page,
 *          so past ~1200px the card stops growing and settles at ~272px.
 */
export const CARD_IMAGE_SIZES = {
  page: "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw",
  rail: "(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 272px",
} as const;

/** The track sets a card knows a `sizes` hint for. */
export type ListingCardTracks = keyof typeof CARD_IMAGE_SIZES;

interface ListingCardProps {
  listing: Listing;
  /** Layout variant. `grid` (default) is the tall photo card; `list` is a dense row. */
  variant?: ListingCardVariant;
  /** Track set the card is laid out on — picks the photo's `sizes` hint. */
  tracks?: ListingCardTracks;
  /** Show the lifecycle badge for non-active listings (seller/owner contexts). */
  showStatus?: boolean;
  /** Save-heart overlay on the photo (default). Turn off in owner contexts. */
  showSave?: boolean;
  priority?: boolean;
  /** Override the link target (defaults to the public /listings/[id]). */
  href?: string;
  /**
   * Optional action row rendered UNDER the card body, outside the link (so its
   * buttons/menus are clickable and valid HTML). Used by the seller dashboard
   * for inline lifecycle quick-actions — see `account/seller-listing-actions`.
   */
  footer?: React.ReactNode;
  className?: string;
}

/**
 * THE listing card — photo-first, price-prominent. Reused by browse, home,
 * category, seller profile, and the similar-items rail. Do not fork it.
 * `variant="list"` renders the same content as a compact single-row layout.
 */
export function ListingCard({
  listing,
  variant = "grid",
  tracks = "page",
  showStatus = false,
  showSave = true,
  priority = false,
  href,
  footer,
  className,
}: ListingCardProps) {
  const locale = useLocale();
  const t = useTranslations("listing");
  // Small "Seen" pill on already-viewed cards (mobile parity — the dim alone is
  // subtle). Rendered in the photo overlay of both variants.
  const seenBadge = listing.isViewed ? (
    <span className="rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
      {t("seen")}
    </span>
  ) : null;
  const cover = listing.thumbnailUrl ?? listing.images[0] ?? null;
  const showStatusBadge = showStatus && listing.status !== "active";
  // Owner/seller contexts (`showStatus`, the same switch the lifecycle badges
  // ride on) NAME a missing photo instead of leaving a silent grey glyph: in the
  // seller's own shop a photoless listing is an action prompt — no photo is why
  // nobody is messaging them — and mobile's SellerListingCard labels it the same
  // way. On the public feed the quiet placeholder stays quiet.
  const noPhotoLabel = showStatus ? t("noPhoto") : undefined;

  const saveHeart = showSave ? (
    <SaveButton
      listingId={listing.id}
      initialSaved={listing.isSaved}
      ownerId={listing.seller?.id}
      className={cn(
        // Kept at the SaveButton's 40px default (touch-target minimum) in both
        // variants — only the inset shifts for the smaller list thumbnail.
        "absolute",
        variant === "list" ? "end-1 top-1" : "end-2 top-2",
      )}
    />
  ) : null;

  const meta = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {listing.location && (
        <span className="flex min-w-0 items-center gap-1">
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">{listing.location}</span>
        </span>
      )}
      {listing.createdAt && (
        <span className="shrink-0">
          {formatRelativeDate(listing.createdAt, locale)}
        </span>
      )}
    </div>
  );

  if (variant === "list") {
    return (
      // The link wraps only the photo + body: an optional action footer must sit
      // OUTSIDE the anchor (buttons inside a link are neither valid nor usable).
      <div
        className={cn(
          "group flex flex-col overflow-hidden rounded-lg border bg-card p-2 transition-shadow hover:shadow-md",
          className,
        )}
      >
        {/* The "already seen" dim stays on the CONTENT: a footer action row (and
            the modals it opens) must never inherit it. */}
        <Link
          href={href ?? `/listings/${listing.id}`}
          className={cn("flex gap-3", listing.isViewed && "opacity-80")}
        >
          <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-md bg-muted sm:w-28">
            <RemoteImage
              src={cover}
              alt={listing.title}
              label={noPhotoLabel}
              fill
              sizes="112px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              priority={priority}
            />
            {(listing.priceDropPercent || seenBadge) && (
              <div
                className={cn(
                  "absolute inset-x-1 top-1 flex flex-wrap gap-1",
                  showSave && "pe-12",
                )}
              >
                {seenBadge}
                {listing.priceDropPercent ? (
                  <PriceDropBadge
                    percent={listing.priceDropPercent}
                    variant="card"
                  />
                ) : null}
              </div>
            )}
            {saveHeart}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <PriceTag
                price={listing.price}
                currency={listing.currency}
                size="md"
              />
              {listing.negotiable === false && (
                <FirmPriceBadge negotiable={listing.negotiable} />
              )}
            </div>
            <p className="line-clamp-2 text-sm font-medium text-foreground">
              {listing.title}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {showStatusBadge && <StatusBadge status={listing.status} />}
              {showStatus && (
                <ExpiryBadge
                  status={listing.status}
                  expiresAt={listing.expiresAt}
                  expired={listing.expired}
                />
              )}
              {listing.condition && (
                <ConditionBadge condition={listing.condition} />
              )}
            </div>
            {meta}
          </div>
        </Link>
        {footer && <div className="mt-2 border-t pt-2">{footer}</div>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex flex-col overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md",
        className,
      )}
    >
      <Link
        href={href ?? `/listings/${listing.id}`}
        className={cn("block", listing.isViewed && "opacity-80")}
      >
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          <RemoteImage
            src={cover}
            alt={listing.title}
            label={noPhotoLabel}
            fill
            sizes={CARD_IMAGE_SIZES[tracks]}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            priority={priority}
          />
          <div
            className={cn(
              "absolute inset-x-2 top-2 flex flex-wrap gap-1",
              showSave && "pe-12",
            )}
          >
            {showStatusBadge && <StatusBadge status={listing.status} />}
            {seenBadge}
            {listing.priceDropPercent ? (
              <PriceDropBadge
                percent={listing.priceDropPercent}
                variant="card"
              />
            ) : null}
          </div>
          {saveHeart}
        </div>
        <div className="space-y-1 p-3">
          <PriceTag price={listing.price} currency={listing.currency} size="md" />
          {listing.negotiable === false && (
            <FirmPriceBadge negotiable={listing.negotiable} />
          )}
          <p className="line-clamp-2 text-sm font-medium text-foreground">
            {listing.title}
          </p>
          {showStatus && (
            <ExpiryBadge
              status={listing.status}
              expiresAt={listing.expiresAt}
              expired={listing.expired}
            />
          )}
          {listing.condition && (
            <ConditionBadge condition={listing.condition} />
          )}
          {listing.location && (
            <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{listing.location}</span>
            </span>
          )}
        </div>
      </Link>
      {/* `mt-auto` keeps the action rows aligned across a row of cards whose
          titles wrap to different heights. `px-3` matches the body inset above
          so the action button's edges line up with the price and title. */}
      {footer && (
        <div className="mt-auto border-t px-3 pb-3 pt-2">{footer}</div>
      )}
    </div>
  );
}
