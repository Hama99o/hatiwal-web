import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Every message key exists in en, ps, fa AND ur, with no empty values.
 * Urdu is hidden from the site for now (owner, 2026-10-05; HIDDEN_LOCALES in
 * src/i18n/routing.ts) but stays fully translated so it can come back at once.
 * next-intl has no per-key fallback, so a missing key would show its raw path.
 * Pure file check: no page, no server needed.
 */
type Tree = { [k: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(key, v);
    else for (const [kk, vv] of flatten(v, key)) out.set(kk, vv);
  }
  return out;
}

const load = (locale: string) =>
  flatten(JSON.parse(readFileSync(join(__dirname, "..", "messages", `${locale}.json`), "utf8")));

const en = load("en");

for (const locale of ["ps", "fa", "ur"]) {
  test(`${locale} has every en key, and no empty or stray ones`, () => {
    const other = load(locale);
    const missing = [...en.keys()].filter((k) => !other.has(k));
    const stray = [...other.keys()].filter((k) => !en.has(k));
    const empty = [...other].filter(([, v]) => v.trim() === "").map(([k]) => k);
    expect(missing, `missing in ${locale}`).toEqual([]);
    expect(stray, `stray in ${locale}`).toEqual([]);
    expect(empty, `empty in ${locale}`).toEqual([]);
  });
}
