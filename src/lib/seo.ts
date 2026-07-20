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
