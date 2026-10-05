import { findCategoryBySlug } from "@/lib/api/categories";
import type { Category, ListingSort } from "@/lib/types";
import type { ListingsQuery } from "@/lib/api/listings";

/**
 * The Bazaar's sort: a Rails sort, or "home" — the DEFAULT, "items near you"
 * (LOC-1, hatiwal-mobile/docs/USER_LOCATION.md). "home" is client-side naming
 * only: it is sent as sort=nearest around the viewer's home location (own
 * address → guess → Kabul, from me.location), and never written to the URL.
 * Mirrors mobile, where the default (sort = null) does the same.
 */
export type BrowseSort = ListingSort | "home";

/** Kabul — where "near you" centres for a guest, for the SSR seed, and for anyone the API places nowhere. */
export const DEFAULT_HOME_POINT = { latitude: 34.5553, longitude: 69.2075 } as const;

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
  sort: BrowseSort;
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
  /** SHOP-1: the "Shops" chip — only listings posted as a shop (`seller_type=shop`). URL: `shops=1`. */
  shops: boolean;
}

export const DEFAULT_FILTERS: BrowseFilters = {
  q: "",
  categorySlug: "",
  condition: "",
  sort: "home",
  priceMin: "",
  priceMax: "",
  lat: "",
  lng: "",
  radius: "",
  nearestLat: "",
  nearestLng: "",
  activeSellers: false,
  shops: false,
};

/** Default search radius (km) when a location is picked without an explicit radius. */
export const DEFAULT_RADIUS_KM = 10;

// "nearest" is intentionally omitted: it is an ephemeral, browser-only sort
// that depends on a live Geolocation fix, so it is never read from (or written
// to) the URL. A direct `?sort=nearest` link therefore falls back to the
// default, "home". "newest" IS in the URL now that it is no longer the default.
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
  const sort: BrowseSort = SORTS.includes(sortRaw as ListingSort)
    ? (sortRaw as ListingSort)
    : "home";
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
    shops: read(source, "shops") === "1",
  };
}

/** Serialize filters to a URL search string (omitting defaults). */
export function filtersToSearchString(f: BrowseFilters): string {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.categorySlug) sp.set("category", f.categorySlug);
  if (f.condition) sp.set("condition", f.condition);
  // "nearest" is client-only and never persisted to the URL (see SORTS above),
  // and "home" is the default, so a reload/shared link falls back to it.
  if (f.sort && f.sort !== "home" && f.sort !== "nearest")
    sp.set("sort", f.sort);
  if (f.priceMin) sp.set("min", f.priceMin);
  if (f.priceMax) sp.set("max", f.priceMax);
  if (f.lat && f.lng) {
    sp.set("lat", f.lat);
    sp.set("lng", f.lng);
    if (f.radius) sp.set("radius", f.radius);
  }
  if (f.activeSellers) sp.set("active_sellers", "1");
  if (f.shops) sp.set("shops", "1");
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/**
 * Map UI filter state to the Rails listings query (resolving slug → id).
 * `home` is the viewer's home point for the default "home" order — Kabul when
 * omitted (the anonymous SSR seed, a guest).
 */
export function filtersToQuery(
  f: BrowseFilters,
  categories: Category[],
  page = 1,
  pageSize = 24,
  home: { latitude: number; longitude: number } = DEFAULT_HOME_POINT,
  // LOC-1 "All Afghanistan": the default order is the whole country, newest
  // first — no point and no sort sent.
  allCountry = false,
): ListingsQuery {
  const category = f.categorySlug
    ? findCategoryBySlug(categories, f.categorySlug)
    : undefined;
  const isNearest = f.sort === "nearest";
  const hasNearest = Boolean(f.nearestLat && f.nearestLng);
  const hasLocation = Boolean(f.lat && f.lng);
  // "home" with no zone filter = nearest around home. With a zone filter the
  // zone wins and the server's default order applies inside it.
  const isDefault = f.sort === "home" && !hasLocation;
  const isHome = isDefault && !allCountry;
  return {
    page,
    pageSize,
    // No `status`: GET /listings is browsable-only by definition
    // (active.not_expired.not_removed), so the server never read this.
    search: f.q || undefined,
    categoryId: category?.id,
    condition: f.condition || undefined,
    sort: isHome ? "nearest" : f.sort === "home" ? undefined : f.sort,
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
        : isHome
          ? home.latitude
          : undefined,
    longitude: isNearest
      ? hasNearest
        ? Number(f.nearestLng)
        : undefined
      : hasLocation
        ? Number(f.lng)
        : isHome
          ? home.longitude
          : undefined,
    radius: isNearest
      ? undefined
      : hasLocation
        ? Number(f.radius) || DEFAULT_RADIUS_KM
        : undefined,
    // Trust filter: 7 days matches mobile's Active sellers chip and the Rails
    // `seller_active_within` scope default the product spec settled on.
    sellerActiveDays: f.activeSellers ? 7 : undefined,
    sellerType: f.shops ? "shop" : undefined,
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
  // "nearest" sort takes over location with its own GPS fix and drops the
  // manual zone (see filtersToQuery), so the manual lat isn't an active filter
  // then — don't count it or the "Filters active (N)" pill overstates.
  const manualLocation = f.sort !== "nearest" ? f.lat : undefined;
  return [
    f.categorySlug,
    f.condition,
    f.priceMin,
    f.priceMax,
    manualLocation,
    f.q,
    f.activeSellers,
    f.shops,
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
      f.shops ||
      f.sort !== "home",
  );
}
