import { formatNumber } from "@/lib/format";

/**
 * The shop share text and its link-preview description, in the reader's
 * language (owner, 2026-10-08; mobile buildShopShareText). Pure: callers pass
 * a `shops`-namespace t, the localized category and open-hours lines.
 *
 *   Safi Cosmetics ✓ Verified
 *   Beauty · Kabul
 *   Open now · until 20:00
 *   ★ 4.8 · 12 reviews
 *   34 products
 *   https://hatiwal.com/s/42      (the URL is added by the share sheet)
 */
export type ShareableShop = {
  name: string;
  verified: boolean;
  city?: string | null;
  province?: string | null;
  avgRating?: number | null;
  reviewCount?: number | null;
  listingsCount?: number | null;
};

type T = (key: string, values?: Record<string, string | number>) => string;

function ratingLine(shop: ShareableShop, t: T, locale: string): string {
  const reviews = shop.reviewCount ?? 0;
  if (reviews <= 0 || shop.avgRating == null) return "";
  return t("share.rating", {
    rating: formatNumber(Math.round(shop.avgRating * 10) / 10, locale),
    count: reviews,
    display: formatNumber(reviews, locale),
  });
}

function productsLine(shop: ShareableShop, t: T, locale: string): string {
  const n = shop.listingsCount ?? 0;
  return n > 0 ? t("share.products", { count: n, display: formatNumber(n, locale) }) : "";
}

export function shopShareTitle(shop: ShareableShop, t: T): string {
  return shop.verified ? `${shop.name} ✓ ${t("share.verified")}` : shop.name;
}

/** The share sheet's text (the link travels separately as `url`). */
export function shopShareText(
  shop: ShareableShop,
  opts: { t: T; locale: string; categoryLabel?: string | null; openText?: string | null },
): string {
  const { t, locale, categoryLabel, openText } = opts;
  return [
    shopShareTitle(shop, t),
    [categoryLabel, shop.city || shop.province].filter(Boolean).join(" · "),
    openText ?? "",
    ratingLine(shop, t, locale),
    productsLine(shop, t, locale),
  ]
    .filter((l) => l.trim().length > 0)
    .join("\n");
}

/** og:description — one line: category · city · products · rating. */
export function shopShareDescription(shop: ShareableShop, opts: { t: T; locale: string; categoryLabel?: string | null }): string {
  const { t, locale, categoryLabel } = opts;
  return [categoryLabel, shop.city || shop.province, productsLine(shop, t, locale), ratingLine(shop, t, locale)]
    .filter((l) => !!l && String(l).trim().length > 0)
    .join(" · ");
}
