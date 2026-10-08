import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import { shopEntry, withSessionUser } from "./session-user";

/*
 * Owner, 2026-10-08: a shop's TEAM sees who posted each product, and the
 * shop's numbers per member. The mock viewer is user 1.
 */
test.use({ storageState: BUYER_STATE });

async function patchJson(page: Page, url: RegExp, patch: (body: Record<string, unknown>) => void) {
  await page.route(url, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const res = await route.fetch();
    const body = (await res.json()) as Record<string, unknown>;
    patch(body);
    return route.fulfill({ response: res, json: body });
  });
}

test("My shop: each product says who posted it — 'you' for yourself", async ({ page }) => {
  await patchJson(page, /\/api\/me\/my\/listings(\?.*)?$/, (body) => {
    const rows = body.listings as Record<string, unknown>[];
    rows[0].posted_by = { id: 9, name: "Ali Staff" };
    if (rows[1]) rows[1].posted_by = { id: 1, name: "Ahmad Karimi" };
  });
  await page.goto("/en/my-listings");
  const lines = page.getByTestId("seller-card-posted-by");
  await expect(lines.first()).toHaveText("Posted by Ali Staff", { timeout: 30_000 });
  await expect(lines.nth(1)).toHaveText("Posted by you");
});

test("a shop's numbers: the Team section, Persian digits on /ps", async ({ page }) => {
  await withSessionUser(page, { sellerMode: true, shops: [shopEntry(42, "Safi Cosmetics", "active", "owner")] });
  await page.addInitScript(() => window.localStorage.setItem("hatiwal.sell-as-asked-1", "1"));
  await patchJson(page, /\/api\/me\/my\/analytics(\?.*)?$/, (body) => {
    (body.analytics as Record<string, unknown>).team = [
      { user: { id: 1, name: "Ahmad Karimi", avatar_url: null }, role: "owner", posted: 2, active: 1, expired: 1, sold: 0 },
      { user: { id: 9, name: "Ali Staff", avatar_url: null }, role: "staff", posted: 12, active: 10, expired: 2, sold: 3 },
    ];
    (body.analytics as Record<string, unknown>).team_unattributed = { posted: 0, active: 0, expired: 0, sold: 1 };
  });

  await page.goto("/en/analytics?shop=42");
  const team = page.getByTestId("analytics-team");
  await expect(team.getByRole("heading", { name: "Team" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("analytics-team-1")).toContainText("You");
  await expect(page.getByTestId("analytics-team-9")).toContainText("Ali Staff");
  await expect(page.getByTestId("analytics-team-9")).toContainText("Staff");
  await expect(page.getByTestId("analytics-team-9-posted")).toContainText("12");
  await expect(page.getByTestId("analytics-team-other-sold")).toContainText("1");

  await page.goto("/ps/analytics?shop=42");
  await expect(page.getByTestId("analytics-team-9-posted")).toContainText("۱۲", { timeout: 30_000 });
});
