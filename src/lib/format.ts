import { formatDistanceToNow } from "date-fns";
import { enUS, faIR } from "date-fns/locale";

/**
 * Locale-aware formatting. ALWAYS format prices/dates through here — never
 * concatenate currency strings or call toLocaleString ad hoc.
 */

// `ps` deliberately formats through `fa-AF`, NOT `ps-AF` — the same mapping the
// mobile app uses (`useLocalization.ts`), so one listing reads the same on both
// clients. It is also the only tag that works everywhere: V8/Chromium ships no
// Pashto Intl data (`Intl.NumberFormat('ps-AF').resolvedOptions().locale` is
// `en-US` there), while Node's full ICU has it. With `ps-AF` a Pashto price
// rendered by a Server Component came out "؋ ۳۰٬۰۰۰" and the very same price
// rendered by a client island — e.g. the sticky <ListingActionBar> — came out
// "AFN 30,000" on the same screen (and any component rendered in both places
// would hydrate mismatched). `fa-AF` shares the script, digits, calendar and the
// ؋ symbol, and both runtimes have it, so server and browser always agree.
// Exported so `src/i18n/intl-locale-alias.ts` can reuse this ONE mapping for the
// numbers next-intl formats inside messages (`{count, plural, one {# …}}`), which
// it creates with the raw routing tag and no options — see that file.
export const INTL_TAG: Record<string, string> = {
  en: "en-US",
  ps: "fa-AF",
  fa: "fa-AF",
};

// date-fns has no Pashto locale; faIR (Persian) shares the script, so it's the
// closest fit for ps and fa. en uses enUS.
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
