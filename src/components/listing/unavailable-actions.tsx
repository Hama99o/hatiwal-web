import { ArrowRight, Ban, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { categoryName } from "@/lib/api/categories";
import { cn } from "@/lib/utils";
import {
  DEFAULT_FILTERS,
  filtersToSearchString,
} from "@/components/browse/filters";
import type { CategoryRef, ListingStatus } from "@/lib/types";

/**
 * UnavailableActions — the recovery card shown in place of the contact CTAs when
 * a listing is no longer buyable (sold / reserved / draft).
 *
 * A sold or reserved listing used to be a dead end: a flat grey "This item has
 * been sold" box and nothing to do next. These pages are indexed and stock
 * turns over fast, so guests landing from search hit that constantly. This keeps
 * the same status sentence but adds the two next steps that actually recover the
 * visit:
 *
 *   1. PRIMARY — "See similar in {category}" → the Bazaar, pre-filtered to the
 *      same category and a ±30% price band around this listing's price.
 *   2. SECONDARY — "More from {seller}" → that seller's public profile. While
 *      this card is on screen it is the page's ONLY link to that profile: the
 *      "More from this Seller" rail below drops its "view all" for a
 *      sold/reserved listing so the two don't compete for the same click.
 *
 * The band is built with `filtersToSearchString` (the ONE browse filter ⇄ URL
 * mapping), so the Bazaar sidebar renders category + min + max as active
 * filters and the active-filter pill counts them — no new param vocabulary.
 * Bazaar always queries `status: "active"`, so the sold item can't come back.
 *
 * Pure props → stays a Server Component (no client JS on an SEO landing page).
 * Reserved items also get a muted "may free up" line, because the SaveButton
 * directly below is still worth using when a reservation falls through.
 */

/**
 * ±30% price band around a listing price, as URL-ready strings.
 *
 * Returns empty strings (→ no `min`/`max` params) when the price is missing,
 * zero, negative or non-finite — a free/priceless item must not send a bogus
 * band. `min` is floored at 0 and, for any positive price, is always ≤ `max`.
 */
export function priceBand(price: number | null | undefined): {
  min: string;
  max: string;
} {
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) return { min: "", max: "" };
  const min = Math.max(0, Math.round(p * 0.7));
  const max = Math.round(p * 1.3);
  // Belt-and-braces: never emit an inverted range (unreachable for p > 0, but
  // a silently empty result set is worse than simply dropping the band).
  if (min > max) return { min: "", max: "" };
  return { min: String(min), max: String(max) };
}

export function UnavailableActions({
  status,
  category,
  price,
  sellerId,
  sellerName,
  locale,
  className,
}: {
  status: ListingStatus;
  /** Null on listings with no category → the category CTA is omitted. */
  category: CategoryRef | null;
  price: number | null | undefined;
  /** Null/undefined when the seller isn't on the payload → seller CTA omitted. */
  sellerId?: number | null;
  sellerName?: string | null;
  /** Active locale — used to name the category in the CTA label. */
  locale: string;
  className?: string;
}) {
  const t = useTranslations();

  const notice =
    status === "sold"
      ? t("listing.detail.soldNotice")
      : status === "reserved"
        ? t("listing.detail.reservedNotice")
        : t("listing.detail.unavailableNotice");

  // A reservation can fall through, so saving is still worth it — but a sold
  // item is final, and saying "may free up" there would be a false promise.
  const mayFreeUp = status === "reserved";

  const band = category ? priceBand(price) : { min: "", max: "" };
  const similarHref = category
    ? `/bazaar${filtersToSearchString({
        ...DEFAULT_FILTERS,
        categorySlug: category.slug,
        priceMin: band.min,
        priceMax: band.max,
      })}`
    : null;

  const sellerHref = sellerId != null ? `/sellers/${sellerId}` : null;

  return (
    <div
      className={cn("space-y-3 rounded-lg border bg-muted/50 p-4", className)}
      data-testid="unavailable-actions"
    >
      <div className="flex items-start gap-2">
        <Ban className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{notice}</p>
          {mayFreeUp && (
            <p className="text-xs text-muted-foreground">
              {t("listing.detail.reservedMayFreeUp")}
            </p>
          )}
        </div>
      </div>

      {/* Never render an empty button row: a listing with neither a category
          nor a seller keeps just the status sentence. */}
      {(similarHref || sellerHref) && (
        <div className="space-y-2">
          {similarHref && category && (
            <Button asChild className="w-full">
              <Link href={similarHref}>
                {/* min-w-0 lets a long category name ellipsize instead of
                    widening the button past the viewport at 375px. */}
                <span className="min-w-0 truncate">
                  {t("listing.detail.seeSimilarIn", {
                    category: categoryName(category, locale),
                  })}
                </span>
                {/* Mirrored in RTL so the arrow always points "forward". */}
                <ArrowRight className="size-4 rtl:-scale-x-100" />
              </Link>
            </Button>
          )}
          {sellerHref && (
            <Button asChild variant="outline" className="w-full">
              <Link href={sellerHref}>
                <Store className="size-4" />
                <span className="min-w-0 truncate">
                  {sellerName
                    ? t("listing.detail.moreFromSellerNamed", {
                        name: sellerName,
                      })
                    : t("listing.detail.moreFromSeller")}
                </span>
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
