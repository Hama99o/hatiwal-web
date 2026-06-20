"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { getListings } from "@/lib/api/listings";
import { categoryName } from "@/lib/api/categories";
import {
  LISTING_CONDITIONS,
  type Category,
  type ListingSort,
  type ListingsResult,
} from "@/lib/types";
import {
  type BrowseFilters,
  filtersToQuery,
  filtersToSearchString,
  hasActiveFilters,
} from "./filters";
import {
  ListingGrid,
  ListingGridSkeleton,
} from "@/components/shared/listing-grid";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchField } from "@/components/shared/search-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface BrowseClientProps {
  initialResult: ListingsResult | null;
  initialFilters: BrowseFilters;
  categories: Category[];
}

const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-card text-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

export function BrowseClient({
  initialResult,
  initialFilters,
  categories,
}: BrowseClientProps) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [filters, setFilters] = useState<BrowseFilters>(initialFilters);
  const [searchInput, setSearchInput] = useState(initialFilters.q);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    router.replace(`${pathname}${filtersToSearchString(filters)}`, {
      scroll: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const query = useInfiniteQuery({
    queryKey: ["listings", filters],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      getListings(filtersToQuery(filters, categories, pageParam)),
    getNextPageParam: (last) => last.pagination.nextPage ?? undefined,
    initialData: initialResult
      ? { pages: [initialResult], pageParams: [1] }
      : undefined,
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );
  const totalCount = query.data?.pages[0]?.pagination.totalCount;

  const update = useCallback(
    (patch: Partial<BrowseFilters>) =>
      setFilters((prev) => ({ ...prev, ...patch })),
    [],
  );

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    update({ q: searchInput.trim() });
  };

  const reset = () => {
    setSearchInput("");
    setFilters({
      q: "",
      categorySlug: "",
      condition: "",
      sort: "newest",
      priceMin: "",
      priceMax: "",
    });
  };

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !query.hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !query.isFetchingNextPage) {
          query.fetchNextPage();
        }
      },
      { rootMargin: "600px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [query.hasNextPage, query.isFetchingNextPage, query]);

  const filtersActive = hasActiveFilters(filters);

  const sidebar = (
    <div className="space-y-6">
      <form onSubmit={submitSearch} role="search">
        <SearchField
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t("browse.searchPlaceholder")}
          aria-label={t("browse.searchPlaceholder")}
        />
      </form>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          {t("nav.categories")}
        </h3>
        <ul className="space-y-0.5">
          <li>
            <button
              type="button"
              onClick={() => update({ categorySlug: "" })}
              className={cn(
                "w-full rounded-md px-2 py-1.5 text-start text-sm transition-colors hover:bg-accent",
                !filters.categorySlug && "font-semibold text-primary",
              )}
            >
              {t("browse.allCategories")}
            </button>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => update({ categorySlug: c.slug })}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm transition-colors hover:bg-accent",
                  filters.categorySlug === c.slug &&
                    "font-semibold text-primary",
                )}
              >
                {c.icon ? <span aria-hidden>{c.icon}</span> : null}
                <span className="truncate">{categoryName(c, locale)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          {t("listing.condition.label")}
        </h3>
        <div className="flex flex-wrap gap-2">
          {LISTING_CONDITIONS.map((c) => (
            <Chip
              key={c}
              active={filters.condition === c}
              onClick={() =>
                update({ condition: filters.condition === c ? "" : c })
              }
            >
              {t(`listing.condition.${c}`)}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          {t("common.price")}
        </h3>
        <div className="flex items-center gap-2">
          <Input
            inputMode="numeric"
            value={filters.priceMin}
            onChange={(e) =>
              update({ priceMin: e.target.value.replace(/\D/g, "") })
            }
            placeholder={t("browse.priceMin")}
            className="h-9"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            inputMode="numeric"
            value={filters.priceMax}
            onChange={(e) =>
              update({ priceMax: e.target.value.replace(/\D/g, "") })
            }
            placeholder={t("browse.priceMax")}
            className="h-9"
          />
        </div>
      </div>

      {filtersActive && (
        <Button variant="ghost" size="sm" onClick={reset}>
          <X className="size-4" />
          {t("browse.resetFilters")}
        </Button>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-8">
        {/* Sidebar (desktop) / collapsible (mobile) */}
        <aside className="lg:sticky lg:top-20 lg:h-fit">
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
            >
              <SlidersHorizontal className="size-4" />
              {t("browse.filters")}
            </Button>
          </div>
          <div className={cn(showFilters ? "block" : "hidden", "lg:block")}>
            {sidebar}
          </div>
        </aside>

        {/* Results */}
        <main className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {typeof totalCount === "number"
                ? t("listing.shopCount", { count: totalCount })
                : " "}
            </p>
            <label className="flex items-center gap-2 text-sm">
              <span className="hidden text-muted-foreground sm:inline">
                {t("browse.sort.label")}
              </span>
              <select
                value={filters.sort}
                onChange={(e) =>
                  update({ sort: e.target.value as ListingSort })
                }
                className={SELECT_CLASS}
              >
                <option value="newest">{t("browse.sort.newest")}</option>
                <option value="oldest">{t("browse.sort.oldest")}</option>
                <option value="price_asc">{t("browse.sort.priceAsc")}</option>
                <option value="price_desc">{t("browse.sort.priceDesc")}</option>
              </select>
            </label>
          </div>

          {query.isError ? (
            <EmptyState
              icon={X}
              title={t("common.error")}
              description={t("browse.empty.description")}
            />
          ) : query.isPending ? (
            <ListingGridSkeleton count={12} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={SlidersHorizontal}
              title={t("browse.empty.title")}
              description={t("browse.empty.description")}
            />
          ) : (
            <>
              <ListingGrid listings={items} priorityCount={6} />
              <div ref={sentinelRef} className="h-1" />
              {query.hasNextPage && (
                <div className="flex justify-center py-6">
                  <Button
                    variant="outline"
                    onClick={() => query.fetchNextPage()}
                    disabled={query.isFetchingNextPage}
                  >
                    {query.isFetchingNextPage
                      ? t("common.loading")
                      : t("home.viewAll")}
                  </Button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
