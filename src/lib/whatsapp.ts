/**
 * WhatsApp deep links for a seller's number — the web half of mobile's
 * `src/utils/whatsapp.ts`, kept deliberately identical in behaviour.
 *
 * Web had the "call seller" reveal but never got the WhatsApp option the owner
 * asked for on 2026-09-02 ("we have call seller but we should have whatsapp
 * option also"), so this closes that parity gap rather than inventing anything.
 *
 * WHY https://wa.me AND NOT whatsapp://
 *
 * wa.me is a plain https URL: WhatsApp claims it when installed and the web
 * client answers when it is not. Nothing to register, and it behaves on desktop
 * as well as phones, which matters more here than on mobile.
 *
 * THE NUMBER FORMAT IS THE PART THAT BREAKS
 *
 * wa.me accepts digits ONLY — no `+`, spaces, dashes or parentheses — and it
 * must be the full international number. A wrong number opens a chat with a
 * stranger, so this normalises rather than trusting the stored string.
 */

/** Fallback when a number gives no clue which country it belongs to. */
export const DEFAULT_COUNTRY_CODE = "93";

/**
 * Dial codes across the service area.
 *
 * The bug this prevents (found and fixed on mobile first): asking only "does
 * this start with 93?" and prepending 93 to everything else turns a correctly
 * written foreign number into a different number entirely —
 * `+92 300 1234567` became `93923001234567`, a live link to a stranger.
 *
 * Internal routing values. No country name is derived from these and none is
 * rendered.
 */
const SERVICE_AREA_DIAL_CODES = ["93", "92", "98"] as const;

/** Provinces whose sellers dial +92. Matched against the listing's free-text
 *  `location`, which on web comes from geocoding rather than a fixed picker —
 *  so this is a substring test, not an equality one. Never rendered. */
const PK_DIALLING_AREAS = [
  "punjab",
  "sindh",
  "khyber pakhtunkhwa",
  "balochistan",
  "islamabad",
  "gilgit-baltistan",
  "azad kashmir",
  "pakistan",
];

/**
 * The dial code to assume for a number written in national form ("0300…") by a
 * seller in this location. National form is ambiguous on its own — an Afghan
 * and a Pakistani number are both "a number starting with 0" — so the listing's
 * location is what resolves it.
 */
export function dialCodeForLocation(location?: string | null): string {
  if (!location) return DEFAULT_COUNTRY_CODE;
  const l = location.toLowerCase();
  return PK_DIALLING_AREAS.some((a) => l.includes(a)) ? "92" : DEFAULT_COUNTRY_CODE;
}

/** A number already carrying one of our dial codes, at a plausible length. */
function isAlreadyInternational(digits: string): boolean {
  return (
    digits.length >= 10 && SERVICE_AREA_DIAL_CODES.some((c) => digits.startsWith(c))
  );
}

/** Digits-only international number, or null when there is nothing usable. */
export function normalizePhoneForWhatsApp(
  phone: string | null | undefined,
  countryCode: string = DEFAULT_COUNTRY_CODE,
): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  // "00" is the international access prefix — strip it before anything else, or
  // "0093…" would be read as a national number starting with 0.
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (isAlreadyInternational(digits)) {
    // Already international, for ANY country in the service area. Length-gated
    // so a bare 9-digit subscriber number that merely opens with those digits
    // is not mistaken for a country code.
  } else if (digits.startsWith("0")) {
    // National form: the trunk 0 is replaced by the country code.
    digits = countryCode + digits.replace(/^0+/, "");
  } else {
    // Bare subscriber number.
    digits = countryCode + digits;
  }

  // Afghan mobile numbers are 9 digits after the country code and Pakistani ones
  // are 10, so a plausible full number is 11-12 digits. Better to render no
  // button than one that opens a chat with the wrong person.
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

/** The URL to open, or null when the number is unusable. */
export function whatsappUrl(
  phone: string | null | undefined,
  countryCode: string = DEFAULT_COUNTRY_CODE,
): string | null {
  const digits = normalizePhoneForWhatsApp(phone, countryCode);
  return digits ? `https://wa.me/${digits}` : null;
}
