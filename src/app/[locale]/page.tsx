import type { Metadata } from "next";
import { Plus, Search } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ListingRail } from "@/components/shared/listing-rail";
import { EmptyState } from "@/components/shared/empty-state";
import { getListings, EMPTY_LISTINGS } from "@/lib/api/listings";
import { getCategories } from "@/lib/api/categories";
import { CategoryPills } from "@/components/shared/category-pills";
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
      {/* Hero — a brand band, not a page-wide gradient (visual-system.md §4):
          the lapis tile the logo sits on, with a soft gold glow — Depop / Airbnb
          banner cards. Still compact, so the first listings are on the first
          phone screen (docs/design/home.md); phones get two actions instead of
          a second search (the header has one). */}
      <section className="mx-auto max-w-7xl px-4 pt-4 sm:pt-6">
        <div className="relative isolate overflow-hidden rounded-3xl bg-brand-lapis px-5 py-7 text-white shadow-card sm:px-10 sm:py-12 lg:px-14 lg:py-16">
          <div
            aria-hidden
            className="absolute -end-24 -top-28 -z-10 size-80 rounded-full bg-brand-gold/25 blur-3xl sm:size-[28rem]"
          />
          <div
            aria-hidden
            className="absolute -bottom-32 -start-20 -z-10 size-72 rounded-full bg-primary/40 blur-3xl"
          />
          <div className="max-w-2xl">
            <h1 className="text-balance text-[1.875rem] font-extrabold leading-[1.1] tracking-tight sm:text-display lg:text-[3.25rem]">
              {t("home.hero.title")}
            </h1>
            <p className="mt-3 max-w-xl text-pretty text-base text-white/80 sm:mt-4 sm:text-lg">
              {t("home.hero.subtitle")}
            </p>
            <form
              action={`/${locale}/bazaar`}
              method="get"
              role="search"
              className="mt-8 hidden max-w-xl items-center gap-2 rounded-full bg-white p-1.5 shadow-pop sm:flex"
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute start-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-500" />
                <input
                  name="q"
                  placeholder={t("nav.searchPlaceholder")}
                  aria-label={t("nav.searchPlaceholder")}
                  className="h-11 w-full rounded-full bg-transparent ps-11 pe-3 text-base text-slate-900 placeholder:text-slate-500 focus-visible:outline-none"
                />
              </div>
              <Button type="submit" size="lg" className="h-11 px-6">
                {t("home.hero.browseCta")}
              </Button>
            </form>
            <div className="mt-6 grid grid-cols-2 gap-2 sm:hidden">
              <Button asChild size="lg" className="h-12 bg-brand-gold text-brand-lapis shadow-none hover:bg-brand-gold/90 dark:hover:bg-brand-gold/90">
                <Link href="/bazaar">{t("home.hero.browseCta")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 border-white/30 bg-white/10 text-white hover:border-white/50 hover:bg-white/15">
                <Link href="/listings/new">
                  <Plus aria-hidden />
                  {t("sidebar.createListing")}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:space-y-12 sm:py-10">
        {/* One pill row (Airtasker / Shop): sideways scroll on phones, wraps on
            desktop — 12 tiles in a 2-column grid used to fill ~700px of a phone. */}
        <CategoryPills
          categories={categories}
          locale={locale}
          heading={t("home.categoriesHeading")}
          viewAllLabel={t("home.viewAll")}
          headingId="home-categories"
        />

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
