// From `@/lib/intl-tag`, NOT `@/lib/format`: this module is evaluated at module
// scope from the root client component of every page, so it must not need a date
// library (`format.ts` imports `date-fns` + two locales) to read three strings.
// `intl-tag` has no imports at all, and it is still ONE table — `format.ts` reads
// the same one.
import { INTL_TAG } from "@/lib/intl-tag";

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
 *
 * What this CANNOT reach, and the catalogs' side of the contract: a placeholder
 * with no type — `{count}` — is never formatted at all. ICU stringifies it, so it
 * printed Latin `1234` beside an Arabic-Indic price no matter what `Intl` does.
 * Every numeric placeholder in `messages/{en,ps,fa}.json` therefore declares its
 * type (`{count, number}`, `{percent, number}`, …), which is what routes it
 * through the `Intl.NumberFormat` this module aliases. A number handed to `t()`
 * as an ALREADY-formatted string (`common.countOverflow`, the offer prices) stays
 * untyped on purpose — it went through `src/lib/format.ts` first.
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
 * Assumption worth stating: BOTH runtimes must ship `fa-AF` data. On a small-icu
 * Node build the alias would resolve to `en-US` on the server while Chromium
 * gives `arabext`, i.e. the mismatch comes back inverted. Node's official and
 * Docker images are full-icu (this project runs Node 18.18 / ICU 73.2), and the
 * `Dockerfile`s do not build Node themselves, so there is nothing to guard today
 * — but a small-icu runtime is the one change that would silently undo this file.
 *
 * Regression fence: `e2e/i18n-digits.spec.ts`.
 */

/**
 * Locales whose ICU data V8 does not ship, so the tag must be swapped for the
 * `INTL_TAG` equivalent before it reaches `Intl`. Keyed by primary language
 * subtag, so `ps` and `ps-AF` are both covered.
 */
const ALIASED_LANGUAGES: readonly string[] = ["ps"];

/**
 * Swap an aliased language for its `INTL_TAG` equivalent, keeping any Unicode
 * extension the caller asked for.
 *
 * The extension carries the explicit requests — `-u-nu-latn` (numbering system),
 * `-u-ca-…` (calendar) — so returning the mapped tag wholesale would silently
 * discard them: `Intl.NumberFormat('ps-AF-u-nu-latn')` would come back with
 * Arabic-Indic digits, the exact opposite of what was asked for. Region/script
 * subtags are NOT kept: `fa-AF` is chosen precisely because it is the Afghan
 * Persian tag both runtimes ship, and re-attaching `-AF` (or a script) to it
 * cannot improve on that. Dropping them also means a malformed region on an
 * aliased tag (`ps-!!bad`) resolves instead of throwing `RangeError`; no call
 * site builds one, and being lenient there beats crashing a page over a digit.
 */
function aliasTag(tag: string): string {
  const [language, ...rest] = tag.split("-");
  const mapped = ALIASED_LANGUAGES.includes(language.toLowerCase())
    ? INTL_TAG[language.toLowerCase()]
    : undefined;
  if (!mapped) return tag;
  // A singleton (a one-character subtag: `u`, `t`, `x`) starts the extensions;
  // everything from there on is the caller's, so it rides along unchanged.
  const singleton = rest.findIndex((subtag) => subtag.length === 1);
  if (singleton === -1) return mapped;
  const withExtensions = [mapped, ...rest.slice(singleton)].join("-");
  try {
    Intl.getCanonicalLocales(withExtensions);
    return withExtensions;
  } catch {
    // Malformed extension: hand back the ORIGINAL tag so `Intl` throws the same
    // RangeError it would have without this alias installed.
    return tag;
  }
}

/**
 * `locales` may be a tag, an `Intl.Locale`, an array of either, or `undefined`
 * (runtime default). Anything we don't alias is passed through UNTOUCHED — never
 * stringified, so an `Intl.Locale` we don't map stays an `Intl.Locale` and an
 * exotic array-like reaches `Intl` exactly as the caller wrote it.
 */
function aliasLocaleEntry(locale: unknown): unknown {
  if (typeof locale === "string") return aliasTag(locale);
  if (locale instanceof Intl.Locale) {
    const tag = locale.toString();
    const aliased = aliasTag(tag);
    return aliased === tag ? locale : aliased;
  }
  return locale;
}

function aliasLocales(locales: unknown): unknown {
  if (Array.isArray(locales)) return locales.map(aliasLocaleEntry);
  return aliasLocaleEntry(locales);
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
