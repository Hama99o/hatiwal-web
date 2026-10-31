import { test as base } from "@playwright/test";

export * from "@playwright/test";

/**
 * Cards 387/390: a `page.route` handler still running when a test finishes (a
 * late request; `route.fetch()` / `res.json()` mid-teardown) failed the
 * FINISHED test with "Target page, context or browser has been closed" or
 * "Response has been disposed" — in any spec that patches a response, not
 * because of what it tests. Every page now drops its routes at teardown with
 * `ignoreErrors` (Playwright ≥ 1.41), before the page closes. Specs that
 * register routes import `test` from here.
 */
export const test = base.extend<{ unrouteOnTeardown: void }>({
  unrouteOnTeardown: [
    async ({ page }, use) => {
      await use();
      await page.unrouteAll({ behavior: "ignoreErrors" }).catch(() => {});
    },
    { auto: true },
  ],
});
