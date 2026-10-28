import { defineConfig, devices } from "@playwright/test";

/**
 * The web against the 1.2.0 API (2026-10-28, docs/qa-1.2.0/web/REPORT.md in hatiwal-mobile): a
 * running web server pointed at a REAL Rails API on a private database (never the shared dev DB).
 * It starts nothing itself; the runner sets:
 *   REG_WEB_URL     the web server (e.g. http://localhost:3312)
 *   REG_CABLE_URL   that API's cable (e.g. ws://localhost:3079/hatiwal-cable), for the refused-ticket check
 *   REG_OUT         where the screenshots and the run's JSON go
 *   REG_SELLER / REG_BUYER / REG_PASSWORD, REG_CONV (their thread), REG_SOLD_ID (a live listing of the
 *                   seller the run may mark sold), REG_OTHER_ID (someone else's live listing to save/report)
 *   REG_COVER_ID / REG_COVER_BLOB / REG_COVER_Q  a listing whose photos the seller reordered (blob REG_COVER_BLOB
 *                   made the cover), and a search that lists its card — the chosen-cover check (B12)
 *   PW_CHROMIUM     an installed chromium headless shell, when this Playwright's own build is not installed
 * Serial, one worker: the steps change shared state in order. Three viewports for the cable and the prices.
 */
const launchOptions = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};

export default defineConfig({
  testDir: "./e2e-real",
  testMatch: "**/*.regression.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  expect: { timeout: 20_000 },
  reporter: "list",
  use: {
    baseURL: process.env.REG_WEB_URL ?? "http://localhost:3312",
    actionTimeout: 20_000,
    navigationTimeout: 90_000,
    trace: "retain-on-failure",
    launchOptions,
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], launchOptions } },
    { name: "tablet", use: { viewport: { width: 820, height: 1180 }, hasTouch: true, launchOptions } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 }, launchOptions } },
  ],
});
