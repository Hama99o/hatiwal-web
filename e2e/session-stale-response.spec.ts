import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

// Edge pass 1.1.6 (d0) — the web twin of mobile b46bf832. The /api/me proxy
// answers with Set-Cookie, and the browser applies it to the CURRENT cookie jar
// whichever session the request was sent as. A request still in flight from a
// session that has since ended (signed out, then signed in again) must not end
// or replace the new one. Reproduced deterministically: the old session's
// cookies are sent explicitly, and the jar is checked afterwards.
test.use({ storageState: BUYER_STATE });

const OLD_SESSION = "dta_access_token=dead-token; dta_client=old-client; dta_uid=old%40hatiwal.test";

test("a stale request's 401 does not sign the current session out", async ({ page, context }) => {
  await page.goto("/en/profile");
  await expect(page).not.toHaveURL(/\/login/);
  const token = async () => (await context.cookies()).find((c) => c.name === "dta_access_token")?.value;
  const before = await token();
  expect(before).toBeTruthy();

  const res = await page.request.get("/api/me/my/saved_listings", { headers: { cookie: OLD_SESSION } });
  expect(res.status()).toBe(401);

  expect(await token()).toBe(before);
  await page.goto("/en/profile");
  await expect(page).not.toHaveURL(/\/login/);
});
