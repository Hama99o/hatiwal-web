import type { Metadata } from "next";
import { Plus, Search } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ListingRail } from "@/components/shared/listing-rail";
import { EmptyState } from "@/components/shared/empty-state";
import { getListings, EMPTY_LISTINGS } from "@/lib/api/listings";
import { getCategories, categoryName } from "@/lib/api/categories";
import { safe } from "@/lib/api/safe";
import { APP_STORE_URL, GOOGLE_PLAY_URL } from "@/lib/app-links";
import { brandLabel, homeJsonLd, jsonLdHtml, localizedAlternates } from "@/lib/seo";

// Render fresh per request so short-lived Active Storage image URLs are valid
// on load (stale ISR HTML served expired urls → broken thumbnails).
export const dynamic = "force-dynamic";

/**
 * The home page carries the brand in every language: "Hatiwal — Buy and sell
 * locally in Afghanistan", "هټیوال (Hatiwal) — …", "هتیوال (Hatiwal) — …".
 * It used to be a bare "Hatiwal" on all three, which gave a search engine
 * nothing to tie the name to (see docs/SEO.md).
 */
/**
 * app/opengraph-image.png. Named here because a page that sets its own
 * openGraph replaces the inherited one, file-based image included — without
 * this the home page shared with no picture.
 */
const OG_IMAGE = { url: "/opengraph-image.png", width: 1200, height: 630, type: "image/png" };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  const title = `${brandLabel(t("brandName"))} — ${t("hero.title")}`;
  const description = t("hero.subtitle");
  const alternates = localizedAlternates(locale, "/");
  return {
    // absolute: the layout template would otherwise append a second "— Hatiwal".
    title: { absolute: title },
    description,
    alternates,
    openGraph: {
      siteName: "Hatiwal",
      type: "website",
      url: alternates.canonical as string,
      locale,
      title,
      description,
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE] },
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const { items: listings } = await safe(
    getListings({ pageSize: 15, sort: "newest" }),
    EMPTY_LISTINGS,
  );
  const categories = await safe(getCategories({ revalidate: 600 }), []);

  const jsonLd = homeJsonLd(locale, {
    description: t("home.hero.subtitle"),
    sameAs: [GOOGLE_PLAY_URL, APP_STORE_URL],
  });

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }} />
      {/* Hero — compact, so the first listings are on the first phone screen
          (docs/design/home.md). On phones the header already has a full-width
          search row, so the hero offers two actions instead of a second search. */}
      <section className="border-b bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:py-14 lg:py-20">
          <div className="max-w-2xl">
            <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              {t("home.hero.title")}
            </h1>
            <p className="mt-3 text-pretty text-base text-muted-foreground sm:mt-4 sm:text-lg">
              {t("home.hero.subtitle")}
            </p>
            <form
              action={`/${locale}/bazaar`}
              method="get"
              role="search"
              className="mt-8 hidden max-w-xl gap-2 sm:flex"
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  name="q"
                  placeholder={t("nav.searchPlaceholder")}
                  aria-label={t("nav.searchPlaceholder")}
                  className="h-12 w-full rounded-lg border border-input bg-card ps-11 pe-4 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <Button type="submit" size="lg" className="h-12 px-6">
                {t("home.hero.browseCta")}
              </Button>
            </form>
            <div className="mt-6 grid grid-cols-2 gap-2 sm:hidden">
              <Button asChild size="lg" className="h-12">
                <Link href="/bazaar">{t("home.hero.browseCta")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12">
                <Link href="/listings/new">
                  <Plus aria-hidden />
                  {t("sidebar.createListing")}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-10 px-4 py-8">
        {categories.length > 0 && (
          // One pill row (Airtasker / Shop): sideways scroll on phones, wraps on
          // desktop — 12 tiles in a 2-column grid used to fill ~700px of a phone.
          <section className="space-y-3" aria-labelledby="home-categories">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="home-categories" className="text-xl font-bold tracking-tight sm:text-2xl">
                {t("home.categoriesHeading")}
              </h2>
              <Link href="/categories" className="text-sm font-medium text-primary hover:underline">
                {t("home.viewAll")}
              </Link>
            </div>
            <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              {categories.map((category) => (
                <li key={category.id} className="shrink-0">
                  <Link
                    href={`/categories/${category.slug}`}
                    className="flex h-11 items-center gap-2 rounded-full border bg-card ps-3 pe-4 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span aria-hidden className="text-lg leading-none">
                      {category.icon ?? "📦"}
                    </span>
                    {categoryName(category, locale)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Same shared section as the listing-detail cross-sell rails — heading +
            "view all" + grid live in ONE component (`size="lg"` is the
            page-level typography), with the empty state passed in. */}
        <ListingRail
          size="lg"
          title={t("home.recent")}
          listings={listings}
          viewAllHref="/bazaar"
          viewAllLabel={t("home.viewAll")}
          priorityCount={6}
          empty={
            <EmptyState
              icon={Search}
              title={t("browse.empty.title")}
              description={t("browse.empty.description")}
              action={{ label: t("home.hero.browseCta"), href: "/bazaar" }}
            />
          }
        />
      </div>
    </div>
  );
}
