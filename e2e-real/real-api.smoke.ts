import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import ps from "../messages/ps.json";

/*
 * Real-API web smoke for 1.1.6 (2026-10-08): the web against a REAL Rails API
 * on its own database, where the mock API could have drifted. One serial story
 * over the smoke seed's world (owner Omar with the shop "Smoke Bazaar",
 * manager Mina, staff Sami, buyer Bilal in Pashto). See playwright.real.config.ts.
 *
 * Steps that only the admin can take (approve a request, reply from Support)
 * run through `rails runner` in the API container, on the same smoke DB:
 *   SMOKE_API_CONTAINER   the container (default hatiwal-api-dev)
 *   SMOKE_DATABASE_URL    the smoke DB's URL (never the dev DB)
 */
const IDS = JSON.parse(process.env.SMOKE_IDS ?? "{}") as Record<string, number>;
const PASSWORD = "Password123!";

function rails(code: string): string {
  const container = process.env.SMOKE_API_CONTAINER ?? "hatiwal-api-dev";
  const db = process.env.SMOKE_DATABASE_URL;
  if (!db || !/hatiwal_smoke/.test(db)) throw new Error("SMOKE_DATABASE_URL must point at the smoke DB");
  return execFileSync(
    "docker",
    ["exec", "-i", "-e", `DATABASE_URL=${db}`, "-e", "MAIL_DELIVERY=test", container, "bash", "-lc",
     "cat > /tmp/smoke_step.rb && cd /rails && bin/rails runner /tmp/smoke_step.rb"],
    { input: code, encoding: "utf8", timeout: 120_000 },
  );
}

async function signIn(page: Page, who: string, locale = "en") {
  await page.context().clearCookies();
  await page.goto(`/${locale}/login`);
  await page.locator('input[type="email"]').fill(`smoke_${who}@hatiwal.test`);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 60_000 });
  await page.evaluate(() => window.localStorage.setItem("hatiwal.onboarded", "1"));
}

test.describe.configure({ mode: "serial" });

test("sign in (en) → the profile hub", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto("/en/profile");
  for (const row of ["activity", "help", "privacy-account", "settings"]) {
    await expect(page.locator(`a[href$="/profile/${row}"]`).first()).toBeVisible();
  }
});

test("verification: Under review → the admin approves → Verified", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto("/en/profile");
  await expect(page.getByTestId("verify-card")).toContainText(/Under review/);
  rails(`u = User.find_by!(email: "smoke_owner@hatiwal.test"); r = VerificationRequest.where(subject: u).requested.last; r.approve!(admin: AdminUser.first); puts r.reload.status`);
  await page.reload();
  await expect(page.getByTestId("verify-card")).toContainText(/Verified/);
});

test("posting: a draft from the form lands on its page", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto("/en/listings/new");
  await page.getByLabel("Title", { exact: true }).fill("Smoke Posted Kettle");
  await page.getByLabel("Price", { exact: true }).fill("900");
  await page.getByLabel("Category", { exact: true }).selectOption({ index: 1 });
  const location = page.getByLabel("Location", { exact: true });
  if (await location.count()) await location.fill("Herat");
  await page.getByRole("button", { name: "Save Draft" }).click();
  await expect(page).toHaveURL(/\/my-listings\/\d+/, { timeout: 30_000 });
});

test("expiry: Expired holds the lapsed ones (a held one too); Relaunch renews; a deleted one is refused in words", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto("/en/my-listings");
  await page.getByRole("tab", { name: /^Expired/ }).click();
  await expect(page.getByText("Smoke Expired Lamp")).toBeVisible();
  await expect(page.getByText("Smoke Held Expired Chair")).toBeVisible();

  await page.goto(`/en/my-listings/${IDS.expired}`);
  await page.getByRole("button", { name: "Relaunch" }).first().click();
  await expect(page.getByText(/renewed/i).first()).toBeVisible();

  await page.goto(`/en/my-listings/${IDS.reserved_expired}`);
  await expect(page.getByRole("button", { name: "Relaunch" }).first()).toBeVisible();

  // The real API's refusal shape for a deleted listing (no UI reaches it).
  const res = await page.request.put(`/api/me/my/listings/${IDS.removed}/renew`);
  expect([403, 404]).toContain(res.status());
  if (res.status() === 403) expect((await res.json()).code).toBe("listing_removed");
});

