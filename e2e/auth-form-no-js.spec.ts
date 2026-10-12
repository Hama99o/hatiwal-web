import { test, expect, type Browser } from "@playwright/test";

/**
 * Night QA (dd, 2026-10-12): the auth forms had no `method` and their inputs
 * carry `name`s (react-hook-form `register`). A submit before React hydrated
 * (a slow 2G/3G link, or a busy server) was the browser's native GET, which
 * put the email AND password in the URL:
 *   /en/login?email=empty%40hatiwal.test&password=Password123%21
 * and from there in browser history and every access log on the way.
 * Two layers now: the submit button stays disabled until hydration, and the
 * form is method="post", so even a submit that gets through stays out of the URL.
 */
const SECRET = "e2e-Secret-123!";
const EMAIL = "e2e-nojs@hatiwal.test";

const FORMS = [
  { path: "/en/login", fields: ["email", "password"] },
  { path: "/en/signup", fields: ["email", "password", "passwordConfirmation"] },
  { path: "/en/forgot-password", fields: ["email"] },
  { path: "/en/reset-password?token=e2e-token", fields: ["password", "passwordConfirmation"] },
];

async function noJsPage(browser: Browser, baseURL: string | undefined) {
  const ctx = await browser.newContext({ javaScriptEnabled: false, baseURL });
  return { ctx, page: await ctx.newPage() };
}

for (const { path, fields } of FORMS) {
  test.describe(path, () => {
    test("before hydration: submit is disabled, the form posts, Enter puts nothing in the URL", async ({
      browser,
    }, testInfo) => {
      const { ctx, page } = await noJsPage(browser, testInfo.project.use.baseURL);
      await page.goto(path);
      const form = page.locator(`form:has(input[name="${fields[0]}"])`);
      await expect(form).toHaveAttribute("method", "post");
      await expect(form.locator('button[type="submit"]')).toBeDisabled();

      for (const name of fields) {
        await form.locator(`input[name="${name}"]`).fill(name === "email" ? EMAIL : SECRET);
      }
      // Implicit submission (Enter in a field) is what a disabled button blocks.
      await form.locator(`input[name="${fields[fields.length - 1]}"]`).press("Enter");
      await page.waitForLoadState("load");
      // Only the query string: two of the paths themselves say "password".
      const query = decodeURIComponent(new URL(page.url()).search);
      expect(query).not.toMatch(/password|email/i);
      expect(query).not.toContain(SECRET);
      expect(query).not.toContain(EMAIL);
      await ctx.close();
    });

    test("a raw form POST to the page neither errors nor echoes the secret", async ({ request }) => {
      const form = Object.fromEntries(fields.map((n) => [n, n === "email" ? EMAIL : SECRET]));
      const res = await request.post(path, { form, maxRedirects: 0 });
      expect(res.status()).toBeLessThan(500);
      expect(await res.text()).not.toContain(SECRET);
    });
  });
}

test("after hydration the submit button is enabled", async ({ page }) => {
  await page.goto("/en/login");
  await expect(page.getByRole("button", { name: /Sign In/i })).toBeEnabled();
});
