"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  LayoutGrid,
  List,
  Loader2,
  MapPin,
  SlidersHorizontal,
  UserCheck,
  X,
} from "lucide-react";
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
  DEFAULT_FILTERS,
  DEFAULT_RADIUS_KM,
  activeFilterCount,
  filtersToQuery,
  filtersToSearchString,
  hasActiveFilters,
} from "./filters";
import {
  ListingGrid,
  ListingGridSkeleton,
  type ListingViewMode,
} from "@/components/shared/listing-grid";
import { EmptyState } from "@/components/shared/empty-state";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { SearchField } from "@/components/shared/search-field";
import { SavedSearches } from "./saved-searches";
import { LocationMap } from "@/components/map/location-map";
import { Badge } from "@/components/ui/badge";
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

// Client-only view-mode preference (not in the URL), same ephemeral pattern as
// the nearest-sort coords. Mirrors mobile's `browse-view-mode` store.
const VIEW_MODE_KEY = "hatiwal.bazaar.viewMode";

function readViewMode(): ListingViewMode {
  if (typeof window === "undefined") return "grid";
  const saved = window.localStorage.getItem(VIEW_MODE_KEY);
  return saved === "list" ? "list" : "grid";
}

function Chip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
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
  // True while the "Nearest first" sort is acquiring a browser Geolocation fix.
  const [nearestLoading, setNearestLoading] = useState(false);

  // Grid/list view mode — client-only preference persisted to localStorage.
  // SSR-safe: always start "grid" so server and first client render match, then
  // hydrate the saved choice on mount (avoids a hydration mismatch).
  const [viewMode, setViewMode] = useState<ListingViewMode>("grid");
  useEffect(() => {
    setViewMode(readViewMode());
  }, []);
  const changeViewMode = useCallback((mode: ListingViewMode) => {
    setViewMode(mode);
    try {
      window.localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      /* localStorage unavailable (private mode) — keep in-memory only */
    }
  }, []);

  useEffect(() => {
    router.replace(`${pathname}${filtersToSearchString(filters)}`, {
      scroll: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Adopt filters that change from OUTSIDE this island — the navbar search
  // pushes `/bazaar?q=…`, and browser back/forward rewrites the URL. The server
  // re-renders with new `initialFilters`, but this client instance persists, so
  // without re-syncing its state would stay stale (URL updates, results don't).
  // The echo of our OWN edits serializes identically, so we skip it — a debounced
  // keystroke never clobbers the text being typed.
  const externalKey = filtersToSearchString(initialFilters);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  useEffect(() => {
    if (filtersToSearchString(filtersRef.current) === externalKey) return;
    setFilters(initialFilters);
    setSearchInput(initialFilters.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalKey]);

  // Debounced live search: typing filters the results after a short pause —
  // no Enter required. (Enter via submitSearch still applies immediately.)
  useEffect(() => {
    const next = searchInput.trim();
    const id = setTimeout(() => {
      setFilters((prev) => (prev.q === next ? prev : { ...prev, q: next }));
    }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

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
    setFilters({ ...DEFAULT_FILTERS });
  };

  // "Use my location" — set the zone center to the browser's geolocation.
  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) =>
      update({
        lat: String(pos.coords.latitude),
        lng: String(pos.coords.longitude),
        radius: filters.radius || String(DEFAULT_RADIUS_KM),
      }),
    );
  };

  // "Nearest first" sort — acquires a fresh browser Geolocation fix, then sets
  // sort=nearest with those coords (kept separate from the manual zone filter).
  // Denial/failure shows a friendly toast and leaves the current sort unchanged,
  // so the <select> snaps back to its prior value — a clean fallback to default.
  // Mirrors mobile's handleToggleNearest (Browse.tsx).
  const acquireNearest = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error(t("browse.locationUnsupported"));
      return;
    }
    setNearestLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNearestLoading(false);
        update({
          sort: "nearest",
          nearestLat: String(pos.coords.latitude),
          nearestLng: String(pos.coords.longitude),
        });
      },
      (err) => {
        setNearestLoading(false);
        const key =
          err.code === err.PERMISSION_DENIED
            ? "browse.locationDenied"
            : err.code === err.TIMEOUT
              ? "browse.locationTimeout"
              : "browse.locationUnavailable";
        toast.error(t(key));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, [t, update]);

  // Sort change: "Nearest first" triggers the geolocation request; any other
  // option applies immediately and drops the GPS fix so it isn't left dangling.
  const handleSortChange = useCallback(
    (value: ListingSort) => {
      if (value === "nearest") {
        acquireNearest();
      } else {
        update({ sort: value, nearestLat: "", nearestLng: "" });
      }
    },
    [acquireNearest, update],
  );

  const RADIUS_PRESETS = [5, 10, 25, 50];

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
  // Count of meaningful filters (category, condition, price, location, query)
  // — excludes sort + view mode. Drives the toggle badge and the summary pill.
  const filterCount = activeFilterCount(filters);

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
        <ul className="max-h-64 space-y-0.5 overflow-y-auto pe-1 [scrollbar-width:thin]">
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

      {/* Active sellers — trust filter, mirrors mobile's BrowseHeader chip:
          only listings whose seller signed in within the last 7 days
          (seller_active_days=7). Persisted to the URL as active_sellers=1. */}
      <div>
        <div className="flex flex-wrap gap-2">
          <Chip
            active={filters.activeSellers}
            onClick={() => update({ activeSellers: !filters.activeSellers })}
            title={t("browse.activeSellersHint")}
          >
            <span className="inline-flex items-center gap-1.5">
              <UserCheck className="size-3.5" aria-hidden />
              {t("browse.activeSellers")}
              {filters.activeSellers && (
                <X className="size-3" aria-hidden />
              )}
            </span>
          </Chip>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("browse.activeSellersHint")}
        </p>
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

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            {t("browse.location")}
          </h3>
          {filters.lat && (
            <button
              type="button"
              onClick={() => update({ lat: "", lng: "", radius: "" })}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
              {t("browse.resetFilters")}
            </button>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mb-2 w-full"
          onClick={useMyLocation}
        >
          <MapPin className="size-4" />
          {t("listing.form.useMyLocation")}
        </Button>

        <LocationMap
          editable
          lat={filters.lat ? Number(filters.lat) : null}
          lng={filters.lng ? Number(filters.lng) : null}
          radiusKm={
            filters.lat ? Number(filters.radius) || DEFAULT_RADIUS_KM : undefined
          }
          onChange={(la, ln) =>
            update({
              lat: String(la),
              lng: String(ln),
              radius: filters.radius || String(DEFAULT_RADIUS_KM),
            })
          }
          className="h-40"
        />

        {filters.lat ? (
          <div className="mt-3 space-y-2">
            {/* Zone presets (like mobile) */}
            <div className="flex flex-wrap gap-1.5">
              {RADIUS_PRESETS.map((km) => {
                const active = (Number(filters.radius) || DEFAULT_RADIUS_KM) === km;
                return (
                  <Chip
                    key={km}
                    active={active}
                    onClick={() => update({ radius: String(km) })}
                  >
                    {km} {t("browse.km")}
                  </Chip>
                );
              })}
            </div>
            {/* Fine-tune slider */}
            <label className="flex justify-between text-xs text-muted-foreground">
              <span>{t("browse.distance")}</span>
              <span>
                {filters.radius || DEFAULT_RADIUS_KM} {t("browse.km")}
              </span>
            </label>
            <input
              type="range"
              min={1}
              max={100}
              value={Number(filters.radius) || DEFAULT_RADIUS_KM}
              onChange={(e) => update({ radius: e.target.value })}
              className="w-full accent-primary"
            />
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("listing.form.tapToSetLocation")}
          </p>
        )}
      </div>

      <SavedSearches
        filters={filters}
        categories={categories}
        onApply={(patch) => update(patch)}
      />

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
        <aside className="lg:sticky lg:top-20">
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
            >
              <SlidersHorizontal className="size-4" />
              {t("browse.filters")}
              {filterCount > 0 && (
                <Badge className="min-w-5 justify-center px-1.5 py-0">
                  {filterCount}
                </Badge>
              )}
            </Button>
          </div>
          {/* Independent-scroll panel: filters scroll inside this card on
              desktop (capped to viewport height), so the page scrolls the
              results and the bottom filters stay reachable. */}
          <div
            className={cn(
              showFilters ? "block" : "hidden",
              "rounded-xl border bg-card p-4 lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:[scrollbar-width:thin]",
            )}
          >
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
            <div className="flex items-center gap-2">
              {nearestLoading && (
                <span
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                  role="status"
                >
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  <span className="hidden sm:inline">
                    {t("browse.nearestLocationLoading")}
                  </span>
                </span>
              )}
              <label className="flex items-center gap-2 text-sm">
                <span className="hidden text-muted-foreground sm:inline">
                  {t("browse.sort.label")}
                </span>
                <select
                  value={filters.sort}
                  onChange={(e) =>
                    handleSortChange(e.target.value as ListingSort)
                  }
                  disabled={nearestLoading}
                  className={cn(SELECT_CLASS, nearestLoading && "opacity-70")}
                >
                  <option value="newest">{t("browse.sort.newest")}</option>
                  <option value="oldest">{t("browse.sort.oldest")}</option>
                  <option value="price_asc">{t("browse.sort.priceAsc")}</option>
                  <option value="price_desc">
                    {t("browse.sort.priceDesc")}
                  </option>
                  <option value="most_viewed">
                    {t("browse.sort.mostViewed")}
                  </option>
                  <option value="nearest">{t("browse.sort.nearest")}</option>
                </select>
              </label>
              <SegmentedControl<ListingViewMode>
                iconOnly
                ariaLabel={t("browse.viewModeLabel")}
                value={viewMode}
                onChange={changeViewMode}
                options={[
                  { value: "grid", label: t("browse.viewGrid"), icon: LayoutGrid },
                  { value: "list", label: t("browse.viewList"), icon: List },
                ]}
              />
            </div>
          </div>

          {/* Active-filter summary pill — makes it obvious results are
              filtered and offers a one-tap clear-all, on mobile AND desktop
              (the sidebar's reset button is easy to miss). Counts only
              meaningful filters, never sort/view mode. Mirrors mobile C481. */}
          {filterCount > 0 && (
            <div className="mb-4">
              <div className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full border bg-card px-3 py-1.5">
                <span className="text-sm text-muted-foreground">
                  {t("browse.filtersActive", { count: filterCount })}
                </span>
                <span aria-hidden className="text-border">
                  ·
                </span>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                >
                  <X className="size-3.5" aria-hidden />
                  {t("browse.clearAllFilters")}
                </button>
              </div>
            </div>
          )}

          {query.isError ? (
            <EmptyState
              icon={X}
              title={t("common.error")}
              description={t("browse.empty.description")}
            />
          ) : query.isPending ? (
            <ListingGridSkeleton count={12} viewMode={viewMode} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={SlidersHorizontal}
              title={t("browse.empty.title")}
              description={t("browse.empty.description")}
            />
          ) : (
            <>
              <ListingGrid
                listings={items}
                viewMode={viewMode}
                priorityCount={6}
              />
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
