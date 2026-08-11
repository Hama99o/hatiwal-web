import { INTL_TAG } from "@/lib/format";

/**
 * ONE digit set per locale — on the server AND in the browser.
 *
 * next-intl formats every number that appears inside a message with
 * `new Intl.NumberFormat(<the active locale tag>)`, and for `ps` the two runtimes
 * do not agree on what that tag means (both measured, not inferred):
 *
 *   Node 18 (full ICU)        `ps` → Pashto  → `۵`, numberingSystem `arabext`
 *   V8 / Chromium (no ps data) `ps` → `en-US` → `5`, numberingSystem `latn`
 *
 * So on `/ps` the server sent `۱ اعلان`, the browser re-rendered `1 اعلان`, and
 * React threw away the server HTML of every client island that prints a count
 * (hydration error #418 — it also drops focus, which is why `/ps` specs used to
 * need retries). On one Bazaar screen the results count showed Latin digits
 * directly above Arabic-Indic digits in each price. `/en` and `/fa` were never
 * affected: both runtimes ship English and Persian data.
 *
 * `src/lib/format.ts` already closed exactly this hole for prices and dates by
 * formatting `ps` through `fa-AF` (same script, digits, group separator and ؋
 * symbol — and present in BOTH runtimes). This applies that SAME mapping
 * (`INTL_TAG`, imported above, so there is only one table) to every
 * `Intl.NumberFormat` the app creates, which is the only way to reach the ones
 * next-intl creates internally:
 *
 * - A pound (`#`) inside a plural, and a bare `{count, number}`, are formatted
 *   with NO options — `formatToParts` calls `formatters.getNumberFormat(locales)`
 *   (intl-messageformat) / `getNumberFormat(t.locale)` (use-intl's precompiled
 *   path). A `formats.number` default in `src/i18n/request.ts` therefore never
 *   reaches them: verified with use-intl 4.13, where a `numberingSystem` pin
 *   changed `{count, number, <named>}` and left `#` untouched.
 * - use-intl builds those formatters itself from an internal cache and exposes no
 *   public way to supply them (`IntlProvider` takes no `_formatters`), and the
 *   config's `locale` cannot be re-tagged either — `useLocale()` feeds `Link`,
 *   the locale switcher and `format.ts`, all of which need the routing tag `ps`.
 *
 * Deliberately limited to `Intl.NumberFormat`:
 * - `Intl.PluralRules` is NOT aliased. Node's `ps` rules and V8's `en-US`
 *   fallback already select the same category for every integer, so there is
 *   nothing to fix — while Persian's rules differ (`0` selects `one`), so
 *   aliasing would silently change which plural branch a Pashto count renders.
 * - `Intl.DateTimeFormat` is NOT aliased: `fa-AF` does not agree across these two
 *   runtimes either (Node 18's ICU 73 renders the Afghan calendar with Iranian
 *   month names, Chromium with Afghan ones), so aliasing dates would trade one
 *   mismatch for another. That gap belongs to `format.ts` and also affects `fa`.
 *
 * Regression fence: `e2e/i18n-digits.spec.ts`.
 */

/**
 * Locales whose ICU data V8 does not ship, so the tag must be swapped for the
 * `INTL_TAG` equivalent before it reaches `Intl`. Keyed by primary language
 * subtag, so `ps` and `ps-AF` are both covered.
 */
const ALIASED_LANGUAGES: readonly string[] = ["ps"];

function aliasTag(tag: string): string {
  const language = tag.toLowerCase().split("-")[0];
  if (!ALIASED_LANGUAGES.includes(language)) return tag;
  return INTL_TAG[language] ?? tag;
}

/**
 * `locales` may be a tag, an `Intl.Locale`, an array of either, or `undefined`
 * (runtime default). Anything we don't alias is passed through untouched.
 */
function aliasLocales(locales: unknown): unknown {
  if (typeof locales === "string") return aliasTag(locales);
  if (Array.isArray(locales)) {
    return locales.map((locale: unknown) =>
      typeof locale === "string" ? aliasTag(locale) : aliasTag(String(locale)),
    );
  }
  if (locales instanceof Intl.Locale) return aliasTag(locales.toString());
  return locales;
}

/** Guards against a second install (HMR, both entry points in one runtime). */
const INSTALLED = Symbol.for("hatiwal.intlNumberLocaleAlias");

/**
 * Install the alias. Call this at MODULE scope from each runtime's entry point —
 * `src/i18n/request.ts` (server) and `src/components/providers.tsx` (browser) —
 * so it is in place before the first island that prints a number renders.
 */
export function installIntlNumberLocaleAlias(): void {
  const globalWithFlag = globalThis as typeof globalThis & {
    [INSTALLED]?: true;
  };
  if (globalWithFlag[INSTALLED]) return;
  globalWithFlag[INSTALLED] = true;

  // A Proxy (not a subclass) keeps `instanceof`, the statics
  // (`supportedLocalesOf`), the prototype and callability-without-`new` intact.
  Intl.NumberFormat = new Proxy(Intl.NumberFormat, {
    construct: (target, args, newTarget) =>
      Reflect.construct(target, [aliasLocales(args[0]), args[1]], newTarget),
    apply: (target, thisArg, args) =>
      Reflect.apply(target as (...callArgs: unknown[]) => unknown, thisArg, [
        aliasLocales(args[0]),
        args[1],
      ]),
  });
}
