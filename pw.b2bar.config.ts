import { defineConfig, devices } from "@playwright/test";

// TEMPORARY verification config for TASK-WEB-B2BAR — reuses an already-running
// dev server + mock API on isolated ports (the shared .next-e2e dir is in use by
// another run). Delete this file when the card is verified.
const WEB = "http://localhost:3213";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: {
    baseURL: WEB,
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
});
