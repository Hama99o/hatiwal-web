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

// One real sign-in per person, then their session cookies are reused: the
// API rate-limits sign_in per IP (429 after a dozen in a couple of minutes).
const sessions = new Map<string, Awaited<ReturnType<import("@playwright/test").BrowserContext["cookies"]>>>();

async function signIn(page: Page, who: string, locale = "en") {
  // Returning users: onboarding seen, and the one-time "Sell as…" question
  // (users with a shop) already answered — keyed by user id; the smoke seed's
  // users are the first few ids of its fresh DB.
  await page.addInitScript(() => {
    window.localStorage.setItem("hatiwal.onboarded", "1");
    for (let id = 1; id <= 10; id++) window.localStorage.setItem(`hatiwal.sell-as-asked-${id}`, "1");
  });
  await page.context().clearCookies();
  const saved = sessions.get(who);
  if (saved) {
    await page.context().addCookies(saved);
    return;
  }
  await page.goto(`/${locale}/login`);
  await page.locator('input[type="email"]').fill(`smoke_${who}@hatiwal.test`);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 60_000 });
  sessions.set(who, await page.context().cookies());
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
  expect(res.status()).toBe(403);
  expect((await res.json()).code).toBe("listing_removed");
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
  // Support is per identity: the PERSON's thread is in "Selling as Me" (an
  // earlier step left the owner selling as the shop, whose inbox shows the
  // shop's Support thread instead).
  const asMe = await page.request.patch("/api/me/users/me/selling_as", { data: { shop_id: null } });
  expect(asMe.ok()).toBe(true);
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

// ── 1.1.6 final gate (2026-10-09): what changed since the first smoke ─────────

test("privacy: en has no translation note; ps says it is a translation and links to /en/privacy", async ({ page }) => {
  await page.goto("/en/privacy");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByTestId("privacy-translation-note")).toHaveCount(0);
  await page.goto("/ps/privacy");
  const note = page.getByTestId("privacy-translation-note");
  await expect(note).toBeVisible();
  await expect(note.locator("a")).toHaveAttribute("href", "/en/privacy");
});

test("photo variants: a listing card asks for a THUMB, and that url serves an image", async ({ page }) => {
  await page.goto("/en/bazaar");
  const card = page.locator(`a[href="/en/listings/${IDS.live}"] img`).first();
  await expect(card).toBeVisible({ timeout: 60_000 });
  const src = await card.getAttribute("src");
  expect(src, "the card's src is a Rails variant (representation), not the original blob").toMatch(/\/rails\/active_storage\/representations\//);
  const res = await page.request.get(src!); // follows the redirect to the stored variant
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/^image\/(webp|jpeg)/);
  // A real image, not an error page: WebP (RIFF…WEBP) or JPEG (FF D8) magic bytes.
  // Tiny is fine — the seed's photo is a 48x48 fixture (its WebP is ~80 bytes).
  const body = await res.body();
  expect(body.subarray(0, 4).toString("latin1") === "RIFF" && body.subarray(8, 12).toString("latin1") === "WEBP" || (body[0] === 0xff && body[1] === 0xd8)).toBe(true);
  await expect.poll(() => card.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
});

test("suspend: the admin suspends the shop → a notice in the shop's Support thread; reactivate", async ({ page }) => {
  const out = rails(`
    ActiveJob::Base.queue_adapter = :inline
    shop = Shop.find_by!(name: "Smoke Bazaar")
    shop.suspend!(reason: "a smoke check")
    t = Conversation.admin_shop_support_thread_for(shop)
    abort "no shop Support thread" unless t
    m = t.messages.order(:id).last
    puts "THREAD=#{t.id}"
    puts "LAST=#{m&.body}"
  `);
  expect(out).toMatch(/LAST=Smoke Bazaar is suspended by Hatiwal: a smoke check\./);
  const thread = Number(/THREAD=(\d+)/.exec(out)![1]);
  await signIn(page, "owner");
  await page.goto(`/en/conversations/${thread}`);
  await expect(page.getByText(/Smoke Bazaar is suspended by Hatiwal: a smoke check\./)).toBeVisible({ timeout: 30_000 });
  rails(`ActiveJob::Base.queue_adapter = :inline; Shop.find_by!(name: "Smoke Bazaar").reactivate!`);
});

test("closed shop: the buyer's old messages still show the shop, never the staff member", async ({ page }) => {
  rails(`ActiveJob::Base.queue_adapter = :inline; s = Shop.find_by!(name: "Smoke Bazaar"); s.close!; puts s.reload.status`);
  await signIn(page, "buyer", "ps");
  await page.goto(`/ps/conversations/${IDS.shop_chat}`);
  await expect(page.getByText("Yes, come to the shop today.")).toBeVisible();
  // CLOSED_SHOP_FACE.md: what the team wrote as the shop keeps the shop's name,
  // marked Closed, with no person behind it. (The chat itself now continues with
  // the owner personally, so his name in the header / inbox is by design.)
  const shopLabel = page.getByTestId("message-closed-shop-sender");
  await expect(shopLabel.first()).toBeVisible();
  await expect(shopLabel.first().getByTestId("message-closed-shop-name")).toHaveText("Smoke Bazaar");
  await expect(shopLabel.first().getByTestId("message-closed-shop-badge")).toBeVisible();
  await expect(shopLabel.first()).not.toContainText(/Sami|Omar/);
  await expect(page.getByText("Sami Rahimi")).toHaveCount(0);
});
