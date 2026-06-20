import { ArrowRight, Search } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ListingGrid } from "@/components/shared/listing-grid";
import { EmptyState } from "@/components/shared/empty-state";
import { getListings, EMPTY_LISTINGS } from "@/lib/api/listings";
import { getCategories, categoryName } from "@/lib/api/categories";
import { safe } from "@/lib/api/safe";

// Render fresh per request so short-lived Active Storage image URLs are valid
// on load (stale ISR HTML served expired urls → broken thumbnails).
export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const { items: listings } = await safe(
    getListings({ pageSize: 15, sort: "newest", status: "active" }),
    EMPTY_LISTINGS,
  );
  const categories = await safe(getCategories({ revalidate: 600 }), []);

  return (
    <div>
      {/* Hero — left-aligned, with an in-page search (web-native GET form). */}
      <section className="border-b bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:py-20 lg:py-24">
          <div className="max-w-2xl">
            <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              {t("home.hero.title")}
            </h1>
            <p className="mt-4 text-pretty text-lg text-muted-foreground">
              {t("home.hero.subtitle")}
            </p>
            <form
              action={`/${locale}/browse`}
              method="get"
              role="search"
              className="mt-8 flex max-w-xl gap-2"
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
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-14 px-4 py-12">
        {categories.length > 0 && (
          <section className="space-y-5">
            <h2 className="text-2xl font-bold tracking-tight">
              {t("home.categoriesHeading")}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {categories.slice(0, 12).map((category) => (
                <Link
                  key={category.id}
                  href={`/categories/${category.slug}`}
                  className="group flex flex-col items-center justify-center gap-2 rounded-xl border bg-card p-5 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <span className="text-3xl transition-transform group-hover:scale-110">
                    {category.icon ?? "📦"}
                  </span>
                  <span className="text-sm font-medium leading-tight">
                    {categoryName(category, locale)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-5">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-bold tracking-tight">
              {t("home.recent")}
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/browse">
                {t("home.viewAll")}
                <ArrowRight className="size-4 rtl:-scale-x-100" />
              </Link>
            </Button>
          </div>
          {listings.length > 0 ? (
            <ListingGrid listings={listings} priorityCount={6} />
          ) : (
            <EmptyState
              icon={Search}
              title={t("browse.empty.title")}
              description={t("browse.empty.description")}
              action={{ label: t("home.hero.browseCta"), href: "/browse" }}
            />
          )}
        </section>
      </div>
    </div>
  );
}
