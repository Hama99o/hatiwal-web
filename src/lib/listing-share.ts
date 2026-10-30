import { formatPrice } from "@/lib/format";
import { isLive } from "@/lib/stock";
import type { Listing } from "@/lib/types";

/**
 * IDEA-8 (1.2.1, hatiwal-mobile docs/design/SHARE_AND_QR.md §3.2): the listing's
 * link-preview text. WhatsApp draws og:title and og:description itself (no text
 * is burnt into the image), so this is what a WhatsApp chat shows:
 *
 *   Toyota Corolla 2010 · ‎؋520,000                  ← og:title
 *   Kabul · Cars · Hatiwal                          ← og:description
 *
 * In the page's language (formatPrice: the locale's digits and currency sign).
 * Pure, so the e2e spec reads the same strings the page renders.
 */
type ShareableListing = Pick<Listing, "title" | "price" | "currency" | "status"> & {
  location?: string | null;
  city?: string | null;
};

export function listingShareTitle(listing: ShareableListing, locale: string): string {
  return listing.price > 0 ? `${listing.title} · ${formatPrice(listing.price, listing.currency, locale)}` : listing.title;
}

export function listingShareDescription(
  listing: ShareableListing,
  opts: { locale: string; categoryLabel?: string | null; soldLabel: string },
): string {
  const place = listing.city || listing.location;
  return [isLive(listing) ? null : opts.soldLabel, place, opts.categoryLabel, "Hatiwal"]
    .filter((part): part is string => !!part && part.trim().length > 0)
    .join(" · ");
}
