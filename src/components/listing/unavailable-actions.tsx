import { ArrowRight, Ban, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { categoryName } from "@/lib/api/categories";
import { cn } from "@/lib/utils";
import { recoveryBand } from "@/components/listing/recovery-band";
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
 * the same status sentence but adds the next steps that actually recover the
 * visit:
 *
 *   1. PRIMARY — "See similar in {category}" → the Bazaar, pre-filtered to the
 *      same category (plus a ±30% price band when that band provably holds
 *      stock — see `recovery-band.ts`).
 *   2. SECONDARY — "More from {seller}" → that seller's public profile. While
 *      this card is on screen it is the page's ONLY link to that profile: the
 *      "More from this Seller" rail below drops its "view all" for a
 *      sold/reserved listing so the two don't compete for the same click.
 *
 * The band is built with `filtersToSearchString` (the ONE browse filter ⇄ URL
 * mapping), so the Bazaar sidebar renders category + min + max as active
 * filters and the active-filter pill counts them — no new param vocabulary.
 * The Bazaar feed is GET /listings, which is browsable-only server-side
 * (active.not_expired.not_removed), so the sold item cannot come back. That
 * guarantee comes from the endpoint, NOT from a `status` param — the clients
 * used to send one and the server always dropped it.
 *
 * NEVER promises stock that isn't there. `similarPrices` is the live stock the
 * category CTA would land on (the same `similar_to` set the rail below renders,
 * fetched once by the page and shared): with none, the category CTA is dropped
 * entirely rather than sending the buyer from one dead end to a second, emptier
 * one. When that leaves the seller CTA as the only action it is promoted to the
 * primary weight, so the card is never a stack of equally quiet buttons.
 *
 * Pure props → stays a Server Component (no client JS on an SEO landing page).
 */
export function UnavailableActions({
  status,
  category,
  price,
  currency,
  similarPrices,
  sellerId,
  sellerName,
  locale,
  className,
}: {
  status: ListingStatus;
  /** Null on listings with no category → the category CTA is omitted. */
  category: CategoryRef | null;
  price: number | null | undefined;
  /** Needed to decide whether a price band means anything (Rails' filter is
   *  currency-blind — see `BANDABLE_CURRENCY`). */
  currency: string | null | undefined;
  /**
   * Prices of the active listings in this category (`GET /listings/:id/similar`).
   * EMPTY ⇒ the "see similar" CTA would land on an empty Bazaar, so it is not
   * rendered at all.
   */
  similarPrices: ReadonlyArray<number | null | undefined>;
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

  // A reservation can fall through, so the item may come back — worth saying,
  // because the SaveButton just below this card is how a buyer catches that. A
  // sold item is final, and the same line there would be a false promise.
  const mayFreeUp = status === "reserved";

  // Only offer the category when it demonstrably has something to show.
  const hasSimilarStock = similarPrices.length > 0;
  const band = recoveryBand(price, currency, similarPrices);
  const similarHref =
    category && hasSimilarStock
      ? `/bazaar${filtersToSearchString({
          ...DEFAULT_FILTERS,
          categorySlug: category.slug,
          priceMin: band.min,
          priceMax: band.max,
        })}`
      : null;

  const sellerHref = sellerId != null ? `/sellers/${sellerId}` : null;
  // With no category CTA the seller's shelf IS the recovery path, so it takes
  // the primary weight instead of reading like an afterthought.
  const sellerIsPrimary = !similarHref;

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

      {/* Never render an empty button row: a listing with neither in-stock
          category nor a seller keeps just the status sentence. */}
      {(similarHref || sellerHref) && (
        <div className="space-y-1.5">
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
            <Button
              asChild
              variant={sellerIsPrimary ? "default" : "ghost"}
              size={sellerIsPrimary ? "default" : "sm"}
              className={cn("w-full", !sellerIsPrimary && "text-muted-foreground")}
            >
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
