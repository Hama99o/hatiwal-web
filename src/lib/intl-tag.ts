/**
 * The ONE routing-tag → `Intl` tag table, and nothing else.
 *
 * `ps` deliberately formats through `fa-AF`, NOT `ps-AF` — the same mapping the
 * mobile app uses (`useLocalization.ts`), so one listing reads the same on both
 * clients. It is also the only tag that works everywhere: V8/Chromium ships no
 * Pashto `Intl` data (`Intl.NumberFormat('ps-AF').resolvedOptions().locale` is
 * `en-US` there), while Node's full ICU has it. With `ps-AF` a Pashto price
 * rendered by a Server Component came out "؋ ۳۰٬۰۰۰" and the very same price
 * rendered by a client island — e.g. the sticky <ListingActionBar> — came out
 * "AFN 30,000" on the same screen (and any component rendered in both places
 * would hydrate mismatched). `fa-AF` shares the script, digits, calendar and the
 * ؋ symbol, and both runtimes have it, so server and browser always agree.
 *
 * It lives in its own module, free of imports, because BOTH consumers need it and
 * they have very different weights:
 *   - `src/lib/format.ts` — the only place prices/dates are formatted; pulls in
 *     `date-fns` + two of its locales.
 *   - `src/i18n/intl-locale-alias.ts` — evaluated at MODULE scope from
 *     `src/i18n/request.ts` and `src/components/providers.tsx` (the root client
 *     component of every page), before anything has rendered.
 * Reading the table from `format.ts` made the second one depend on a date library
 * to look up three strings. (It is not a bundle-size claim: `format.ts` reaches
 * the layout graph on its own merits via `site-header → auth-nav → CountBadge`.
 * It is about the eagerly-installed module having nothing to drag in, and about
 * there being exactly ONE definition of the mapping either side can read.)
 */
export const INTL_TAG: Record<string, string> = {
  en: "en-US",
  ps: "fa-AF",
  fa: "fa-AF",
  // `ur` was MISSING, so every Urdu reader fell through this table's `?? "en-US"`
  // and got English month names — on a locale that is otherwise fully
  // translated. Measured in both runtimes, the same way `ps` was:
  //
  //   Node 18 (full ICU)  ur-PK -> ur-PK, latn, "14 ستمبر، 2026"
  //   Chromium            ur-PK -> ur-PK, latn, "14 ستمبر، 2026"
  //
  // Identical, so `ur-PK` carries none of the server/browser split that forced
  // `ps` onto `fa-AF`. Note the digits are LATIN and that is correct: Pakistani
  // Urdu uses Western digits, unlike Dari/Pashto. It also means a runtime with
  // no Urdu data degrades to English month names with the SAME digits, rather
  // than a visible mismatch mid-page.
  ur: "ur-PK",
};
