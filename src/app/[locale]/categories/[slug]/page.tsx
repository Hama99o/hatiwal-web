import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, PackageOpen } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  getCategories,
  findCategoryBySlug,
  categoryName,
} from "@/lib/api/categories";
import { getListings, EMPTY_LISTINGS } from "@/lib/api/listings";
import { localizedAlternates } from "@/lib/seo";
import { safe } from "@/lib/api/safe";
import { Link } from "@/i18n/navigation";
import { ListingGrid } from "@/components/shared/listing-grid";
import { EmptyState } from "@/components/shared/empty-state";
import type { Category } from "@/lib/types";

// Fresh per request so signed image URLs are valid on load (see home page note).
export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const categories = await safe(getCategories(), []);
  const category = findCategoryBySlug(categories, slug);
  const alternates = localizedAlternates(locale, `/categories/${slug}`);
  if (!category) return { title: "Hatiwal", alternates };
  return { title: categoryName(category, locale), alternates };
}

export default async function CategoryPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const categories = await safe(getCategories({ revalidate: 600 }), []);
  const category = findCategoryBySlug(categories, slug);
  if (!category) notFound();

  // No revalidate: listing payloads carry short-lived signed image URLs that
  // 404 if cached. Category page is force-dynamic, so fetch fresh.
  const { items } = await safe(
    getListings({ categoryId: category.id, status: "active", pageSize: 24 }),
    EMPTY_LISTINGS,
  );
  const name = categoryName(category, locale);

  // Drill-down: a top-level category's subcategories, or (for a subcategory)
  // its parent for a breadcrumb + its siblings to switch between them.
  const subcategories: Category[] = category.subcategories ?? [];
  const parent = subcategories.length
    ? undefined
    : categories.find((c) =>
        c.subcategories?.some((s) => s.slug === slug),
      );
  const chips: Category[] = subcategories.length
    ? subcategories
    : (parent?.subcategories ?? []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {parent && (
        <Link
          href={`/categories/${parent.slug}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-4 rtl:-scale-x-100" />
          {categoryName(parent, locale)}
        </Link>
      )}
      <h1 className="text-2xl font-bold">
        {category.icon ? `${category.icon} ` : ""}
        {name}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("categoriesPage.allIn", { category: name })}
      </p>

      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((sub) => (
            <Link
              key={sub.id}
              href={`/categories/${sub.slug}`}
              className={
                sub.slug === slug
                  ? "rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                  : "rounded-full border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
              }
            >
              {sub.icon ? `${sub.icon} ` : ""}
              {categoryName(sub, locale)}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6">
        {items.length > 0 ? (
          <ListingGrid listings={items} priorityCount={5} />
        ) : (
          <EmptyState
            icon={PackageOpen}
            title={t("categoriesPage.empty")}
            action={{ label: t("nav.browse"), href: "/bazaar" }}
          />
        )}
      </div>
    </div>
  );
}
