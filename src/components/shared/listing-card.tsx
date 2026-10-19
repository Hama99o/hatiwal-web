import { MapPin } from "lucide-react";
import { cardLocation } from "@/lib/provinces";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { RemoteImage } from "./remote-image";
import { VideoBadge } from "@/components/shared/video-badge";
import { PriceTag } from "./price-tag";
import { StatusBadge } from "./status-badge";
import { ConditionBadge } from "./condition-badge";
import { ExpiryBadge } from "./expiry-badge";
import { PriceDropBadge } from "./price-drop-badge";
import { FirmPriceBadge } from "./firm-price-badge";
import { ShopChip } from "./shop-chip";
import { SaveButton } from "./save-button";
import { formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { hasStockToShow } from "@/lib/stock";
import type { Listing } from "@/lib/types";
import { userTextProps } from "@/lib/text-direction";

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
  /**
   * Caption a photoless card "No photo" instead of showing the silent glyph.
   * ONLY for the owner's own inventory (`/my-listings`), where the person who can
   * add the photo is the one reading it. Deliberately separate from `showStatus`
   * — see the note at `noPhotoLabel` below.
   */
  nameMissingPhoto?: boolean;
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
  nameMissingPhoto = false,
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
    <span className="rounded-full bg-background/95 px-2 py-0.5 text-[11px] font-semibold text-foreground shadow-xs">
      {t("seen")}
    </span>
  ) : null;
  // A card shows the light THUMB (1.1.6 photo variants), then the 600px
  // thumbnail_url, then the original (normalizeListing's cardImageUrl).
  const cover = listing.cardImageUrl ?? listing.thumbnailUrl ?? listing.images[0] ?? null;
  // A variant that fails to load falls back to the original (RemoteImage).
  const coverFallback = listing.images[0] !== cover ? listing.images[0] : null;
  const showStatusBadge = showStatus && listing.status !== "active";
  // The seller's OWN inventory names a missing photo in words instead of leaving
  // a silent grey glyph: there a photoless listing is an action prompt — no photo
  // is why nobody is messaging them — and mobile's SellerListingCard labels it
  // the same way.
  //
  // It rides its own explicit flag, NOT `showStatus`: that prop means "show the
  // lifecycle badges" and is also on for the PUBLIC seller profile's Sold grid
  // (`seller/seller-listings-tabs.tsx`), where a buyer would get "No photo"
  // stamped on every photoless sold card. Ownership and badges are two different
  // questions — keep them two props.
  //
  // Suppressing the caption for buyers is a DELIBERATE DIVERGENCE from mobile,
  // not an oversight: mobile's shared ListingCard captions a photoless listing
  // unconditionally, so its buyer feed is captioned too. On web the public feed
  // keeps the quiet unlabelled tile on purpose (a caption is noise to someone who
  // cannot act on it) — do not "restore parity" by dropping this gate.
  const noPhotoLabel = nameMissingPhoto ? t("noPhoto") : undefined;

  const saveHeart = showSave ? (
    <SaveButton
      listingId={listing.id}
      initialSaved={listing.isSaved}
      ownerId={listing.seller?.id}
      ownerShopId={listing.shop?.id ?? listing.seller?.shopId ?? listing.shopId}
      className={cn(
        // A 44px hit area around a 36px disc (SaveButton) — the inset puts the
        // DISC ~8px from the photo's corner in both variants.
        "absolute",
        variant === "list" ? "end-0 top-0" : "end-0.5 top-0.5",
      )}
    />
  ) : null;

  const meta = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {/* SHOP-1: posted as a shop → the small "Shop" chip. */}
      {listing.shop && <ShopChip testId="listing-shop-chip" />}
      {listing.location && (
        <span className="flex min-w-0 items-center gap-1">
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">{cardLocation(listing.location, locale)}</span>
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
          "group flex flex-col overflow-hidden rounded-2xl border bg-card p-2.5 transition-shadow hover:shadow-card",
          className,
        )}
      >
        {/* The "already seen" dim stays on the CONTENT: a footer action row (and
            the modals it opens) must never inherit it. */}
        <Link
          href={href ?? `/listings/${listing.id}`}
          className={cn("flex gap-3", listing.isViewed && "opacity-80")}
        >
          <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-xl bg-muted sm:w-28">
            <RemoteImage
              src={cover}
              srcSet={listing.cardImageSrcSet}
              fallbackSrc={coverFallback}
              alt={listing.title}
              label={noPhotoLabel}
              fill
              sizes="112px"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
              priority={priority}
            />
            {/* VID: a small centred ▶ when the listing has a video — nothing else on a card. */}
            {listing.hasVideo ? (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <VideoBadge />
              </span>
            ) : null}
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
                unit={listing.priceUnit}
                currency={listing.currency}
                size="md"
                perUnit={hasStockToShow(listing)}
              />
              {listing.negotiable === false && (
                <FirmPriceBadge negotiable={listing.negotiable} />
              )}
            </div>
            <p className="line-clamp-2 text-sm font-medium text-foreground" {...userTextProps(listing.title)} data-testid="listing-card-title">
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

  // Grid: the Etsy / Airbnb / Depop card — NO box. The photo is the card (rounded,
  // lifted on hover) and the text sits on the page under it. An owner card with
  // an action `footer` keeps a panel, so its buttons belong to something.
  const conditionText = listing.condition ? t(`condition.${listing.condition}`) : null;
  return (
    <div
      className={cn(
        "group flex flex-col",
        footer && "rounded-2xl border bg-card p-2 shadow-xs",
        className,
      )}
    >
      <Link
        href={href ?? `/listings/${listing.id}`}
        className={cn(
          "block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          listing.isViewed && "opacity-80",
        )}
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted ring-1 ring-inset ring-foreground/5 transition-shadow duration-300 group-hover:shadow-card">
          <RemoteImage
            src={cover}
            srcSet={listing.cardImageSrcSet}
            fallbackSrc={coverFallback}
            alt={listing.title}
            label={noPhotoLabel}
            fill
            sizes={CARD_IMAGE_SIZES[tracks]}
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            priority={priority}
          />
          {listing.hasVideo ? (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <VideoBadge />
            </span>
          ) : null}
          <div
            className={cn(
              "absolute inset-x-2 top-2 flex flex-wrap gap-1",
              showSave && "pe-11",
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
        <div className="space-y-0.5 px-0.5 pb-1 pt-2.5">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <PriceTag
              price={listing.price}
              unit={listing.priceUnit}
              currency={listing.currency}
              size="md"
              perUnit={hasStockToShow(listing)}
            />
            {listing.negotiable === false && (
              <FirmPriceBadge negotiable={listing.negotiable} />
            )}
          </div>
          <p className="line-clamp-2 text-sm leading-snug text-foreground/85" {...userTextProps(listing.title)} data-testid="listing-card-title">
            {listing.title}
          </p>
          {showStatus && (
            <ExpiryBadge
              status={listing.status}
              expiresAt={listing.expiresAt}
              expired={listing.expired}
            />
          )}
          {/* One quiet meta line — Vinted / Depop: condition as words, then the
              place; the SHOP-1 chip leads it when posted as a shop. */}
          {(listing.shop || conditionText || listing.location) && (
            <div className="flex min-w-0 items-center gap-1.5 pt-0.5 text-xs text-muted-foreground">
              {listing.shop && <ShopChip testId="listing-shop-chip" />}
              {conditionText && (
                <span className="shrink-0" data-testid="listing-card-condition">{conditionText}</span>
              )}
              {conditionText && listing.location && <span aria-hidden>·</span>}
              {listing.location && (
                <span className="flex min-w-0 items-center gap-0.5">
                  <MapPin className="size-3 shrink-0" />
                  <span className="truncate">{cardLocation(listing.location, locale)}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
      {/* `mt-auto` keeps the action rows aligned across a row of cards whose
          titles wrap to different heights. */}
      {footer && (
        <div className="mt-auto border-t px-1 pb-1 pt-2">{footer}</div>
      )}
    </div>
  );
}
