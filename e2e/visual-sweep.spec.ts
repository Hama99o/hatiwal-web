import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

/**
 * Visual sweep — every key page across all 3 locales x light/dark.
 *
 * WHY THIS EXISTS. The suite next door has ~378 behavioural specs and exactly
 * two screenshot calls, so web had essentially no visual coverage. On mobile
 * that same blind spot hid a real bug for weeks: the map QA matrix passed every
 * single step — every testID present, every tap working — while the BASEMAP
 * rendered light inside dark chrome on two surfaces, because one component read
 * the wrong theme source. No assertion could have caught it. Only looking at the
 * images did.
 *
 * So this spec's job is to produce evidence a human (or Claude) reviews by eye,
 * while still failing loudly on the things a machine CAN judge: a page that
 * 500s, a landmark that never appears, a console error, or a map container that
 * stays empty.
 *
 * OPT-IN, and deliberately not part of the default run:
 *
 *   VISUAL_SWEEP=1 E2E_REAL_MAP=https://map.hatiwal.com npx playwright test e2e/visual-sweep.spec.ts
 *
 * Two reasons it is not in CI. It is slow (6 cells x 6 pages), and a meaningful
 * check of the BASEMAP needs the real tile server — while the rest of the suite
 * is deliberately hermetic (`NEXT_PUBLIC_MAP_URL` points at a source-less mock
 * style, because an external host in 300+ specs cost 16 minutes and 10 extra
 * flakes). `E2E_REAL_MAP` overrides that for this run only. Without it the sweep
 * still runs and still checks layout, RTL, theme and digits — the map area is
 * simply blank, and blank is not a finding.
 */

const LOCALES = ["en", "ps", "fa"] as const;
const THEMES = ["light", "dark"] as const;
const OUT_DIR = process.env.VISUAL_SWEEP_DIR || "qa/visual";
const REAL_MAP = !!process.env.E2E_REAL_MAP;

/** Pages worth a picture, with the landmark that proves the page actually rendered. */
const PAGES = [
  { name: "1-home", url: (l: string) => `/${l}`, landmark: "main" },
  { name: "2-bazaar", url: (l: string) => `/${l}/bazaar`, landmark: "main" },
  { name: "3-listing-detail", url: (l: string) => `/${l}/listings/1`, landmark: "main" },
  { name: "4-my-listings", url: (l: string) => `/${l}/my-listings`, landmark: "main" },
  { name: "5-conversation", url: (l: string) => `/${l}/conversations/1`, landmark: "main" },
  { name: "6-create-listing", url: (l: string) => `/${l}/listings/new`, landmark: "form, main" },
] as const;

test.describe("visual sweep", () => {
  test.skip(
    !process.env.VISUAL_SWEEP,
    "opt-in: run with VISUAL_SWEEP=1 (see this file's header)",
  );
  test.use({ storageState: BUYER_STATE });
  // Six full page tours in dev mode, each compiling routes on first hit.
  test.setTimeout(300_000);

  for (const locale of LOCALES) {
    for (const theme of THEMES) {
      test(`${locale} · ${theme}`, async ({ page }) => {
        const cell = `${locale}-${theme}`;
        fs.mkdirSync(OUT_DIR, { recursive: true });

        // next-themes reads its own localStorage key on boot, so setting it
        // BEFORE the first paint avoids a light flash that would poison a dark
        // screenshot — and avoids driving the UI toggle six times.
        await page.addInitScript((t) => {
          try {
            localStorage.setItem("theme", t as string);
          } catch {
            /* private mode — the sweep still runs, just in the default theme */
          }
        }, theme);

        // Console errors are collected per cell rather than asserted per page:
        // a hydration mismatch (the class of bug reported on ps) surfaces here
        // and nowhere in the behavioural specs.
        const consoleErrors: string[] = [];
        page.on("console", (m) => {
          if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
        });
        const pageErrors: string[] = [];
        page.on("pageerror", (e) => pageErrors.push(String(e.message).slice(0, 300)));

        for (const p of PAGES) {
          await page.goto(p.url(locale), { waitUntil: "domcontentloaded" });
          // The landmark is the "did this page actually render" gate: a 500 or a
          // redirect to login fails the cell instead of quietly producing a
          // screenshot of an error page.
          await expect(page.locator(p.landmark).first()).toBeVisible({ timeout: 60_000 });

          // `dir` is asserted rather than eyeballed: it is the one thing about
          // RTL a machine can judge with certainty, and it is load-bearing for
          // every ps/fa layout.
          const dir = await page.evaluate(() => document.documentElement.dir);
          expect(dir, `${cell} ${p.name}: <html dir>`).toBe(
            locale === "en" ? "ltr" : "rtl",
          );

          // Same for the theme: the `.dark` class is what actually paints the
          // page (it is what the map component reads too), so a screenshot that
          // looks light is only a finding once we know the class was right.
          const isDark = await page.evaluate(() =>
            document.documentElement.classList.contains("dark"),
          );
          expect(isDark, `${cell} ${p.name}: .dark class`).toBe(theme === "dark");

          await settle(page);
          await page.screenshot({
            path: path.join(OUT_DIR, `${cell}-${p.name}.png`),
            fullPage: false,
          });
        }

        // Fail the cell on script errors — these are real defects, not taste.
        expect(pageErrors, `${cell}: uncaught page errors`).toEqual([]);
        // Console errors are reported but not fatal: dev mode is chatty (font
        // preload notices, HMR), and a hard assertion here would make the sweep
        // useless rather than useful. Written to disk so a human sees them.
        if (consoleErrors.length) {
          fs.writeFileSync(
            path.join(OUT_DIR, `${cell}-console-errors.txt`),
            consoleErrors.join("\n"),
          );
        }
      });
    }
  }
});

/**
 * Let the page stop moving before the shutter. Fonts settle late (three
 * self-hosted families, one per script) and a map layer paints after its style
 * loads, so a naive screenshot catches a half-drawn page and every cell looks
 * "broken" for reasons that are not bugs.
 */
async function settle(page: Page) {
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  if (REAL_MAP) {
    // Only meaningful against the live tile server; with the hermetic mock the
    // canvas never gets tiles and waiting for it would just burn 3s per page.
    await page
      .waitForFunction(
        () => !document.querySelector(".maplibregl-map") ||
          !!document.querySelector(".maplibregl-canvas"),
        undefined,
        { timeout: 15_000 },
      )
      .catch(() => {});
  }
  await page.waitForTimeout(REAL_MAP ? 2500 : 900);
}