test("move and duplicate", async ({ page }) => {
  await signIn(page, "owner");
  const dup = await page.request.post(`/api/me/my/listings/${IDS.live}/duplicate`, { data: { shop_id: null } });
  expect(dup.status()).toBe(201);
  const copy = (await dup.json()).listing;
  expect(copy.status).toBe("draft");
  const move = await page.request.put(`/api/me/my/listings/${IDS.live}/move`, { data: { shop_id: IDS.shop } });
  expect(move.status()).toBe(200);
  expect((await move.json()).listing.shop?.id).toBe(IDS.shop);
  await page.goto(`/en/shops/${IDS.shop}`);
  await expect(page.getByText("Smoke Live Radio")).toBeVisible();
});

test("team: Mina and Sami listed; an invite link; a role change and back", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto(`/en/shops/${IDS.shop}/team`);
  await expect(page.getByText("Mina Noori")).toBeVisible();
  await expect(page.getByText("Sami Rahimi")).toBeVisible();
  await page.getByTestId("team-invite").click();
  await page.getByTestId("invite-share-link").click();
  await expect(page.getByTestId("invite-url")).toContainText(/\/join\//);
  await page.keyboard.press("Escape");
  const staffId = Number(rails(`puts User.find_by!(email: "smoke_staff@hatiwal.test").id`).trim().split("\n").pop());
  await page.goto(`/en/shops/${IDS.shop}/team`);
  await page.getByTestId(`team-member-menu-${staffId}`).click();
  await page.getByTestId("member-make-manager").click();
  await expect(page.getByText("Sami Rahimi is now Manager")).toBeVisible();
  await page.getByTestId(`team-member-menu-${staffId}`).click();
  await page.getByTestId("member-make-staff").click();
  await expect(page.getByText("Sami Rahimi is now Staff")).toBeVisible();
});

test("messages: the buyer sees the shop (never Sami); the team sees who replied", async ({ page }) => {
  await signIn(page, "buyer", "ps");
  await page.goto(`/ps/conversations/${IDS.shop_chat}`);
  await expect(page.getByText("Yes, come to the shop today.")).toBeVisible();
  await expect(page.getByText("Smoke Bazaar").first()).toBeVisible();
  await expect(page.getByTestId("message-team-sender-name")).toHaveCount(0);
  await expect(page.getByText("Sami Rahimi")).toHaveCount(0);

  await signIn(page, "owner");
  await page.goto(`/en/conversations/${IDS.shop_chat}`);
  await expect(page.getByTestId("message-team-sender-name").first()).toContainText("Sami");
});

test("Support: archived, then a new word from Support brings it back", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto("/en/conversations");
  await expect(page.locator(`a[href$="/conversations/${IDS.support}"]`)).toHaveCount(0);
  rails(`u = User.find_by!(email: "smoke_owner@hatiwal.test"); puts Admin::SendMessage.reply(admin: AdminUser.first, user: u, body: "We looked at your question.").call`);
  await page.reload();
  await expect(page.locator(`a[href$="/conversations/${IDS.support}"]`)).toBeVisible();
});

test("location copy (en + ps); and the ps hub", async ({ page }) => {
  await signIn(page, "buyer", "ps");
  await page.goto("/ps/bazaar");
  await expect(page.locator("body")).not.toContainText(/Iran|ایران/);
  await page.goto("/ps/profile");
  await expect(page.locator("body")).toContainText(ps.profile.hub.activity);
  await page.goto("/en/bazaar");
  await expect(page.locator("body")).not.toContainText(/Iran/);
});
