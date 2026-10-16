import type { Page } from "@playwright/test";

/**
 * Patch the signed-in viewer for one test. The web reads `me` from the session
 * probe (`/api/auth/session` → `{ user }`, camelCase, auth-provider.tsx), not
 * from `/api/me/users/me`, so a viewer override must land HERE to take effect.
 * The patch is shallow-merged into `user`.
 */
export async function withSessionUser(page: Page, patch: Record<string, unknown>) {
  await patchJsonRoute(page, "**/api/auth/session", (json) => {
    if (json?.user) json.user = { ...json.user, ...patch };
    return json;
  });
}

/**
 * Let a GET reach the mock API, then rewrite its JSON before the page sees it.
 * Other methods pass straight through.
 *
 * A test that is already done closes the page while a late request is still in
 * this handler; Playwright then fails the FINISHED test with "Target page … has
 * been closed while running route callback" (verification-states:134; shop-team
 * once the shop page also fetched the members' view). Only that case is
 * swallowed — every other error still fails the test.
 */
export async function patchJsonRoute(
  page: Page,
  url: string | RegExp,
  patch: (json: any) => any, // eslint-disable-line @typescript-eslint/no-explicit-any
) {
  await page.route(url, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    try {
      const res = await route.fetch();
      const json = patch(await res.json());
      await route.fulfill({ response: res, json });
    } catch (e) {
      if (page.isClosed()) return;
      throw e;
    }
  });
}

/** A `me.shops[]` entry (camelCase, as the session returns it). */
export const shopEntry = (id: number, name: string, status = "active", role = "owner") => ({
  id, name, logoUrl: null, verified: false, province: "Kabul", city: "Kabul", role, status,
});
