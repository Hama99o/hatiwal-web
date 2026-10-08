import { defineConfig, devices } from "@playwright/test";

/**
 * Web design QA (1.1.6, 2026-10-08): screenshots of every 1.1.6 surface at
 * 390 / 768 / 1280 px, en + ps + fa, light + dark, plus automatic checks
 * (overflow, Latin digits in ps/fa, touch targets, unmirrored RTL icons).
 * Against a BUILT web (`next build` into .next-design, then `next start`) and
 * the deterministic mock API — never the dev server. Output:
 * qa/reports/web-design-1.1.6/ (PNGs + findings.json).
 */
const WEB_PORT = Number(process.env.DESIGN_WEB_PORT || 3213);
const MOCK_API_PORT = Number(process.env.DESIGN_MOCK_API_PORT || 4013);

export default defineConfig({
  testDir: "./e2e-design",
  testMatch: "**/*.design.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 600_000,
  expect: { timeout: 20_000 },
  reporter: "list",
  use: { baseURL: `http://localhost:${WEB_PORT}`, actionTimeout: 20_000, navigationTimeout: 60_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/mock-api/server.mjs",
      url: `http://localhost:${MOCK_API_PORT}/api/v1/categories`,
      reuseExistingServer: false,
      env: { MOCK_API_PORT: String(MOCK_API_PORT) },
    },
    {
      command: `npx next start -p ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/en`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NODE_ENV: "production",
        NEXT_DIST_DIR: ".next-design",
        NEXT_TSCONFIG_PATH: "tsconfig.scratch.json",
        API_URL: `http://localhost:${MOCK_API_PORT}/api/v1`,
      },
    },
  ],
});
