import { defineRouting } from "next-intl/routing";
import { ALL_LOCALES, DEFAULT_LOCALE, HIDDEN_LOCALES, LOCALES, type Locale } from "./locales";

// The locale constants and their history: ./locales.ts.
export { ALL_LOCALES, DEFAULT_LOCALE, HIDDEN_LOCALES, LOCALES, type Locale };

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
});

// Urdu is right-to-left, like Pashto and Dari. Omitting it here would render
// Urdu left-to-right — the page would "work" and look broken.
const RTL_LOCALES: readonly Locale[] = ["ps", "fa", "ur"];

export function isRtl(locale: string): boolean {
  return RTL_LOCALES.includes(locale as Locale);
}

export function dir(locale: string): "rtl" | "ltr" {
  return isRtl(locale) ? "rtl" : "ltr";
}
