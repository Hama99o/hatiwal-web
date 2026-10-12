import type { Metadata } from "next";
import { SITE_URL } from "@/lib/env";
import { routing } from "@/i18n/routing";

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
  for (const loc of routing.locales) languages[loc] = url(loc);
  // x-default is the language/locale-agnostic fallback Google serves when no
  // hreflang matches the user — we point it at the default locale (en).
  languages["x-default"] = url(routing.defaultLocale);
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
      url: `${SITE_URL}/${routing.defaultLocale}`,
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
