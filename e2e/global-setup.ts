import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * REPAIRS corrupt Next build artifacts before an E2E run.
 *
 * WHY THIS EXISTS — a precisely diagnosed, previously mysterious failure.
 *
 * The suite intermittently rendered EVERY page as a 21-character shell, with the
 * server log full of `SyntaxError: Unexpected number in JSON at position 1286`
 * (or 1280, or 1565 — the number moved). All 36 responsive checks failed in one
 * run and 34 passed in the next with no code change between them. Filed as board
 * card 314, with four theories investigated and disproven: the mock API's
 * payloads (they parse), a host rewrite before JSON.parse (`rewriteRailsHost`
 * returns early here because INTERNAL === PUBLIC), request concurrency (48
 * parallel requests against a fresh dist dir corrupt nothing), and the spec's
 * own measurement.
 *
 * THE ACTUAL CAUSE: `.next-e2e/prerender-manifest.json` was 1583 bytes and
 * failed to parse at char 1565 with "Extra data" — a COMPLETE JSON document
 * followed by leftover bytes. That is the signature of a shorter write landing
 * on a longer file without truncating it: two Next dev servers sharing one dist
 * dir, or one killed mid-write as the next run starts. Next then cannot read its
 * own prerender manifest, route generation fails ("Failed to generate static
 * paths for /[locale]/bazaar"), and because every page wraps its fetches in
 * `safe(..., [])` it surfaces as a silently BLANK page rather than an error. The
 * varying offsets were just the length of whatever valid prefix survived.
 *
 * WHY REPAIR AND NOT DELETE — both alternatives were tried and both broke:
 *
 *   • `rm -rf` the whole dist dir works, but a fully cold dir makes Next compile
 *     /[locale]/login while serving the run's FIRST request. On a loaded machine
 *     that blew even a 60s wait and failed both auth personas, taking every
 *     authed spec with them.
 *   • Deleting just the manifests is worse: Next in dev does NOT regenerate
 *     `prerender-manifest.json` on demand, so every page then failed with
 *     `ENOENT ... prerender-manifest.json`. It is a required input, not a
 *     disposable cache entry.
 *
 * Truncating to the valid prefix is exact for this corruption, because the file
 * genuinely contains one complete JSON document with junk appended. The webpack
 * cache — the expensive 211MB part — is left untouched either way.
 */

/** Every `.json` under `dir`, recursively — manifests live at several depths. */
function jsonFilesIn(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // first-ever run: no dist dir yet
  }
  for (const name of entries) {
    const full = path.join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue; // vanished under us
    }
    if (st.isDirectory()) jsonFilesIn(full, out);
    else if (name.endsWith(".json")) out.push(full);
  }
  return out;
}

/**
 * The longest prefix of `text` that is a complete JSON document, or null.
 *
 * Driven by the parser's own reported offset rather than by scanning: V8 says
 * "Unexpected number in JSON at position 1565", and for trailing-junk corruption
 * that position IS the end of the good document. One retry is enough; anything
 * that still fails is a different kind of damage and is left alone rather than
 * guessed at.
 */
function validJsonPrefix(text: string): string | null {
  try {
    JSON.parse(text);
    return text; // already fine
  } catch (err) {
    const at = Number(/position (\d+)/.exec(String(err))?.[1] ?? NaN);
    if (!Number.isFinite(at) || at <= 0) return null;
    const candidate = text.slice(0, at);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      return null;
    }
  }
}

export default function globalSetup(): void {
  // Mirrors playwright.config.ts's per-port dist dir exactly. Kept in sync by
  // hand rather than imported, because importing the config from its own
  // globalSetup is circular.
  const distDir = process.env.E2E_WEB_PORT
    ? `.next-e2e-${process.env.E2E_WEB_PORT}`
    : ".next-e2e";
  const root = path.join(process.cwd(), distDir);

  const repaired: string[] = [];
  const unrepairable: string[] = [];

  for (const file of jsonFilesIn(root)) {
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    try {
      JSON.parse(text);
      continue; // healthy, the overwhelmingly common case
    } catch {
      // fall through to repair
    }
    const fixed = validJsonPrefix(text);
    const rel = path.relative(root, file);
    if (fixed !== null && fixed !== text) {
      writeFileSync(file, fixed);
      repaired.push(`${rel} (${text.length} -> ${fixed.length} bytes)`);
    } else {
      unrepairable.push(rel);
    }
  }

  if (repaired.length) {
    console.log(
      `[e2e] repaired ${repaired.length} corrupt artifact(s) in ${distDir}: ${repaired.join(", ")}`,
    );
  }
  if (unrepairable.length) {
    // LOUD, and not fatal: the run may still pass, but if pages come back blank
    // this is why, and the fix is to delete the dist dir by hand and accept one
    // cold compile.
    console.warn(
      `[e2e] WARNING: ${unrepairable.length} artifact(s) in ${distDir} are corrupt and ` +
        `could not be repaired: ${unrepairable.join(", ")}. If pages render blank, ` +
        `run \`rm -rf ${distDir}\` and expect a slow first request.`,
    );
  }
  if (!repaired.length && !unrepairable.length) {
    console.log(`[e2e] ${distDir} artifacts are intact`);
  }
}
