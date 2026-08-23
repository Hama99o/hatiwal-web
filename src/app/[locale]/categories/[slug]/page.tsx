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
import { CategoryBadge } from "@/components/shared/category-badge";
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

  // withCounts: this is where the hub's "+N more" lands, so every sibling chip
  // has to state whether there is anything behind it. Same one request.
  // 60s to match the hub — the two pages must not disagree about a count.
  const categories = await safe(
    getCategories({ revalidate: 60, withCounts: true }),
    [],
  );
  const category = findCategoryBySlug(categories, slug);
  if (!category) notFound();

  // No revalidate: listing payloads carry short-lived signed image URLs that
  // 404 if cached. Category page is force-dynamic, so fetch fresh.
  const { items } = await safe(
    getListings({ categoryId: category.id, pageSize: 24 }),
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
  // "You are here" first, then the siblings with stock, then the empty ones —
  // so the row leads with the chips worth clicking instead of burying them.
  // .sort() is stable, so equal counts keep Rails' `position` order.
  const chips: Category[] = [
    ...(subcategories.length ? subcategories : (parent?.subcategories ?? [])),
  ].sort((a, b) => {
    if (a.slug === slug) return -1;
    if (b.slug === slug) return 1;
    return (b.activeListingsCount ?? 0) - (a.activeListingsCount ?? 0);
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {parent && (
        <Link
          href={`/categories/${parent.slug}`}
          // min-h-11 + the negative inline start margin: a 44px tap target (the
          // DESIGN_SYSTEM minimum, same as mobile's back affordance) without the
          // text shifting away from the heading below it.
          className="-ms-2 mb-1 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft className="size-4 shrink-0 rtl:-scale-x-100" aria-hidden />
          {/* Clamped: a long localized parent name must not wrap the link into
              a paragraph above the heading. */}
          <span className="line-clamp-1">{categoryName(parent, locale)}</span>
        </Link>
      )}
      <h1 className="text-2xl font-bold break-words">
        {category.icon ? `${category.icon} ` : ""}
        {name}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("categoriesPage.allIn", { category: name })}
      </p>

      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((sub) => {
            const isCurrent = sub.slug === slug;
            const subCount = sub.activeListingsCount ?? 0;
            return (
              <CategoryBadge
                key={sub.id}
                category={sub}
                // The chip for the page you are already on is not a link.
                asLink={!isCurrent}
                current={isCurrent}
                size="touch"
                tone={
                  isCurrent ? "active" : subCount > 0 ? "default" : "empty"
                }
                count={subCount}
              />
            );
          })}
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
