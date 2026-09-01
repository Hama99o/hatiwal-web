import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AlertTriangle, LayoutGrid } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCategories, categoryName } from "@/lib/api/categories";
import { localizedAlternates } from "@/lib/seo";
import { EmptyState } from "@/components/shared/empty-state";
import {
  CategoryBadge,
  categoryBadgeVariants,
} from "@/components/shared/category-badge";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/types";

// One minute: the counts are the whole point of this page, and a buyer who just
// published (or sold) an item should not be told the category is empty for the
// next ten. Still cached hard enough that the hub never costs a query per view.
export const revalidate = 60;

/** Subcategory chips shown inline on a hub card before overflowing to "+N more". */
const MAX_VISIBLE_SUBCATEGORIES = 4;

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
  // active_listings_count (a single GROUP BY that rolls subcategory listings up
  // into their parent) *and* the nested subcategories with their own counts, so
  // there is never a per-category count/children fetch. Mirrors mobile's
  // Categories screen (categoriesAPI.getCategoriesWithCounts).
  //
  // Not `safe()`: a failed fetch and a genuinely empty marketplace need
  // different copy, so the failure is kept distinguishable (null).
  let categories: Category[] | null = null;
  try {
    categories = await getCategories({ revalidate, withCounts: true });
  } catch {
    categories = null;
  }

  if (!categories) {
    return (
      <HubShell title={t("categoriesPage.title")}>
        <EmptyState
          icon={AlertTriangle}
          title={t("common.errorTitle")}
          description={t("common.errorDescription")}
          action={{ label: t("nav.browse"), href: "/bazaar" }}
        />
      </HubShell>
    );
  }

  if (categories.length === 0) {
    return (
      <HubShell title={t("categoriesPage.title")}>
        <EmptyState
          icon={LayoutGrid}
          title={t("categoriesPage.emptyTitle")}
          description={t("categoriesPage.emptyDescription")}
        />
      </HubShell>
    );
  }

  // Categories with inventory first (stable — keeps Rails' `position` order
  // inside each group) so buyers land on the cards that actually have items.
  const sorted = [
    ...categories.filter((c) => (c.activeListingsCount ?? 0) > 0),
    ...categories.filter((c) => (c.activeListingsCount ?? 0) === 0),
  ];

  return (
    <HubShell title={t("categoriesPage.title")}>
      {/* items-start: cards size to their own content, so a card without
          subcategories isn't stretched to match a tall sibling. */}
      {/* NO `items-start` here — that was the bug.
          Cards carry 0 to 4 subcategory chips, each on its own line at a quarter
          of a 5xl container, so their heights vary a lot. With `items-start` a
          short card sits at the TOP of a row whose height is set by the tallest
          card in it, and the difference shows as a HOLE in the page:
          "Property / Services / Other" beside a four-chip "Sports & Outdoors"
          left most of a row blank, which reads as broken rather than designed.
          Stretching instead (the grid default) plus `h-full` on the card makes
          each card fill its row, so leftover space sits INSIDE a card as padding.
          This also keeps source order: the hub is sorted by listing count, and a
          masonry / `columns-*` layout would reorder it column-major and destroy
          that left-to-right reading. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {sorted.map((category) => {
          const name = categoryName(category, locale);
          // Rolls up its subcategories — see the controller's hub_listing_counts.
          const count = category.activeListingsCount ?? 0;
          const isEmpty = count === 0;

          // Children are ranked by stock (biggest first) and capped, but never
          // filtered out: sellers file almost everything on the top-level
          // category, so a "stocked children only" rule renders NOTHING on a
          // real marketplace — the drill-down would be invisible even though
          // every parent has children. An empty child still ships as a chip,
          // marked empty (dashed, count spelled out for screen readers) so the
          // buyer sees the dead end before clicking it instead of after.
          // Overflow stays one click away behind "+N more".
          // .sort() is stable, so equal counts keep Rails' `position` order.
          const subcategories = category.subcategories ?? [];
          const visibleSubcategories = [...subcategories]
            .sort(
              (a, b) =>
                (b.activeListingsCount ?? 0) - (a.activeListingsCount ?? 0),
            )
            .slice(0, MAX_VISIBLE_SUBCATEGORIES);
          const hiddenSubcategoryCount =
            subcategories.length - visibleSubcategories.length;

          return (
            <div
              key={category.id}
              data-testid="category-card"
              className={cn(
                "flex h-full flex-col rounded-lg border bg-card p-4 transition-shadow hover:shadow-md",
                // Empty categories are de-emphasised (dashed, muted) so buyers
                // stop tapping into a category with nothing to buy. No opacity:
                // it would drop the count line below the contrast minimum.
                isEmpty && "border-dashed bg-muted/30 shadow-none hover:shadow-none",
              )}
            >
              <Link
                href={`/categories/${category.slug}`}
                aria-label={`${name} — ${
                  isEmpty
                    ? t("categoriesPage.noListings")
                    : t("listing.shopCount", { count })
                }`}
                className="flex flex-col items-center gap-1.5 rounded-md text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {category.icon ? (
                  <span className="text-3xl leading-none" aria-hidden>
                    {category.icon}
                  </span>
                ) : (
                  <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <LayoutGrid className="size-5" aria-hidden />
                  </span>
                )}
                {/* Clamped: a long localized name must not push the count line
                    out of alignment with its neighbours in the grid. */}
                <span className="line-clamp-2 text-sm font-medium text-foreground">
                  {name}
                </span>
                <span
                  className={cn(
                    "text-xs",
                    isEmpty
                      ? "text-muted-foreground"
                      : "font-medium text-primary",
                  )}
                >
                  {isEmpty
                    ? t("categoriesPage.noListings")
                    : t("listing.shopCount", { count })}
                </span>
              </Link>

              {/* Drill-down. Rendered whenever the category HAS children —
                  their stock is irrelevant to whether the taxonomy is
                  reachable. */}
              {subcategories.length > 0 && (
                <div className="mt-3 border-t pt-3">
                  <p className="mb-1.5 text-center text-xs font-medium text-muted-foreground">
                    {t("categoriesPage.subcategories")}
                  </p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {visibleSubcategories.map((sub) => {
                      const subCount = sub.activeListingsCount ?? 0;
                      return (
                        <CategoryBadge
                          key={sub.id}
                          category={sub}
                          asLink
                          size="touch"
                          // Same treatment as the drill-down page's chip row:
                          // stocked chips solid, empty ones dashed + muted.
                          tone={subCount > 0 ? "default" : "empty"}
                          count={subCount}
                        />
                      );
                    })}
                    {hiddenSubcategoryCount > 0 && (
                      <Link
                        href={`/categories/${category.slug}`}
                        // "+1 more" says nothing on its own out of context, and
                        // this link lands on the parent page — name it that.
                        aria-label={t("categoriesPage.allIn", {
                          category: name,
                        })}
                        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        {/* Same chip recipe as CategoryBadge — one source of truth. */}
                        <span
                          className={categoryBadgeVariants({ size: "touch" })}
                        >
                          {t("categoriesPage.moreSubcategories", {
                            count: hiddenSubcategoryCount,
                          })}
                        </span>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </HubShell>
  );
}

/** Page chrome shared by the data, empty, and error states. */
function HubShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <div className="mt-6">{children}</div>
    </div>
  );
}
