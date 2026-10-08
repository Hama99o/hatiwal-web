import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import { shopEntry, withSessionUser } from "./session-user";

/*
 * Tappable Support notices (owner, 2026-10-12): a Support notice carrying
 * `action` (api SupportNoticeJob::ACTIONS) gets a button under its bubble that
 * opens the target, as the right identity; a target that is gone is a toast.
 * Thread 1 is reshaped into a Support thread whose messages are the notices.
 */

type Row = { id: number } & Record<string, unknown>;
const SUPPORT_ACCOUNT = { id: 9000, name: "Hatiwal Support", city: null, verified: true, avatar_url: null };

const support = (row: Row): Row => ({
  ...row,
  kind: "support",
  viewer_role: null,
  listing: null,
  listing_deleted: true,
  other_participant: SUPPORT_ACCOUNT,
  seller: SUPPORT_ACCOUNT,
  blocked_with_participant: false,
  blocked_by_me: false,
});

const notice = (id: number, body: string, action: Record<string, unknown> | null, senderId = 9000) => ({
  id,
  body,
  kind: "text",
  read_at: null,
  created_at: `2026-10-07T10:0${id % 10}:00Z`,
  responds_to_id: null,
  deleted: false,
  sender: { id: senderId, name: senderId === 9000 ? "Hatiwal Support" : "Ahmad Karimi", avatar_url: null },
  attachment_url: null,
  action,
});

async function supportThreadWith(page: Page, messages: unknown[]) {
  await page.route("**/api/me/conversations/1", async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { conversation: Row };
    return route.fulfill({ response, json: { ...body, conversation: support(body.conversation) } });
  });
  await page.route(/\/api\/me\/conversations\/1\/messages(\?.*)?$/, (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          json: {
            messages,
            meta: { pagination: { current_page: 1, next_page: null, prev_page: null, total_count: messages.length, total_pages: 1 } },
          },
        })
      : route.fallback(),
  );
}

const invite = (token: string) => ({ type: "open_invite", label_key: "chat.noticeAction.openInvite", params: { token } });

test.describe("Tappable Support notices", () => {
  test.use({ storageState: BUYER_STATE });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("an invitation: the button under the notice opens it", async ({ page }) => {
    await supportThreadWith(page, [notice(1, "Umair invited you to join Safi Cosmetics as Staff.", invite("qa-team-mine"))]);
    await page.goto("/en/conversations/1");

    const button = page.getByTestId("notice-action-open_invite");
    await expect(button).toHaveText(/Open invitation/);
    await button.click();
    await expect(page).toHaveURL(/\/en\/join\/qa-team-mine$/);
  });

  test("an expired invitation: a friendly toast, nothing opened", async ({ page }) => {
    await supportThreadWith(page, [notice(1, "Umair invited you to join Safi Cosmetics as Staff.", invite("qa-team-expired"))]);
    await page.goto("/en/conversations/1");

    await page.getByTestId("notice-action-open_invite").click();
    await expect(page.getByText("This invitation has expired or was already answered.")).toBeVisible();
    await expect(page).toHaveURL(/\/en\/conversations\/1$/);
  });

  test("a shop: sells as that shop, then opens it", async ({ page }) => {
    await withSessionUser(page, { shops: [shopEntry(42, "Safi Cosmetics")], sellingAsShop: null });
    await page.route("**/api/me/users/me/selling_as", (route) =>
      route.fulfill({ json: { user: { id: 1, selling_as_shop: { id: 42, name: "Safi Cosmetics" } } } }),
    );
    await supportThreadWith(page, [
      notice(1, "Safi Cosmetics is verified.", { type: "open_shop", label_key: "chat.noticeAction.viewShop", params: { shop_id: 42 } }),
    ]);
    await page.goto("/en/conversations/1");

    const switched = page.waitForRequest((r) => r.method() === "PATCH" && r.url().endsWith("/users/me/selling_as"));
    await page.getByTestId("notice-action-open_shop").click();
    expect((await switched).postDataJSON()).toMatchObject({ shop_id: 42 });
    // The shop page is compiled on its first visit in dev: allow for it.
    await expect(page).toHaveURL(/\/en\/shops\/42$/, { timeout: 30_000 });
  });

  test("a shop the viewer was removed from: 'no longer on this shop's team'", async ({ page }) => {
    await supportThreadWith(page, [
      notice(1, "Gul joined Kabul Cosmetics as Staff.", { type: "open_team", label_key: "chat.noticeAction.viewTeam", params: { shop_id: 77 } }),
    ]);
    await page.goto("/en/conversations/1");

    await page.getByTestId("notice-action-open_team").click();
    await expect(page.getByText("You're no longer on this shop's team")).toBeVisible();
    await expect(page).toHaveURL(/\/en\/conversations\/1$/);
  });

  test("verification for me opens the person's own flow", async ({ page }) => {
    await supportThreadWith(page, [
      notice(1, "Your verification was not approved.", {
        type: "open_verification", label_key: "chat.noticeAction.tryVerificationAgain", params: { subject: "me" },
      }),
    ]);
    await page.goto("/en/conversations/1");

    await page.getByRole("button", { name: /Try verification again/ }).click();
    await expect(page).toHaveURL(/\/en\/profile\/verify$/);
  });

  // Owner bug, 2026-10-08: an old "Try again" reopened the flow while a
  // request was under review. The API sends the state NOW (params.state).
  test("verification under review NOW: 'Under review', opening the Profile, not the flow", async ({ page }) => {
    await supportThreadWith(page, [
      notice(1, "Your verification was not approved.", {
        type: "open_verification", label_key: "chat.noticeAction.tryVerificationAgain", params: { subject: "me", state: "requested" },
      }),
    ]);
    await page.goto("/en/conversations/1");
    await expect(page.getByRole("button", { name: /Try verification again/ })).toHaveCount(0);
    await page.getByRole("button", { name: /Under review/ }).click();
    await expect(page).toHaveURL(/\/en\/profile$/);
  });

  test("verified NOW: 'Verified ✓'", async ({ page }) => {
    await supportThreadWith(page, [
      notice(1, "Your verification was not approved.", {
        type: "open_verification", label_key: "chat.noticeAction.tryVerificationAgain", params: { subject: "me", state: "verified" },
      }),
    ]);
    await page.goto("/en/conversations/1");
    await expect(page.getByRole("button", { name: /Verified ✓/ })).toBeVisible();
  });

  test("no button without an action, for an unknown type, or on the viewer's own message", async ({ page }) => {
    await supportThreadWith(page, [
      notice(1, "Welcome to Hatiwal.", null),
      notice(2, "From a newer API.", { type: "open_moon", label_key: "chat.noticeAction.x", params: {} }),
      notice(3, "My own message.", invite("qa-team-mine"), 1),
    ]);
    await page.goto("/en/conversations/1");

    await expect(page.getByText("My own message.")).toBeVisible();
    await expect(page.locator('[data-testid^="notice-action-"]')).toHaveCount(0);
  });

  test("translated, with the chevron mirrored (ps, RTL)", async ({ page }) => {
    await supportThreadWith(page, [notice(1, "بلنه", invite("qa-team-mine"))]);
    await page.goto("/ps/conversations/1");

    const button = page.getByTestId("notice-action-open_invite");
    await expect(button).toHaveText(/بلنه پرانیزئ/);
    await expect(button.locator("svg")).toHaveCSS("scale", "-1 1");
  });
});
