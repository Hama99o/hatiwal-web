import { defineRouting } from "next-intl/routing";

/**
 * The four locales Hatiwal supports — identical to the mobile app.
 * en = English (LTR), ps = Pashto (RTL), fa = Dari/Farsi (RTL), ur = Urdu (RTL).
 *
 * Urdu was added when Hatiwal opened to Pakistan. Pashto already covers Khyber
 * Pakhtunkhwa; Urdu is what Punjab, Sindh and Islamabad need.
 *
 * A locale is only listed here once messages/<locale>.json is COMPLETE.
 * src/i18n/request.ts loads a single file per locale with NO per-key fallback,
 * so a partially translated locale renders raw key paths ("listing.form.title")
 * in the UI rather than English. ur.json is 866/866.
 */
/** Every locale with a complete messages file. */
export const ALL_LOCALES = ["en", "ps", "fa", "ur"] as const;

export type Locale = (typeof ALL_LOCALES)[number];

/**
 * Hidden from the site (owner, 2026-10-05: "hide Urdu for now, don't remove
 * it"): no route, no switcher entry, no sitemap/hreflang. messages/ur.json
 * stays. To bring it back, remove it here. /ur/... redirects to /en/...
 * (src/middleware.ts).
 */
export const HIDDEN_LOCALES: readonly Locale[] = ["ur"];

export const routing = defineRouting({
  locales: ALL_LOCALES.filter((l) => !HIDDEN_LOCALES.includes(l)),
  defaultLocale: "en",
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
