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

export const revalidate = 600;

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
    categories = await getCategories({ revalidate: 600, withCounts: true });
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
      <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {sorted.map((category) => {
          const name = categoryName(category, locale);
          // Rolls up its subcategories — see the controller's hub_listing_counts.
          const count = category.activeListingsCount ?? 0;
          const isEmpty = count === 0;

          // Only children that actually have stock get an inline chip, biggest
          // first — a chip promising a subcategory that turns out to be empty is
          // the dead end this hub exists to prevent. Every other child stays one
          // click away behind "+N more" (the drill-down lists them all, with
          // their counts).
          const subcategories = category.subcategories ?? [];
          const visibleSubcategories = subcategories
            .filter((s) => (s.activeListingsCount ?? 0) > 0)
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
              className={cn(
                "flex flex-col rounded-lg border bg-card p-4 transition-shadow hover:shadow-md",
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
                <span className="text-sm font-medium text-foreground">
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

              {/* Drill-down. Skipped entirely when the whole branch is empty —
                  the card already says so, and a row of dead chips adds noise. */}
              {!isEmpty && subcategories.length > 0 && (
                <div className="mt-3 border-t pt-3">
                  <p className="mb-1.5 text-center text-[11px] font-medium text-muted-foreground">
                    {t("categoriesPage.subcategories")}
                  </p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {visibleSubcategories.map((sub) => (
                      <CategoryBadge
                        key={sub.id}
                        category={sub}
                        asLink
                        size="touch"
                        count={sub.activeListingsCount ?? 0}
                      />
                    ))}
                    {hiddenSubcategoryCount > 0 && (
                      <Link
                        href={`/categories/${category.slug}`}
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
