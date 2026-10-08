import { defineConfig, devices } from "@playwright/test";

/**
 * Real-API web smoke (2026-10-08). Unlike playwright.config.ts (the mock API),
 * this drives a BUILT web server (`next build && next start`) pointed at a real
 * Rails API on its own database, seeded by hatiwal-api's smoke seed. It starts
 * nothing itself; the runner sets:
 *   SMOKE_WEB_URL   the web server (e.g. http://localhost:3311)
 *   SMOKE_IDS       the seed's JSON ids (listings, shop, chats)
 * Serial, one worker: the steps change shared state in order.
 */
export default defineConfig({
  testDir: "./e2e-real",
  testMatch: "**/*.smoke.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: "list",
  use: {
    baseURL: process.env.SMOKE_WEB_URL ?? "http://localhost:3311",
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
