import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin, PackageOpen } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";
import { getListings, EMPTY_LISTINGS } from "@/lib/api/listings";
import { getCategories } from "@/lib/api/categories";
import { safe } from "@/lib/api/safe";
import { getProvinceName } from "@/lib/provinces";
import { CITY_RADIUS_KM, CITY_SLUGS, cityBazaarHref, getCity } from "@/lib/cities";
import { ListingGrid } from "@/components/shared/listing-grid";
import { EmptyState } from "@/components/shared/empty-state";
import { CategoryBadge } from "@/components/shared/category-badge";
import { Button } from "@/components/ui/button";

// City landing page (docs/SEO.md): what is for sale around one city, the zone
// link into the Bazaar, popular categories, and the sell guide. Fresh per
// request like every listing page: the cards carry short-lived signed photo
// URLs (see the home page note). An unknown city is a real 404.
export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; city: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, city: slug } = await params;
  const city = getCity(slug);
  if (!city) return {};
  const t = await getTranslations({ locale, namespace: "cities" });
  const name = t(`names.${city.slug}`);
  const alternates = localizedAlternates(locale, `/cities/${city.slug}`);
  const title = t("metaTitle", { city: name });
  const description = t("metaDescription", { city: name });
  return {
    title,
    description,
    alternates,
    openGraph: { title, description, url: alternates.canonical as string, type: "website" },
  };
}

export default async function CityPage({ params }: { params: Params }) {
  const { locale, city: slug } = await params;
  const city = getCity(slug);
  if (!city) notFound();
  setRequestLocale(locale);
  const t = await getTranslations();
  const name = t(`cities.names.${city.slug}`);

  const [{ items }, categories] = await Promise.all([
    safe(
      getListings({
        latitude: city.province.lat,
        longitude: city.province.lng,
        radius: CITY_RADIUS_KM,
        sort: "newest",
        pageSize: 12,
      }),
      EMPTY_LISTINGS,
    ),
    safe(getCategories({ revalidate: 600, withCounts: true }), []),
  ]);
  // Popular = the most stocked top-level categories, site-wide (per-city
  // counts do not exist in the API). Empty ones are left out: a link to a page
  // that says "nothing here" is a dead end.
  const popular = categories
    .filter((c) => (c.activeListingsCount ?? 0) > 0)
    .sort((a, b) => (b.activeListingsCount ?? 0) - (a.activeListingsCount ?? 0))
    .slice(0, 8);
  const bazaarHref = cityBazaarHref(city);

  return (
    <div data-testid="city-page">
      <div className="border-b bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
          <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
            <MapPin className="size-4" aria-hidden />
            {name}
          </p>
          <h1 className="mt-2 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t("cities.title", { city: name })}
          </h1>
          <p className="mt-3 max-w-2xl text-pretty text-lg text-muted-foreground">
            {t("cities.intro", { city: name, province: getProvinceName(city.province, locale) })}
          </p>
          <Button asChild className="mt-6">
            <Link href={bazaarHref}>{t("cities.seeAll", { city: name })}</Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-10 px-4 py-10">
        <section aria-labelledby="city-near">
          <h2 id="city-near" className="text-xl font-bold">
            {t("cities.nearTitle", { city: name })}
          </h2>
          <div className="mt-4">
            {items.length > 0 ? (
              <ListingGrid listings={items} priorityCount={4} />
            ) : (
              <EmptyState
                icon={PackageOpen}
                title={t("cities.empty", { city: name })}
                action={{ label: t("cities.emptyAction"), href: "/bazaar" }}
              />
            )}
          </div>
        </section>

        {popular.length > 0 && (
          <section aria-labelledby="city-popular">
            <h2 id="city-popular" className="text-xl font-bold">
              {t("cities.popular")}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {popular.map((c) => (
                <CategoryBadge key={c.id} category={c} asLink size="touch" count={c.activeListingsCount} />
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="city-sell" className="rounded-xl border bg-card p-5">
          <h2 id="city-sell" className="text-lg font-semibold">
            {t("cities.sellTitle", { city: name })}
          </h2>
          <p className="mt-1 text-muted-foreground">{t("cities.sellBody")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/how-to-sell">{t("cities.sellCta")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/buy-safely">{t("guides.buy.title")}</Link>
            </Button>
          </div>
        </section>

        <nav aria-labelledby="city-others">
          <h2 id="city-others" className="text-lg font-semibold">
            {t("cities.otherCities")}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {CITY_SLUGS.filter((s) => s !== city.slug).map((s) => (
              <li key={s}>
                <Button asChild variant="outline">
                  <Link href={`/cities/${s}`}>{t(`cities.names.${s}`)}</Link>
                </Button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
