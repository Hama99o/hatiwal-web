import { MapPin } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { RemoteImage } from "./remote-image";
import { PriceTag } from "./price-tag";
import { StatusBadge } from "./status-badge";
import { PriceDropBadge } from "./price-drop-badge";
import { cn } from "@/lib/utils";
import type { Listing } from "@/lib/types";

interface ListingCardProps {
  listing: Listing;
  /** Show the lifecycle badge for non-active listings (seller/owner contexts). */
  showStatus?: boolean;
  priority?: boolean;
  /** Override the link target (defaults to the public /listings/[id]). */
  href?: string;
  className?: string;
}

/**
 * THE listing card — photo-first, price-prominent. Reused by browse, home,
 * category, seller profile, and the similar-items rail. Do not fork it.
 */
export function ListingCard({
  listing,
  showStatus = false,
  priority = false,
  href,
  className,
}: ListingCardProps) {
  const cover = listing.thumbnailUrl ?? listing.images[0] ?? null;
  const showStatusBadge = showStatus && listing.status !== "active";

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
        <div className="absolute inset-x-2 top-2 flex flex-wrap gap-1">
          {showStatusBadge && <StatusBadge status={listing.status} />}
          {listing.priceDropPercent ? (
            <PriceDropBadge percent={listing.priceDropPercent} />
          ) : null}
        </div>
      </div>
      <div className="space-y-1 p-3">
        <PriceTag price={listing.price} currency={listing.currency} size="md" />
        <p className="line-clamp-2 text-sm font-medium text-foreground">
          {listing.title}
        </p>
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
