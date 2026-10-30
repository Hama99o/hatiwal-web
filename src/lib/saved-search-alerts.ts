import type { SavedSearch, SavedSearchInput } from "@/lib/api/saved-searches";
import type { Category } from "@/lib/types";
import type { BrowseFilters } from "@/components/browse/filters";

/**
 * Saved-search alerts (hatiwal-api docs/SAVED_SEARCH_ALERTS.md): what a saved
 * search stores for the filters on screen, and whether one already exists —
 * the results banner then updates that row instead of creating a twin.
 */
type CriteriaFilters = Pick<BrowseFilters, "q" | "categorySlug" | "priceMin" | "priceMax" | "lat" | "lng" | "radius">;

const num = (value: string) => (value ? Number(value) : undefined);

export function searchCriteria(filters: CriteriaFilters, flat: Category[]): SavedSearchInput {
  return {
    categoryId: flat.find((c) => c.slug === filters.categorySlug)?.id,
    priceMin: num(filters.priceMin),
    priceMax: num(filters.priceMax),
    latitude: num(filters.lat),
    longitude: num(filters.lng),
    radius: num(filters.radius),
    query: filters.q.trim() || undefined,
  };
}

const same = (a: unknown, b: unknown) => (a ?? null) === (b ?? null);
const keyword = (q: string | null | undefined) => q?.trim().toLowerCase() || null;

/** The saved row IS this search: same category, prices, place and keyword. */
export function sameSearch(saved: SavedSearch, criteria: SavedSearchInput): boolean {
  return (
    same(saved.categoryId, criteria.categoryId) &&
    same(saved.priceMin, criteria.priceMin) &&
    same(saved.priceMax, criteria.priceMax) &&
    same(saved.latitude, criteria.latitude) &&
    same(saved.longitude, criteria.longitude) &&
    same(saved.radius, criteria.radius) &&
    keyword(saved.query) === keyword(criteria.query)
  );
}
