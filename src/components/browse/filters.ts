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
}

export const DEFAULT_FILTERS: BrowseFilters = {
  q: "",
  categorySlug: "",
  condition: "",
  sort: "newest",
  priceMin: "",
  priceMax: "",
};

const SORTS: ListingSort[] = ["newest", "oldest", "price_asc", "price_desc"];

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
  };
}

/** Serialize filters to a URL search string (omitting defaults). */
export function filtersToSearchString(f: BrowseFilters): string {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.categorySlug) sp.set("category", f.categorySlug);
  if (f.condition) sp.set("condition", f.condition);
  if (f.sort && f.sort !== "newest") sp.set("sort", f.sort);
  if (f.priceMin) sp.set("min", f.priceMin);
  if (f.priceMax) sp.set("max", f.priceMax);
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
  };
}

export function hasActiveFilters(f: BrowseFilters): boolean {
  return Boolean(
    f.q ||
      f.categorySlug ||
      f.condition ||
      f.priceMin ||
      f.priceMax ||
      f.sort !== "newest",
  );
}
