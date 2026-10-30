import { test, expect } from "@playwright/test";
import { searchCriteria, sameSearch } from "../src/lib/saved-search-alerts";
import type { SavedSearch } from "../src/lib/api/saved-searches";
import type { Category } from "../src/lib/types";

/**
 * Saved-search alerts — "is the search on screen already saved?" decides
 * whether the results banner's switch updates a row or creates one. Unit checks,
 * no page (Playwright is this repo's only runner).
 */
const phones = { id: 101, slug: "phones", subcategories: [] } as unknown as Category;
const flat = [phones];
const filters = { q: "iphone", categorySlug: "phones", priceMin: "", priceMax: "50000", lat: "", lng: "", radius: "" };

function saved(overrides: Partial<SavedSearch> = {}): SavedSearch {
  return {
    id: 1, location: null, categoryId: 101, categoryName: null, priceMin: null, priceMax: 50000,
    latitude: null, longitude: null, radius: null, locationBased: false, createdAt: "", lastViewedAt: null,
    newMatchesCount: 0, query: "iphone", alert: false, ...overrides,
  };
}

test("the criteria are what the API stores: category id, numbers, the keyword", () => {
  expect(searchCriteria(filters, flat)).toEqual({
    categoryId: 101, priceMin: undefined, priceMax: 50000, latitude: undefined, longitude: undefined,
    radius: undefined, query: "iphone",
  });
});

test("the same filters + keyword is the same search; empty and null are equal", () => {
  const criteria = searchCriteria(filters, flat);
  expect(sameSearch(saved(), criteria)).toBe(true);
  expect(sameSearch(saved({ query: "samsung" }), criteria)).toBe(false);
  expect(sameSearch(saved({ priceMax: 40000 }), criteria)).toBe(false);
  expect(sameSearch(saved({ query: null }), searchCriteria({ ...filters, q: "" }, flat))).toBe(true);
});

test("the keyword is compared case- and space-insensitively", () => {
  expect(sameSearch(saved({ query: "iphone" }), searchCriteria({ ...filters, q: "  iPhone " }, flat))).toBe(true);
});
