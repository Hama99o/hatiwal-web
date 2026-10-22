// Plain locale constants, with no next-intl import, so code outside the Next
// runtime can read them too (the Playwright unit specs: next-intl's `routing`
// entry is ESM-only and cannot be required there). routing.ts builds the
// next-intl routing from these and re-exports them.

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

/** The locales the site serves (en, ps, fa): every complete one that is not hidden. */
export const LOCALES = ALL_LOCALES.filter((l) => !HIDDEN_LOCALES.includes(l));

export const DEFAULT_LOCALE = "en" satisfies Locale;
