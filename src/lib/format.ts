import { formatDistanceToNow } from "date-fns";
import { enUS, faIR } from "date-fns/locale";

/**
 * Locale-aware formatting. ALWAYS format prices/dates through here — never
 * concatenate currency strings or call toLocaleString ad hoc.
 */

const INTL_TAG: Record<string, string> = {
  en: "en-US",
  ps: "ps-AF",
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

export function formatNumber(value: number, locale: string): string {
  try {
    return new Intl.NumberFormat(INTL_TAG[locale] ?? "en-US").format(value);
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
