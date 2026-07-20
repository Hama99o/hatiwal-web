import { MapPin } from "lucide-react";
import { useLocale } from "next-intl";
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

interface ListingCardProps {
  listing: Listing;
  /** Layout variant. `grid` (default) is the tall photo card; `list` is a dense row. */
  variant?: ListingCardVariant;
  /** Show the lifecycle badge for non-active listings (seller/owner contexts). */
  showStatus?: boolean;
  /** Save-heart overlay on the photo (default). Turn off in owner contexts. */
  showSave?: boolean;
  priority?: boolean;
  /** Override the link target (defaults to the public /listings/[id]). */
  href?: string;
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
  showStatus = false,
  showSave = true,
  priority = false,
  href,
  className,
}: ListingCardProps) {
  const locale = useLocale();
  const cover = listing.thumbnailUrl ?? listing.images[0] ?? null;
  const showStatusBadge = showStatus && listing.status !== "active";

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
      <Link
        href={href ?? `/listings/${listing.id}`}
        className={cn(
          "group flex gap-3 overflow-hidden rounded-lg border bg-card p-2 transition-shadow hover:shadow-md",
          listing.isViewed && "opacity-80",
          className,
        )}
      >
        <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-md bg-muted sm:w-28">
          <RemoteImage
            src={cover}
            alt={listing.title}
            fill
            sizes="112px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            priority={priority}
          />
          {listing.priceDropPercent ? (
            <div
              className={cn(
                "absolute inset-x-1 top-1 flex flex-wrap gap-1",
                showSave && "pe-12",
              )}
            >
              <PriceDropBadge percent={listing.priceDropPercent} variant="card" />
            </div>
          ) : null}
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
    );
  }

  return (
    <Link
      href={href ?? `/listings/${listing.id}`}
      className={cn(
        "group block overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md",
        listing.isViewed && "opacity-80",
        className,
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        <RemoteImage
          src={cover}
          alt={listing.title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
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
  );
}
