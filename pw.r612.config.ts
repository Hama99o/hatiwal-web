import { defineConfig, devices } from "@playwright/test";

// Isolated copy of hatiwal-web/playwright.config.ts on free ports so this run
// doesn't collide with another agent's E2E servers.
const MOCK_API_PORT = 4018;
const WEB_PORT = 3218;
const API_BASE = `http://localhost:${MOCK_API_PORT}/api/v1`;
const ROOT = "/home/hama99o/Apps/Personal/Hatiwal/hatiwal-web";

export default defineConfig({
  testDir: `${ROOT}/e2e`,
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: [
    {
      command: `node ${ROOT}/e2e/mock-api/server.mjs`,
      url: `${API_BASE}/categories`,
      cwd: ROOT,
      reuseExistingServer: false,
      timeout: 30_000,
      env: { MOCK_API_PORT: String(MOCK_API_PORT) },
    },
    {
      command: `npx next dev -p ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/en`,
      cwd: ROOT,
      reuseExistingServer: false,
      timeout: 300_000,
      env: {
        NEXT_DIST_DIR: ".next-e2e-r612",
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
