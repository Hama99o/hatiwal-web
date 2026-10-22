import { test, expect } from "@playwright/test";
import { isFacetedSearch, mobileAppJsonLd, BAZAAR_FACET_KEYS } from "../src/lib/seo";
import { filtersFromParams, filtersToSearchString } from "../src/components/browse/filters";
import { CITY_RADIUS_KM, CITY_SLUGS, cityBazaarHref, getCity } from "../src/lib/cities";
import { APP_STORE_URL, GOOGLE_PLAY_URL } from "../src/lib/app-links";

/**
 * Unit checks for the SEO helpers (docs/SEO.md, seo-1). Pure functions, no
 * page and no server: Playwright is this repo's only runner, so they live here
 * beside the HTTP-level checks in seo-1.spec.ts.
 */

test.describe("isFacetedSearch: which Bazaar URLs leave the index", () => {
  test("search and every filter are facets", () => {
    for (const key of BAZAAR_FACET_KEYS) {
      expect(isFacetedSearch({ [key]: "1" }), key).toBe(true);
    }
    expect(isFacetedSearch({ q: ["phone", "x"] })).toBe(true);
  });

  test("sort, page, tracking params and empty values are not", () => {
    expect(isFacetedSearch({})).toBe(false);
    expect(isFacetedSearch({ sort: "newest", page: "3", utm_source: "tiktok", fbclid: "x" })).toBe(false);
    expect(isFacetedSearch({ q: "", category: "  " })).toBe(false);
  });

  test("the facet list is exactly the filter URL vocabulary of filters.ts", () => {
    // Every key filtersToSearchString can write (with every filter set), minus sort.
    const all = filtersFromParams({
      q: "a", category: "stays", condition: "good", sort: "newest", min: "1", max: "2",
      lat: "1", lng: "2", radius: "5", active_sellers: "1", shops: "1", guests: "2", amenities: "wifi",
    });
    const written = [...new URLSearchParams(filtersToSearchString(all).slice(1)).keys()].filter((k) => k !== "sort");
    expect([...written].sort()).toEqual([...BAZAAR_FACET_KEYS].sort());
  });
});

test.describe("mobileAppJsonLd: a valid schema.org MobileApplication", () => {
  const ld = mobileAppJsonLd("ps", {
    description: "d",
    downloadUrls: [GOOGLE_PLAY_URL, APP_STORE_URL],
  }) as Record<string, unknown>;

  test("required shape", () => {
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("MobileApplication");
    expect(ld.name).toBe("Hatiwal");
    expect(ld.alternateName).toEqual(["هټیوال", "هتیوال"]);
    expect(ld.operatingSystem).toBe("Android, iOS");
    expect(ld.applicationCategory).toBe("ShoppingApplication");
    expect(ld.inLanguage).toEqual(["en", "ps", "fa"]);
    expect(ld.downloadUrl).toEqual([GOOGLE_PLAY_URL, APP_STORE_URL]);
    expect(ld.installUrl).toEqual([GOOGLE_PLAY_URL, APP_STORE_URL]);
    expect(ld.offers).toEqual({ "@type": "Offer", price: 0, priceCurrency: "USD" });
    expect(String(ld.url)).toMatch(/^https?:\/\/[^/]+\/ps\/download$/);
    expect(String(ld.image)).toMatch(/^https?:\/\/[^/]+\/icon-512\.png$/);
  });

  test("no invented ratings or reviews", () => {
    expect(ld).not.toHaveProperty("aggregateRating");
    expect(ld).not.toHaveProperty("review");
  });

  test("every URL in it is absolute", () => {
    const urls = JSON.stringify(ld).match(/"(?:https?:)?\/\/[^"]*"|"\/[^"]*"/g) ?? [];
    for (const u of urls) expect(u, u).toMatch(/^"https?:\/\//);
  });
});

test.describe("cities", () => {
  test("each city maps to its province capital, and unknown slugs to nothing", () => {
    expect(CITY_SLUGS).toEqual(["kabul", "herat", "kandahar", "mazar-i-sharif", "jalalabad"]);
    expect(getCity("mazar-i-sharif")?.province.value).toBe("Balkh");
    expect(getCity("jalalabad")?.province.value).toBe("Nangarhar");
    expect(getCity("london")).toBeUndefined();
    expect(getCity("toString")).toBeUndefined();
  });

  test("the Bazaar link is the zone filter the Bazaar reads", () => {
    const href = cityBazaarHref(getCity("kabul")!);
    const f = filtersFromParams(new URLSearchParams(href.split("?")[1]));
    expect(href.startsWith("/bazaar?")).toBe(true);
    expect([f.lat, f.lng, f.radius]).toEqual(["34.5553", "69.2075", String(CITY_RADIUS_KM)]);
  });
});
