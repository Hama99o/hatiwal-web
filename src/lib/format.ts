import { formatDistanceToNow } from "date-fns";
import { enUS, faIR } from "date-fns/locale";
import { INTL_TAG } from "./intl-tag";

/**
 * Locale-aware formatting. ALWAYS format prices/dates through here — never
 * concatenate currency strings or call toLocaleString ad hoc.
 *
 * The routing-tag → `Intl` tag mapping (`ps` → `fa-AF`) lives in `./intl-tag`,
 * import-free, because `src/i18n/intl-locale-alias.ts` reuses that ONE table for
 * the numbers next-intl formats inside messages (`{count, plural, one {# …}}`)
 * and is installed from the root client component of every page — see that file.
 * Deliberately NOT re-exported from here: one import path keeps that heavy edge
 * (`date-fns` in the root client bundle) from coming back.
 */

// date-fns has no Pashto locale; faIR (Persian) shares the script, so it's the
// closest fit for ps and fa. en uses enUS.
//
// `ur` is DELIBERATELY absent and therefore resolves to enUS below. date-fns
// ships no Urdu locale either (it has ug/uk/uz, not ur), and the tempting move —
// pointing it at faIR the way ps does — would render PERSIAN at an Urdu reader:
// "۳ روز پیش" where Urdu says "3 دن پہلے". Same script, different language.
// This repo's own translation audit takes the position that a confidently wrong
// string is worse than an obviously untranslated one, so relative times read as
// English until there is a real Urdu source for them.
//
// Everything else on this locale IS localized — `INTL_TAG` maps ur to ur-PK, so
// absolute dates, numbers and prices are correct. This is the one narrow gap.
const DF_LOCALE: Record<string, typeof enUS> = {
  en: enUS,
  ps: faIR,
  fa: faIR,
};

export function formatPrice(
  price: number | null | undefined,
  currency: string | null | undefined,
  locale: string,
): string {
  const value = price ?? 0;
  const code = currency || "AFN";
  try {
    return new Intl.NumberFormat(INTL_TAG[locale] ?? "en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toLocaleString()} ${code}`;
  }
}

/**
 * Any bare number a screen prints (a count, a rating). `options` covers the one
 * case that isn't an integer — a rating pinned to one decimal — so that value
 * still goes through this ONE table instead of `toFixed`, which is locale-blind
 * and would put Latin digits beside the locale's own (see `intl-locale-alias`).
 */
export function formatNumber(
  value: number,
  locale: string,
  options?: Intl.NumberFormatOptions,
): string {
  try {
    return new Intl.NumberFormat(INTL_TAG[locale] ?? "en-US", options).format(
      value,
    );
  } catch {
    return String(value);
  }
}

/**
 * Absolute, locale-aware calendar date (e.g. "Jul 4, 2026"). Used where an exact
 * day matters — e.g. the seller "away until <date>" banner. Returns "" for a
 * missing/invalid date so callers can guard on emptiness.
 */
export function formatDate(
  isoDate: string | null | undefined,
  locale: string,
): string {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(INTL_TAG[locale] ?? "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return date.toLocaleDateString(INTL_TAG[locale] ?? "en-US");
  }
}

/**
 * Locale-aware clock time (e.g. "3:00 PM", "۱۵:۰۰") — the timestamp on a chat
 * bubble. Mirrors mobile's `useLocalization().formatTime`. Returns "" for a
 * missing/invalid date so callers can guard on emptiness, like `formatDate`.
 */
export function formatTime(
  isoDate: string | null | undefined,
  locale: string,
): string {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(INTL_TAG[locale] ?? "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toLocaleTimeString(INTL_TAG[locale] ?? "en-US");
  }
}

export function formatRelativeDate(
  isoDate: string | null | undefined,
  locale: string,
): string {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return formatDistanceToNow(date, {
      addSuffix: true,
      locale: DF_LOCALE[locale] ?? enUS,
    });
  } catch {
    return date.toLocaleDateString(INTL_TAG[locale] ?? "en-US");
  }
}
