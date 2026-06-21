import { defineConfig, devices } from "@playwright/test";

/**
 * Web E2E. Playwright boots two servers: the deterministic mock API
 * (e2e/mock-api) and the Next dev server pointed at it via API_URL. Specs drive
 * a real headless Chromium against the running site — the web analogue of the
 * mobile Maestro flows.
 */
const MOCK_API_PORT = 4010;
// Dedicated E2E port (NOT 3011) so the suite runs in full isolation from a
// developer's `npm run dev` and always talks to the mock API below.
const WEB_PORT = 3210;
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
    },
    {
      // Always start a fresh isolated server (own port + own .next-e2e dir) so
      // E2E is deterministic and never reuses a dev server pointed at real Rails.
      command: `npx next dev -p ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/en`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        NEXT_DIST_DIR: ".next-e2e",
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
