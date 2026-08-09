import { defineConfig, devices } from "@playwright/test";

/**
 * TEMPORARY local config (deleted after the run) for the search-history spec.
 * Own ports + own dist dir so it can run while another session's E2E holds
 * 3210/4010 and .next-e2e.
 */
const MOCK_API_PORT = 4015;
const WEB_PORT = 3215;
const API_BASE = `http://localhost:${MOCK_API_PORT}/api/v1`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/search-history.spec.ts",
  fullyParallel: true,
  workers: 3,
  reporter: "list",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command: "node e2e/mock-api/server.mjs",
      url: `${API_BASE}/categories`,
      reuseExistingServer: true,
      timeout: 30_000,
      env: { MOCK_API_PORT: String(MOCK_API_PORT) },
    },
    {
      command: `npx next dev -p ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/en`,
      reuseExistingServer: true,
      timeout: 300_000,
      env: {
        NEXT_DIST_DIR: ".next-e2e-searchhist",
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
