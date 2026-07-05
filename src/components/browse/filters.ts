import { findCategoryBySlug } from "@/lib/api/categories";
import type { Category, ListingSort } from "@/lib/types";
import type { ListingsQuery } from "@/lib/api/listings";

/**
 * Browse filter state — the single shared definition used by BOTH the server
 * page (for SSR/SEO of the first results page) and the client island (for
 * interactive filtering + infinite scroll). Keeps URL ⇄ state ⇄ API in sync
 * without duplicating the mapping logic in two places.
 */
export interface BrowseFilters {
  q: string;
  categorySlug: string;
  condition: string;
  sort: ListingSort;
  priceMin: string;
  priceMax: string;
  /** Location filter — set together (lat+lng), radius in km. */
  lat: string;
  lng: string;
  radius: string;
  /**
   * Proximity fix for the "Nearest first" sort — acquired from the browser
   * Geolocation API and kept SEPARATE from the manual location/zone filter
   * above (lat/lng/radius) so the two never fight. Ephemeral + client-only:
   * never serialized to the URL, so a reload or shared link cleanly falls back
   * to the default sort. Mirrors mobile's separate `nearestCoords` state.
   */
  nearestLat: string;
  nearestLng: string;
  /**
   * Trust filter — only listings whose seller signed in within the last 7 days
   * (Rails `seller_active_days=7`). Mirrors mobile's Active sellers chip
   * (BrowseHeader). Persisted to the URL as `active_sellers=1`.
   */
  activeSellers: boolean;
}

export const DEFAULT_FILTERS: BrowseFilters = {
  q: "",
  categorySlug: "",
  condition: "",
  sort: "newest",
  priceMin: "",
  priceMax: "",
  lat: "",
  lng: "",
  radius: "",
  nearestLat: "",
  nearestLng: "",
  activeSellers: false,
};

/** Default search radius (km) when a location is picked without an explicit radius. */
export const DEFAULT_RADIUS_KM = 10;

// "nearest" is intentionally omitted: it is an ephemeral, browser-only sort
// that depends on a live Geolocation fix, so it is never read from (or written
// to) the URL. A direct `?sort=nearest` link therefore falls back to "newest".
const SORTS: ListingSort[] = [
  "newest",
  "oldest",
  "price_asc",
  "price_desc",
  "most_viewed",
];

type ParamSource = Record<string, string | undefined> | URLSearchParams;

function read(source: ParamSource, key: string): string {
  if (source instanceof URLSearchParams) return source.get(key) ?? "";
  return source[key] ?? "";
}

export function filtersFromParams(source: ParamSource): BrowseFilters {
  const sortRaw = read(source, "sort");
  const sort = SORTS.includes(sortRaw as ListingSort)
    ? (sortRaw as ListingSort)
    : "newest";
  return {
    q: read(source, "q"),
    categorySlug: read(source, "category"),
    condition: read(source, "condition"),
    sort,
    priceMin: read(source, "min"),
    priceMax: read(source, "max"),
    lat: read(source, "lat"),
    lng: read(source, "lng"),
    radius: read(source, "radius"),
    // Nearest coords are client-only (live GPS fix) — never sourced from the URL.
    nearestLat: "",
    nearestLng: "",
    activeSellers: read(source, "active_sellers") === "1",
  };
}

/** Serialize filters to a URL search string (omitting defaults). */
export function filtersToSearchString(f: BrowseFilters): string {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.categorySlug) sp.set("category", f.categorySlug);
  if (f.condition) sp.set("condition", f.condition);
  // "nearest" is client-only and never persisted to the URL (see SORTS above),
  // so a reload/shared link falls back to the default order.
  if (f.sort && f.sort !== "newest" && f.sort !== "nearest")
    sp.set("sort", f.sort);
  if (f.priceMin) sp.set("min", f.priceMin);
  if (f.priceMax) sp.set("max", f.priceMax);
  if (f.lat && f.lng) {
    sp.set("lat", f.lat);
    sp.set("lng", f.lng);
    if (f.radius) sp.set("radius", f.radius);
  }
  if (f.activeSellers) sp.set("active_sellers", "1");
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Map UI filter state to the Rails listings query (resolving slug → id). */
export function filtersToQuery(
  f: BrowseFilters,
  categories: Category[],
  page = 1,
  pageSize = 24,
): ListingsQuery {
  const category = f.categorySlug
    ? findCategoryBySlug(categories, f.categorySlug)
    : undefined;
  const isNearest = f.sort === "nearest";
  const hasNearest = Boolean(f.nearestLat && f.nearestLng);
  const hasLocation = Boolean(f.lat && f.lng);
  return {
    page,
    pageSize,
    status: "active",
    search: f.q || undefined,
    categoryId: category?.id,
    condition: f.condition || undefined,
    sort: f.sort,
    priceMin: f.priceMin ? Number(f.priceMin) : undefined,
    priceMax: f.priceMax ? Number(f.priceMax) : undefined,
    // "nearest" takes over the location params with its own GPS fix and drops
    // the radius (nearest across the whole feed); otherwise the manual zone
    // filter applies. Kept independent so clearing "nearest" restores the
    // manual zone untouched. Mirrors mobile's Browse fetcher.
    latitude: isNearest
      ? hasNearest
        ? Number(f.nearestLat)
        : undefined
      : hasLocation
        ? Number(f.lat)
        : undefined,
    longitude: isNearest
      ? hasNearest
        ? Number(f.nearestLng)
        : undefined
      : hasLocation
        ? Number(f.lng)
        : undefined,
    radius: isNearest
      ? undefined
      : hasLocation
        ? Number(f.radius) || DEFAULT_RADIUS_KM
        : undefined,
    // Trust filter: 7 days matches mobile's Active sellers chip and the Rails
    // `seller_active_within` scope default the product spec settled on.
    sellerActiveDays: f.activeSellers ? 7 : undefined,
  };
}

/**
 * Number of meaningful filters currently set — category, condition, price
 * min/max, location (lat present), and the search query. Deliberately
 * EXCLUDES sort and the client-only view mode: changing how results are
 * ordered/displayed isn't "filtering". Mirrors mobile's active-filter count
 * (TASK-C481) so the two clients surface the same number.
 */
export function activeFilterCount(f: BrowseFilters): number {
  return [
    f.categorySlug,
    f.condition,
    f.priceMin,
    f.priceMax,
    f.lat,
    f.q,
    f.activeSellers,
  ].filter(Boolean).length;
}

export function hasActiveFilters(f: BrowseFilters): boolean {
  return Boolean(
    f.q ||
      f.categorySlug ||
      f.condition ||
      f.priceMin ||
      f.priceMax ||
      f.lat ||
      f.activeSellers ||
      f.sort !== "newest",
  );
}
