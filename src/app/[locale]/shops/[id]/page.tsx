import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { smartAppBanner } from "@/lib/app-links";
import { OpenInAppButton } from "@/components/shared/open-in-app-button";
import { localizedAlternates } from "@/lib/seo";
import { ApiError } from "@/lib/api/client";
import { getShop, type Shop } from "@/lib/api/shops";
import { categoryName } from "@/lib/api/categories";
import { SHOP_DAYS } from "@/lib/shop-hours";
import { shopShareDescription, shopShareTitle } from "@/lib/shop-share";
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
  // The link preview carries the shop's details (owner, 2026-10-08): title =
  // name (+ ✓ Verified), description = category · city · products · rating,
  // image = the cover (a wide card in WhatsApp / Telegram), else the logo. The
  // image URL is absolute: Active Storage sends one, and the site card falls
  // back through metadataBase.
  const description = shopShareDescription(shop, { t: t as never, locale, categoryLabel: categoryLabel(shop, locale) });
  const title = shopShareTitle(shop, t as never);
  const image = shop.coverUrl ?? shop.logoUrl ?? "/opengraph-image.png";
  return {
    title,
    description,
    alternates: localizedAlternates(locale, `/shops/${id}`),
    itunes: smartAppBanner({ kind: "shop", id }),
    openGraph: {
      // The short link people share (always https, docs/SHOPS.md "Share my shop").
      url: shop.shareUrl && /^https:\/\//i.test(shop.shareUrl) ? shop.shareUrl : `https://hatiwal.com/s/${shop.id}`,
      title,
      description,
      images: [{ url: image, alt: shop.name }],
      type: "website",
      siteName: "Hatiwal",
      locale,
    },
    twitter: { card: shop.coverUrl ? "summary_large_image" : "summary", title, description, images: [image] },
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
      <div className="mx-auto max-w-5xl px-4 pt-4 md:hidden">
        <OpenInAppButton route={{ kind: "shop", id: shop.id }} />
      </div>
      <ShopPageView shop={shop} categoryLabel={categoryLabel(shop, locale)} />
    </>
  );
}
