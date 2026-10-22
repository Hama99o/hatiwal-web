import type { Metadata } from "next";
import { SITE_URL } from "@/lib/env";
import { DEFAULT_LOCALE, LOCALES } from "@/i18n/locales";

/**
 * Build the canonical + hreflang alternates block for a localized page.
 *
 * Every page exists at /en, /ps and /fa. Google needs an hreflang set that
 * links each language variant to the others (plus x-default) so the three
 * trilingual URLs are understood as ONE page in three languages — not as
 * duplicate content. Without this, the whole point of the web client (getting
 * listings indexed) is undercut on a multilingual site. `canonical` points at
 * the current locale's own URL.
 *
 * @param locale the current locale (en | ps | fa)
 * @param path   the path AFTER the locale segment, with a leading slash and no
 *               trailing slash (e.g. "/listings/133"); "" or "/" for the home page.
 */
export function localizedAlternates(
  locale: string,
  path: string = "",
): NonNullable<Metadata["alternates"]> {
  const clean = path === "/" ? "" : path;
  const url = (loc: string) => `${SITE_URL}/${loc}${clean}`;
  const languages: Record<string, string> = {};
  for (const loc of LOCALES) languages[loc] = url(loc);
  // x-default is the language/locale-agnostic fallback Google serves when no
  // hreflang matches the user — we point it at the default locale (en).
  languages["x-default"] = url(DEFAULT_LOCALE);
  return {
    canonical: url(locale),
    languages,
  };
}

/**
 * The brand as a search engine should read it in each language: the native
 * spelling first, the Latin one in brackets (ps "هټیوال (Hatiwal)", fa
 * "هتیوال (Hatiwal)"), plain "Hatiwal" in English. Search engines took bare
 * "Hatiwal" for a misspelling of the surname "Hatwal"; a page that carries
 * both spellings is what ties them together. `nativeName` is home.brandName.
 */
export function brandLabel(nativeName: string): string {
  return nativeName === "Hatiwal" ? "Hatiwal" : `${nativeName} (Hatiwal)`;
}

/** The Pashto and Dari spellings (owner, 2026-10-05: ps with ټ, fa with ت). */
export const BRAND_ALTERNATE_NAMES = ["هټیوال", "هتیوال"] as const;

/**
 * JSON for a <script type="application/ld+json">. `<` is escaped so text a
 * user typed (a listing title with "</script>") cannot close the tag early.
 */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/**
 * Home page structured data: who Hatiwal is (Organization) and what the site
 * is (WebSite + its search). Only links that exist go in `sameAs` — the two
 * store listings; add social profiles here once they exist, never before.
 */
export function homeJsonLd(
  locale: string,
  opts: { description: string; sameAs: readonly string[] },
): object[] {
  const org = `${SITE_URL}/#organization`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": org,
      name: "Hatiwal",
      alternateName: [...BRAND_ALTERNATE_NAMES],
      url: `${SITE_URL}/${DEFAULT_LOCALE}`,
      logo: `${SITE_URL}/icon-512.png`,
      description: opts.description,
      areaServed: { "@type": "Country", name: "Afghanistan" },
      sameAs: [...opts.sameAs],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Hatiwal",
      alternateName: [...BRAND_ALTERNATE_NAMES],
      url: `${SITE_URL}/${locale}`,
      inLanguage: locale,
      publisher: { "@id": org },
      // The home page's own search form is a GET to /<locale>/bazaar?q=…
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/${locale}/bazaar?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ];
}

/** Pages a search engine should neither index nor show: sign-in, inboxes, owner tools. */
export const NOINDEX: NonNullable<Metadata["robots"]> = { index: false, follow: true };

/**
 * The Hatiwal app itself, as schema.org `MobileApplication` (a
 * SoftwareApplication), on the home and /download pages. Facts only: free,
 * iOS + Android, the two store links, the three languages the app ships in.
 *
 * No `aggregateRating` and no `review`: we do not have store ratings in hand,
 * and made-up ones are a manual-action risk. Google shows its software-app
 * rich result only WITH a rating, so this markup is valid but earns no star
 * snippet until real ratings exist (docs/SEO.md). Store screenshots are not in
 * this repo, so `image` is the app icon and there is no `screenshot`.
 */
export function mobileAppJsonLd(
  locale: string,
  opts: { description: string; downloadUrls: readonly string[] },
): object {
  return {
    "@context": "https://schema.org",
    "@type": "MobileApplication",
    "@id": `${SITE_URL}/#app`,
    name: "Hatiwal",
    alternateName: [...BRAND_ALTERNATE_NAMES],
    description: opts.description,
    url: `${SITE_URL}/${locale}/download`,
    image: `${SITE_URL}/icon-512.png`,
    operatingSystem: "Android, iOS",
    applicationCategory: "ShoppingApplication",
    inLanguage: [...LOCALES],
    downloadUrl: [...opts.downloadUrls],
    installUrl: [...opts.downloadUrls],
    offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
    publisher: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "Hatiwal" },
  };
}

/**
 * Query parameters that change WHAT the Bazaar lists (search, category,
 * condition, price, place, trust/shop/stay chips). Google's guidance for
 * internal search results and faceted filters is to keep them out of the index
 * (noindex, follow): there is one such URL per combination, each one a thin
 * near-copy of the Bazaar, and when they declared `canonical = /bazaar` Google
 * overruled it ("Google chose different canonical than user", 17 URLs,
 * Search Console 2026-10-16). `follow` keeps the listings they link to
 * discoverable. They carry NO canonical: noindex plus a canonical to another
 * page are contradicting signals.
 *
 * Parameters that only re-order or page the same set (`sort`, `page`) or that
 * are tracking (`utm_*`, `fbclid`…) change nothing a searcher would land on:
 * those keep the canonical to the clean /bazaar and stay indexable (the SSR
 * seed is always page 1).
 *
 * BAZAAR_FACET_KEYS is the URL vocabulary of src/components/browse/filters.ts.
 */
export const BAZAAR_FACET_KEYS = [
  "q",
  "category",
  "condition",
  "min",
  "max",
  "lat",
  "lng",
  "radius",
  "active_sellers",
  "shops",
  "guests",
  "amenities",
] as const;

export function isFacetedSearch(
  sp: Record<string, string | string[] | undefined>,
): boolean {
  return BAZAAR_FACET_KEYS.some((k) => {
    const v = sp[k];
    const first = Array.isArray(v) ? v[0] : v;
    return typeof first === "string" && first.trim() !== "";
  });
}
