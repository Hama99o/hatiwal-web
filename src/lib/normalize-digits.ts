/**
 * normalizeDigits — web port of `hatiwal-mobile/src/utils/normalizeDigits.ts`
 * (kept behaviourally identical so a search typed on one client matches the
 * same rows on the other).
 *
 * Converts Persian/Pashto (Extended Arabic-Indic, U+06F0–U+06F9) and Arabic
 * (Arabic-Indic, U+0660–U+0669) numerals — what a Dari/Pashto keypad actually
 * types, and what `Intl.NumberFormat("fa-AF")` actually RENDERS — to ASCII 0-9,
 * maps the Arabic decimal separator U+066B «٫» to `.`, and strips the group
 * separators U+066C «٬», U+060C «،» and ASCII `,` (on en/ps/fa a comma is
 * unambiguously a group separator).
 *
 * Why the inbox search needs it: the offer preview renders its amount through
 * `formatPrice`, so on /ps and /fa the row shows "؋ ۷۵٬۰۰۰" while the user may
 * type `75000` on a Latin keypad (and on /en the row shows "AFN 75,000" while a
 * user may paste `۷۵۰۰۰`). Normalising BOTH sides makes the match work in
 * either direction instead of silently returning "no results" for a number
 * that is right there on screen.
 *
 * Pure, no React — unit-testable.
 */
const PERSIAN_PASHTO_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

const DIGIT_MAP: Record<string, string> = {};
for (let i = 0; i < 10; i++) {
  DIGIT_MAP[PERSIAN_PASHTO_DIGITS[i]] = String(i);
  DIGIT_MAP[ARABIC_INDIC_DIGITS[i]] = String(i);
}

// U+066B Arabic decimal separator ("٫") — the fa/ps keypad's equivalent of ".".
const ARABIC_DECIMAL_SEPARATOR = /٫/g;
// U+066C Arabic thousands separator ("٬"), U+060C Arabic comma ("،") and the
// ASCII "," — all three are group separators here, so none belongs in a
// normalized numeric string.
const GROUP_SEPARATORS = /[٬،,]/g;

export function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹٠-٩]/g, (ch) => DIGIT_MAP[ch] ?? ch)
    .replace(ARABIC_DECIMAL_SEPARATOR, ".")
    .replace(GROUP_SEPARATORS, "");
}
