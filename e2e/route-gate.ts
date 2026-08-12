import type { Page } from "@playwright/test";

/**
 * Freeze a route until the returned function is called — how specs make a window
 * that is normally ~1s (a session probe, a saved-list fetch) long enough to
 * assert on, and how they reproduce a request that never answers at all by
 * simply never calling it.
 *
 * Shared rather than copied: two suites need the same gate around
 * `/api/auth/session`, and a second copy is how they drift (an unroute that
 * never runs leaves the next navigation in the same test hanging).
 */
export async function hold(page: Page, pattern: string) {
  let open: () => void = () => {};
  const gate = new Promise<void>((resolve) => (open = resolve));
  await page.route(pattern, async (route) => {
    await gate;
    await route.continue();
  });
  return async () => {
    open();
    await page.unroute(pattern);
  };
}
