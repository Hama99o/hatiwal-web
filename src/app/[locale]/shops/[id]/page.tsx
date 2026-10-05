import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { smartAppBanner } from "@/lib/app-links";
import { localizedAlternates } from "@/lib/seo";
import { ApiError } from "@/lib/api/client";
import { getShop, type Shop } from "@/lib/api/shops";
import { categoryName } from "@/lib/api/categories";
import { SHOP_DAYS } from "@/lib/shop-hours";
import { ShopPageView } from "@/components/shops/shop-page-view";

// SHOP-1 shop page (docs/SHOPS.md "The shop page", "Share my shop"). Server-
// rendered for SEO + link cards: og:title = shop name, og:image = logo (or
// cover, or the site card), og:description = category · city; JSON-LD
// LocalBusiness. iPhone: Smart App Banner → the shop in the app.
export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; id: string }>;

async function loadShop(id: string): Promise<Shop | null> {
  try {
    return await getShop(id);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) return null;
    throw e;
  }
}

function categoryLabel(shop: Shop, locale: string): string | null {
  return shop.category ? categoryName(shop.category, locale) : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, id } = await params;
  const shop = await loadShop(id).catch(() => null);
  const t = await getTranslations({ locale, namespace: "shops" });
  if (!shop) return { title: t("badge") };
  const description = [categoryLabel(shop, locale), shop.city ?? shop.province].filter(Boolean).join(" · ");
  return {
    title: shop.name,
    description,
    alternates: localizedAlternates(locale, `/shops/${id}`),
    itunes: smartAppBanner({ kind: "shop", id }),
    openGraph: {
      // The short link people share (always https, docs/SHOPS.md "Share my shop").
      url: shop.shareUrl && /^https:\/\//i.test(shop.shareUrl) ? shop.shareUrl : `https://hatiwal.com/s/${shop.id}`,
      title: shop.name,
      description,
      images: [shop.logoUrl ?? shop.coverUrl ?? "/opengraph-image.png"],
      type: "website",
    },
  };
}

export default async function ShopPage({ params }: { params: Params }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const shop = await loadShop(id);
  if (!shop || shop.status === "suspended") notFound();

  const openingHours = SHOP_DAYS.flatMap((day) =>
    (shop.hours[day] ?? []).map(([opens, closes]) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: { sat: "Saturday", sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday" }[day],
      opens,
      closes,
    })),
  );
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: shop.name,
    ...(shop.description && { description: shop.description }),
    ...(shop.logoUrl && { image: shop.logoUrl }),
    address: { "@type": "PostalAddress", streetAddress: shop.addressLine, addressLocality: shop.city ?? undefined, addressRegion: shop.province ?? undefined, addressCountry: "AF" },
    geo: { "@type": "GeoCoordinates", latitude: Number(shop.latitude), longitude: Number(shop.longitude) },
    ...(openingHours.length && { openingHoursSpecification: openingHours }),
    ...(shop.phone && { telephone: shop.phone }),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <ShopPageView shop={shop} categoryLabel={categoryLabel(shop, locale)} />
    </>
  );
}
