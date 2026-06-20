import { defineRouting } from "next-intl/routing";

/**
 * The three locales Hatiwal supports — identical to the mobile app.
 * en = English (LTR), ps = Pashto (RTL), fa = Dari/Farsi (RTL).
 */
export const routing = defineRouting({
  locales: ["en", "ps", "fa"],
  defaultLocale: "en",
});

export type Locale = (typeof routing.locales)[number];

const RTL_LOCALES: readonly Locale[] = ["ps", "fa"];

export function isRtl(locale: string): boolean {
  return RTL_LOCALES.includes(locale as Locale);
}

export function dir(locale: string): "rtl" | "ltr" {
  return isRtl(locale) ? "rtl" : "ltr";
}
