import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import { withSessionUser } from "./session-user";

/*
 * Owner, 2026-10-08: on Android in Pashto a 2-digit Persian count ("۳۸") was
 * clipped inside a small circle. Every count is the shared pill: min width =
 * height, digits in the reader's script, capped at 99+, and the header badge
 * sits off the icon.
 */
test.use({ storageState: BUYER_STATE });

test("Pashto: 38 unread reads ۳۸ in a pill, not clipped", async ({ page }) => {
  await withSessionUser(page, { unreadMessageCount: 38 });
  await page.goto("/ps");
  const badge = page.locator('a[href$="/conversations"] [data-testid="count-badge"]').first();
  await expect(badge).toHaveText("۳۸", { timeout: 30_000 });
  const box = (await badge.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(box.height);
  // The digits fit: the text's own box is no taller than the pill.
  const fits = await badge.evaluate((el) => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1);
  expect(fits).toBe(true);
});

test("caps at 99+", async ({ page }) => {
  await withSessionUser(page, { unreadMessageCount: 150 });
  await page.goto("/en");
  const badge = page.locator('a[href$="/conversations"] [data-testid="count-badge"]').first();
  await expect(badge).toHaveText(/^99\+$/, { timeout: 30_000 });
});
