import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import { shopEntry, withSessionUser } from "./session-user";
import ps from "../messages/ps.json";

/*
 * Edge-case pass, 2026-10-08 (api 0f1eff0 / acd1dbc / bca0004 / 7046c9b /
 * 1696243): the refusals the API now gives must read as a sentence in the
 * reader's language — never "Something went wrong", never the English server
 * text, never "check your connection" — and the page must keep working.
 *
 * BUYER_STATE is user 1: the seller of the mock's listings 1 (active) and 10
 * (expired), and (via asMember) a member of shop 42.
 */

const REMOVED_EN = "This listing was deleted, so it can't be renewed or copied.";

test.describe("A deleted listing", () => {
  test.use({ storageState: BUYER_STATE });

  test("Relaunch (renew) → 403 listing_removed: said in words, the page stays", async ({ page }) => {
    await page.route("**/api/me/my/listings/10/renew", (route) =>
      route.fulfill({ status: 403, json: { error: "this listing was deleted", code: "listing_removed" } }),
    );
    await page.goto("/en/my-listings/10");
    await page.getByRole("button", { name: "Relaunch" }).click();
    await expect(page.getByText(REMOVED_EN)).toBeVisible();
    await expect(page.getByText(/connection|Something went wrong/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Relaunch" })).toBeVisible();
  });

  test("Duplicate → 422 duplicate_removed: said in words, no draft opened", async ({ page }) => {
    await page.route("**/api/me/my/listings/1/duplicate", (route) =>
      route.fulfill({ status: 422, json: { error: "a removed listing cannot be duplicated", code: "duplicate_removed" } }),
    );
    await page.goto("/en/my-listings");
    const card = page.locator('a[href="/en/my-listings/1"]').locator("..");
    await expect(card).toBeVisible({ timeout: 60_000 });
    await card.getByRole("button", { name: /More options/ }).click();
    await page.getByTestId("duplicate-listing").click();
    await expect(page.getByText(REMOVED_EN)).toBeVisible();
    await expect(page).toHaveURL(/\/en\/my-listings$/);
  });

  test("ps: the same refusal in Pashto", async ({ page }) => {
    await page.route("**/api/me/my/listings/10/renew", (route) =>
      route.fulfill({ status: 403, json: { error: "this listing was deleted", code: "listing_removed" } }),
    );
    await page.goto("/ps/my-listings/10");
    await page.getByRole("button", { name: ps.listing.relaunch }).click();
    await expect(page.getByText(ps.listing.move.errors.removed)).toBeVisible();
  });
});

/** Make user 1 a member of shop 42; the returned setter changes what GET /shops/42 answers. */
async function asMember(page: Page, initial: "owner" | "manager" | "staff") {
  let role = initial;
  await withSessionUser(page, { sellerMode: true, shops: [shopEntry(42, "Safi Cosmetics", "active", initial)] });
  await page.route("**/api/me/shops/42", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    const json = await res.json();
    json.shop = { ...json.shop, role };
    await route.fulfill({ response: res, json });
  });
  return (next: typeof initial) => {
    role = next;
  };
}

test.describe("A team action refused because my role changed meanwhile", () => {
  test.use({ storageState: BUYER_STATE });

  test("a manager made Staff: forbidden in words, and the page reloads into the Staff view", async ({ page }) => {
    const setRole = await asMember(page, "manager");
    await page.route("**/api/me/shops/42/members/7", (route) =>
      route.request().method() === "DELETE"
        ? route.fulfill({ status: 403, json: { error: "x", code: "forbidden" } })
        : route.continue(),
    );
    await page.goto("/en/shops/42/team");
    await page.getByTestId("team-member-menu-7").click();
    await page.getByTestId("member-remove").click();
    setRole("staff"); // the owner demoted me while the dialog was open
    await page.getByRole("button", { name: "Remove from shop" }).click();
    await expect(page.getByText("Only the shop's owner can do that")).toBeVisible();
    await expect(page.getByTestId("team-member-menu-7")).toHaveCount(0);
    await expect(page.getByTestId("team-invite")).toHaveCount(0);
  });
});

test.describe("The ex-manager whose Verified request was cancelled (made Staff)", () => {
  test.use({ storageState: BUYER_STATE });

  test("no Verified card on the shop, and the verify URL goes back to the shop", async ({ page }) => {
    await asMember(page, "staff");
    await page.goto("/en/shops/42");
    await expect(page.getByTestId("shop-page")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("shop-verify-card")).toHaveCount(0);
    await expect(page.getByTestId("shop-verify-start")).toHaveCount(0);
    await page.goto("/en/shops/42/verify");
    await expect(page).toHaveURL(/\/en\/shops\/42$/, { timeout: 30_000 });
  });
});
