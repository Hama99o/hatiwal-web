import type { Page } from "@playwright/test";

/**
 * Patch the signed-in viewer for one test. The web reads `me` from the session
 * probe (`/api/auth/session` → `{ user }`, camelCase, auth-provider.tsx), not
 * from `/api/me/users/me`, so a viewer override must land HERE to take effect.
 * The patch is shallow-merged into `user`.
 */
export async function withSessionUser(page: Page, patch: Record<string, unknown>) {
  await page.route("**/api/auth/session", async (route) => {
    try {
      const res = await route.fetch();
      const json = await res.json();
      if (json?.user) json.user = { ...json.user, ...patch };
      await route.fulfill({ response: res, json });
    } catch (e) {
      // A test that is already done closes the page while a late session probe
      // is still in this handler; Playwright then fails the FINISHED test with
      // "Target page … has been closed while running route callback"
      // (verification-states:134, flaky). Only that case is swallowed.
      if (page.isClosed()) return;
      throw e;
    }
  });
}

/** A `me.shops[]` entry (camelCase, as the session returns it). */
export const shopEntry = (id: number, name: string, status = "active", role = "owner") => ({
  id, name, logoUrl: null, verified: false, province: "Kabul", city: "Kabul", role, status,
});
