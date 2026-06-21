import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PackageOpen } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  getCategories,
  findCategoryBySlug,
  categoryName,
} from "@/lib/api/categories";
import { getListings, EMPTY_LISTINGS } from "@/lib/api/listings";
import { safe } from "@/lib/api/safe";
import { ListingGrid } from "@/components/shared/listing-grid";
import { EmptyState } from "@/components/shared/empty-state";

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
  if (!category) return { title: "Hatiwal" };
  return { title: categoryName(category, locale) };
}

export default async function CategoryPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const categories = await safe(getCategories({ revalidate: 600 }), []);
  const category = findCategoryBySlug(categories, slug);
  if (!category) notFound();

  const { items } = await safe(
    getListings(
      { categoryId: category.id, status: "active", pageSize: 24 },
      { revalidate: 60 },
    ),
    EMPTY_LISTINGS,
  );
  const name = categoryName(category, locale);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold">
        {category.icon ? `${category.icon} ` : ""}
        {name}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("categoriesPage.allIn", { category: name })}
      </p>
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
