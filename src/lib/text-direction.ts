/**
 * Direction of USER-GENERATED text from its CONTENT, not its first character.
 *
 * Owner, production, iPhone, ps: the title "YIRONGTANG Fruit Vinegar Black Oil
 * Elegant | د عمده او پرچون | 2 × 250ml …" starts with a Latin letter, so
 * `dir="auto"` (first strong character) laid it out LTR inside the RTL page and
 * the Pashto runs came out in the wrong order. The rule (hamma9901): any
 * Arabic-script letter → RTL, otherwise LTR. Latin runs and numbers inside RTL
 * stay intact: only the paragraph direction changes, never the characters.
 *
 * Translated UI strings are NOT passed through this: put the `dir` on the
 * element that holds ONLY the user's text. Same rule as the app
 * (hatiwal-mobile src/lib/textDirection.ts).
 */
const ARABIC_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

export function hasArabicScript(text: string | null | undefined): boolean {
  return !!text && ARABIC_SCRIPT.test(text);
}

export function textDir(text: string | null | undefined): "rtl" | "ltr" {
  return hasArabicScript(text) ? "rtl" : "ltr";
}

/**
 * Props for an element that shows ONLY user text: an explicit `dir` (never
 * "auto") for the bidi ORDER, and alignment that follows the PAGE
 * (match-parent), so a card list stays tidy whatever each title's script.
 * The HTML `dir` attribute already isolates the run (UA [dir] rule).
 */
export function userTextProps(text: string | null | undefined): { dir: "rtl" | "ltr"; style: { textAlign: "match-parent" } } {
  return { dir: textDir(text), style: { textAlign: "match-parent" } };
}
