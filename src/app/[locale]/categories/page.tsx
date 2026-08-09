import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCategories, categoryName } from "@/lib/api/categories";
import { localizedAlternates } from "@/lib/seo";
import { safe } from "@/lib/api/safe";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/types";

export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "categoriesPage" });
  return {
    title: t("title"),
    alternates: localizedAlternates(locale, "/categories"),
  };
}

export default async function CategoriesIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  // ONE request for the whole hub: `withCounts` asks Rails for
  // active_listings_count (single GROUP BY) *and* the nested subcategories, so
  // there is never a per-category count/children fetch. Mirrors mobile's
  // Categories screen (categoriesAPI.getCategoriesWithCounts).
  const categories = await safe(
    getCategories({ revalidate: 600, withCounts: true }),
    [],
  );

  // Categories with inventory first (stable — keeps Rails' `position` order
  // inside each group) so buyers land on the cards that actually have items.
  const sorted = [
    ...categories.filter((c) => (c.activeListingsCount ?? 0) > 0),
    ...categories.filter((c) => (c.activeListingsCount ?? 0) === 0),
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t("categoriesPage.title")}</h1>
      {/* items-start: cards size to their own content, so a card without
          subcategories isn't stretched to match a tall sibling. */}
      <div className="mt-6 grid grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {sorted.map((category) => {
          const name = categoryName(category, locale);
          const count = category.activeListingsCount ?? 0;
          const isEmpty = count === 0;
          const subcategories: Category[] = category.subcategories ?? [];

          return (
            <div
              key={category.id}
              className={cn(
                "flex flex-col rounded-lg border bg-card p-4 transition-shadow hover:shadow-md",
                // Empty categories are de-emphasised (dashed, muted) so buyers
                // stop tapping into a category with nothing to buy.
                isEmpty && "border-dashed bg-muted/30",
              )}
            >
              <Link
                href={`/categories/${category.slug}`}
                aria-label={t("categoriesPage.allIn", { category: name })}
                className={cn(
                  "flex flex-col items-center gap-1.5 text-center",
                  isEmpty && "opacity-60",
                )}
              >
                <span className="text-3xl" aria-hidden>
                  {category.icon ?? "📦"}
                </span>
                <span className="text-sm font-medium">{name}</span>
                <span
                  className={cn(
                    "text-xs",
                    isEmpty
                      ? "text-muted-foreground"
                      : "font-medium text-primary",
                  )}
                >
                  {isEmpty
                    ? t("categoriesPage.empty")
                    : t("listing.shopCount", { count })}
                </span>
              </Link>

              {subcategories.length > 0 && (
                <div className="mt-3 border-t pt-3">
                  <p className="mb-1.5 text-center text-[11px] font-medium text-muted-foreground">
                    {t("categoriesPage.subcategories")}
                  </p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {subcategories.map((sub) => (
                      <Link
                        key={sub.id}
                        href={`/categories/${sub.slug}`}
                        className="rounded-full border bg-muted px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent"
                      >
                        {sub.icon ? `${sub.icon} ` : ""}
                        {categoryName(sub, locale)}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
