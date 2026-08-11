import { defineConfig, devices } from "@playwright/test";

/**
 * Web E2E. Playwright boots two servers: the deterministic mock API
 * (e2e/mock-api) and the Next dev server pointed at it via API_URL. Specs drive
 * a real headless Chromium against the running site — the web analogue of the
 * mobile Maestro flows.
 */
// Ports are env-overridable so two suites can run side by side on one machine
// (`E2E_WEB_PORT=3211 E2E_MOCK_API_PORT=4011 npm run test:e2e`); the defaults are
// what CI and a lone developer get.
const MOCK_API_PORT = Number(process.env.E2E_MOCK_API_PORT || 4010);
// Dedicated E2E port (NOT 3011) so the suite runs in full isolation from a
// developer's `npm run dev` and always talks to the mock API below.
const WEB_PORT = Number(process.env.E2E_WEB_PORT || 3210);
const API_BASE = `http://localhost:${MOCK_API_PORT}/api/v1`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  // Generous: dev-mode compiles each route on first hit against a cold .next-e2e.
  timeout: 120_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "on-first-retry",
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },

  projects: [
    // Logs in each persona once and writes its storageState; authed specs
    // depend on this via test.use({ storageState }).
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],

  webServer: [
    {
      command: "node e2e/mock-api/server.mjs",
      url: `${API_BASE}/categories`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { MOCK_API_PORT: String(MOCK_API_PORT) },
    },
    {
      // Always start a fresh isolated server (own port + own .next-e2e dir) so
      // E2E is deterministic and never reuses a dev server pointed at real Rails.
      command: `npx next dev -p ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/en`,
      reuseExistingServer: false,
      // Cold dev compile of the whole /en route tree + first-hit next/font
      // downloads (Rubik/Zain/Noto) can exceed 3 min on a loaded CI runner.
      // 5 min gives margin so the webServer isn't declared "not ready" mid-compile.
      timeout: 300_000,
      env: {
        // Per-port build dir: two concurrent suites must not share .next output.
        NEXT_DIST_DIR: WEB_PORT === 3210 ? ".next-e2e" : `.next-e2e-${WEB_PORT}`,
        // …and its own tsconfig, because Next writes an include entry for its
        // distDir into whatever tsconfig it reads. tsconfig.scratch.json already
        // declares `.next-e2e/types/**/*.ts`, so the default port writes nothing
        // and tsconfig.json — the one everybody edits and commits — is never
        // touched by a test run. (A non-default E2E_WEB_PORT still gets its
        // `.next-e2e-<port>` entry appended, but to the scratch file.)
        NEXT_TSCONFIG_PATH: "tsconfig.scratch.json",
        API_URL: API_BASE,
        NEXT_PUBLIC_API_URL: API_BASE,
        NEXT_PUBLIC_RAILS_ORIGIN: `http://localhost:${MOCK_API_PORT}`,
        NEXT_PUBLIC_SITE_URL: `http://localhost:${WEB_PORT}`,
        NEXT_PUBLIC_APP_NAME: "Hatiwal",
        NEXT_PUBLIC_DEFAULT_LOCALE: "en",
      },
    },
  ],
});
