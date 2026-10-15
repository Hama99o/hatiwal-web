import path from "node:path";
import { test, expect, type Page, type Route } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import { shopEntry, withSessionUser } from "./session-user";
import en from "../messages/en.json";
import ps from "../messages/ps.json";

/*
 * Error-handling sweep, 1.1.6 (2026-10-08). What the reader is told, per answer:
 *
 *  - no answer (fetch threw / our proxy's 502 upstream_failed) → "check your connection" — ONLY then
 *  - 429 rate_limited                                         → "too many attempts, try again later"
 *  - a known `code`                                           → its translated sentence
 *  - 500 / anything else                                      → "something went wrong" (never "connection")
 *  - 404 on a resource page                                   → "no longer available" + a way back
 *  - no double submit: a write is disabled while it is in flight
 *
 * Every case forces the answer with page.route against the mock API
 * (e2e/mock-api/server.mjs). BUYER_STATE is user 1 (seller of listings 1, 10;
 * buyer on listing 2, owned by seller 2; conversation 1 is theirs).
 */

const OFFLINE = en.common.offline;
const TOO_MANY = en.common.tooManyAttempts;
const SOMETHING_WRONG = en.common.somethingWrong;
const CONNECTION = /connection|internet/i;

const RATE_LIMITED = { error: "rate_limited", message: "Too many requests. Try again later." };

/** Answer `pattern` (non-GET only unless `allMethods`) with a status + body, or drop the connection. */
async function force(
  page: Page,
  pattern: string | RegExp,
  answer: { status: number; json?: unknown } | "offline",
  opts: { method?: string } = {},
) {
  let hits = 0;
  await page.route(pattern, (route: Route) => {
    if (opts.method && route.request().method() !== opts.method) return route.fallback();
    hits += 1;
    if (answer === "offline") return route.abort("internetdisconnected");
    return route.fulfill({ status: answer.status, json: answer.json ?? {} });
  });
  return () => hits;
}

/** Hold a request until `release()` — to look at the UI while a write is in flight. */
async function hold(page: Page, pattern: string | RegExp, method = "POST") {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let hits = 0;
  await page.route(pattern, async (route) => {
    if (route.request().method() !== method) return route.fallback();
    hits += 1;
    await gate;
    await route.fallback();
  });
  return { release: () => release(), hits: () => hits };
}

test.describe("Support: open the thread", () => {
  test.use({ storageState: BUYER_STATE });
  const SUPPORT = /\/api\/me\/support_conversation(\?.*)?$/;

  test("offline → check your connection", async ({ page }) => {
    await force(page, SUPPORT, "offline");
    await page.goto("/en/profile/help");
    await page.getByTestId("profile-row-contact-support").click();
    await expect(page.getByText(OFFLINE)).toBeVisible();
  });

  test("500 → generic, never 'connection'", async ({ page }) => {
    await force(page, SUPPORT, { status: 500, json: { error: "boom" } });
    await page.goto("/en/profile/help");
    await page.getByTestId("profile-row-contact-support").click();
    await expect(page.getByText(en.chat.support.openError)).toBeVisible();
    await expect(page.getByText(CONNECTION)).toHaveCount(0);
  });

  test("502 upstream_failed (Rails unreachable) → check your connection", async ({ page }) => {
    await force(page, SUPPORT, { status: 502, json: { error: "upstream_failed" } });
    await page.goto("/en/profile/help");
    await page.getByTestId("profile-row-contact-support").click();
    await expect(page.getByText(OFFLINE)).toBeVisible();
  });

  test("ps: 429 → too many attempts, in Pashto", async ({ page }) => {
    await force(page, SUPPORT, { status: 429, json: RATE_LIMITED });
    await page.goto("/ps/profile/help");
    await page.getByTestId("profile-row-contact-support").click();
    await expect(page.getByText(ps.common.tooManyAttempts)).toBeVisible();
  });
});

test.describe("Conversation thread", () => {
  test.use({ storageState: BUYER_STATE });
  const SEND = "**/api/me/conversations/1/messages";

  test("404 → 'no longer available' with a way back, not a spinner", async ({ page }) => {
    await force(page, "**/api/me/conversations/1", { status: 404, json: { error: "Not found" } }, { method: "GET" });
    await page.goto("/en/conversations/1");
    await expect(page.getByTestId("conversation-not-found")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(en.chat.thread.notFound)).toBeVisible();
    await page.getByRole("link", { name: en.chat.thread.backToMessages }).click();
    await expect(page).toHaveURL(/\/en\/conversations$/);
  });

  test("500 on load → error state with Retry, never 'connection'", async ({ page }) => {
    await force(page, "**/api/me/conversations/1", { status: 500 }, { method: "GET" });
    await page.goto("/en/conversations/1");
    await expect(page.getByText(en.chat.thread.loadFailed)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: en.common.retry })).toBeVisible();
    await expect(page.getByText(CONNECTION)).toHaveCount(0);
  });

  test("send: Enter twice while in flight sends ONE message", async ({ page }) => {
    const gate = await hold(page, SEND);
    await page.goto("/en/conversations/1");
    const input = page.getByPlaceholder(en.chat.messagePlaceholder);
    await input.fill("Is it still available?");
    await input.press("Enter");
    await input.press("Enter");
    await expect(page.getByRole("button", { name: en.chat.send, exact: true })).toBeDisabled();
    gate.release();
    await expect(input).toHaveValue("");
    expect(gate.hits()).toBe(1);
  });

  test("send offline → check your connection; the draft is kept", async ({ page }) => {
    await force(page, SEND, "offline", { method: "POST" });
    await page.goto("/en/conversations/1");
    const input = page.getByPlaceholder(en.chat.messagePlaceholder);
    await input.fill("Hello");
    await input.press("Enter");
    await expect(page.getByText(OFFLINE)).toBeVisible();
    await expect(input).toHaveValue("Hello");
  });

  test("send 429 → too many attempts", async ({ page }) => {
    await force(page, SEND, { status: 429, json: RATE_LIMITED }, { method: "POST" });
    await page.goto("/en/conversations/1");
    const input = page.getByPlaceholder(en.chat.messagePlaceholder);
    await input.fill("Hello");
    await input.press("Enter");
    await expect(page.getByText(TOO_MANY)).toBeVisible();
  });

  test("send 422 blocked_by → the translated block sentence", async ({ page }) => {
    await force(page, SEND, { status: 422, json: { error: "x", code: "blocked_by" } }, { method: "POST" });
    await page.goto("/en/conversations/1");
    const input = page.getByPlaceholder(en.chat.messagePlaceholder);
    await input.fill("Hello");
    await input.press("Enter");
    await expect(page.getByText(en.chat.blockedErrors.blockedBy)).toBeVisible();
  });

  test("send 500 → 'failed to send', never 'connection'", async ({ page }) => {
    await force(page, SEND, { status: 500 }, { method: "POST" });
    await page.goto("/en/conversations/1");
    const input = page.getByPlaceholder(en.chat.messagePlaceholder);
    await input.fill("Hello");
    await input.press("Enter");
    await expect(page.getByText(en.chat.thread.sendFailed)).toBeVisible();
    await expect(page.getByText(CONNECTION)).toHaveCount(0);
  });
});

test.describe("Start a chat / Message shop / Report", () => {
  test.use({ storageState: BUYER_STATE });

  async function openComposerOnListing2(page: Page) {
    await page.goto("/en/listings/2");
    const cta = page.getByRole("button", { name: en.listing.detail.contactSeller });
    await expect(async () => {
      await cta.click();
      await expect(page.getByPlaceholder("Ask about this item...")).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15_000 });
    await page.getByPlaceholder("Ask about this item...").fill("Still available?");
  }

  test("start chat 429 → too many attempts, stays on the listing", async ({ page }) => {
    await force(page, "**/api/me/listings/2/conversations", { status: 429, json: RATE_LIMITED }, { method: "POST" });
    await openComposerOnListing2(page);
    await page.getByRole("button", { name: "Send Message" }).click();
    await expect(page.getByText(TOO_MANY)).toBeVisible();
    await expect(page).toHaveURL(/\/en\/listings\/2$/);
  });

  test("start chat offline → check your connection", async ({ page }) => {
    await force(page, "**/api/me/listings/2/conversations", "offline", { method: "POST" });
    await openComposerOnListing2(page);
    await page.getByRole("button", { name: "Send Message" }).click();
    await expect(page.getByText(OFFLINE)).toBeVisible();
  });

  test("start chat 422 blocked → the block sentence (no 'existing thread' lookup)", async ({ page }) => {
    await force(page, "**/api/me/listings/2/conversations", { status: 422, json: { error: "x", code: "blocked" } }, { method: "POST" });
    await openComposerOnListing2(page);
    await page.getByRole("button", { name: "Send Message" }).click();
    await expect(page.getByText(en.chat.blockedErrors.blocked)).toBeVisible();
    await expect(page).toHaveURL(/\/en\/listings\/2$/);
  });

  test("Message shop offline → check your connection", async ({ page }) => {
    await force(page, "**/api/me/shops/42/conversations", "offline", { method: "POST" });
    await page.goto("/en/shops/42");
    await page.getByTestId("shop-message").click();
    await expect(page.getByText(OFFLINE)).toBeVisible();
  });

  test("Message shop 429 → its 'too many new chats' sentence", async ({ page }) => {
    await force(page, "**/api/me/shops/42/conversations", { status: 429, json: RATE_LIMITED }, { method: "POST" });
    await page.goto("/en/shops/42");
    await page.getByTestId("shop-message").click();
    await expect(page.getByText(en.shops.messageErrors.tooMany)).toBeVisible();
  });

  async function reportSeller2(page: Page) {
    await page.goto("/en/sellers/2");
    await expect(page.getByRole("button", { name: "Ahmad Karimi" })).toBeVisible({ timeout: 15_000 });
    const trigger = page.getByRole("button", { name: "Report", exact: true });
    await expect(async () => {
      await trigger.click();
      await expect(page.getByText("Why are you reporting this?")).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15_000 });
    await page.getByRole("button", { name: "Fraud or scam" }).click();
  }

  test("report 429 → too many attempts (not 'could not submit')", async ({ page }) => {
    await force(page, "**/api/me/reports", { status: 429, json: RATE_LIMITED }, { method: "POST" });
    await reportSeller2(page);
    await page.getByRole("button", { name: "Submit Report" }).click();
    await expect(page.getByText(TOO_MANY)).toBeVisible();
  });

  test("report offline → check your connection", async ({ page }) => {
    await force(page, "**/api/me/reports", "offline", { method: "POST" });
    await reportSeller2(page);
    await page.getByRole("button", { name: "Submit Report" }).click();
    await expect(page.getByText(OFFLINE)).toBeVisible();
  });

  test("report: double click files ONE report (disabled while in flight)", async ({ page }) => {
    const gate = await hold(page, "**/api/me/reports");
    await reportSeller2(page);
    const submit = page.getByRole("button", { name: "Submit Report" });
    await submit.dblclick();
    await expect(page.getByRole("button", { name: en.report.submitting })).toBeDisabled();
    gate.release();
    await expect(page.getByText(en.report.success)).toBeVisible();
    expect(gate.hits()).toBe(1);
  });

  test("block after report 500 → the block error, never 'connection'", async ({ page }) => {
    await force(page, /\/api\/me\/users\/2\/block$/, { status: 500 }, { method: "POST" });
    await reportSeller2(page);
    await page.getByRole("button", { name: "Submit Report" }).click();
    await page.getByRole("button", { name: en.report.block.confirmCta }).click();
    await expect(page.getByText(en.report.block.error)).toBeVisible();
    await expect(page.getByText(CONNECTION)).toHaveCount(0);
  });
});

test.describe("Selling: create / publish / lifecycle / duplicate", () => {
  test.use({ storageState: BUYER_STATE });

  async function fillNewListing(page: Page, withPin: boolean) {
    if (withPin) {
      await page.route(/nominatim\.openstreetmap\.org\/(search|reverse)/, (route) =>
        route.fulfill({ json: /\/reverse/.test(route.request().url())
          ? { display_name: "Kabul, Afghanistan", address: { city: "Kabul" } }
          : [{ lat: "34.5553", lon: "69.2075", display_name: "Kabul, Afghanistan" }] }),
      );
    }
    await page.goto("/en/listings/new");
    await page.getByLabel("Title", { exact: true }).fill("Vintage Radio");
    await page.getByLabel("Price", { exact: true }).fill("2500");
    await page.getByLabel("Category", { exact: true }).selectOption({ label: "Vehicles" });
    await page.getByLabel("Location", { exact: true }).fill("Kabul");
    if (withPin) {
      await page.getByRole("option", { name: /Kabul, Afghanistan/ }).click();
      await page.locator('input[type="file"]').first().setInputFiles(path.join(__dirname, "fixtures", "photo-a.png"));
    }
  }

  test("create 429 → too many attempts; the form keeps what was typed", async ({ page }) => {
    await force(page, "**/api/me/my/listings", { status: 429, json: RATE_LIMITED }, { method: "POST" });
    await fillNewListing(page, false);
    await page.getByRole("button", { name: "Save Draft" }).click();
    await expect(page.getByText(TOO_MANY)).toBeVisible();
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Vintage Radio");
  });

  test("create 500 → 'failed to save', never 'connection'", async ({ page }) => {
    await force(page, "**/api/me/my/listings", { status: 500 }, { method: "POST" });
    await fillNewListing(page, false);
    await page.getByRole("button", { name: "Save Draft" }).click();
    await expect(page.getByText(en.listing.form.saveError)).toBeVisible();
    await expect(page.getByText(CONNECTION)).toHaveCount(0);
  });

  test("Save Draft double click creates ONE listing", async ({ page }) => {
    const gate = await hold(page, "**/api/me/my/listings");
    await fillNewListing(page, false);
    await page.getByRole("button", { name: "Save Draft" }).dblclick();
    gate.release();
    await expect(page).toHaveURL(/\/my-listings\/1001/, { timeout: 20_000 });
    expect(gate.hits()).toBe(1);
  });

  test("created but publish refused → taken to the draft (no second create on retry)", async ({ page }) => {
    const publishes = await force(page, "**/api/me/my/listings/1001/publish", { status: 500 }, { method: "PUT" });
    let creates = 0;
    page.on("request", (r) => {
      if (r.method() === "POST" && new URL(r.url()).pathname === "/api/me/my/listings") creates += 1;
    });
    await fillNewListing(page, true);
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText(en.listing.form.publishError)).toBeVisible();
    await expect(page).toHaveURL(/\/my-listings\/1001/, { timeout: 20_000 });
    expect(publishes()).toBe(1);
    expect(creates).toBe(1);
  });

  test("Relaunch (renew, one tap) double click → ONE request", async ({ page }) => {
    const gate = await hold(page, "**/api/me/my/listings/10/renew", "PUT");
    await page.goto("/en/my-listings/10");
    await page.getByRole("button", { name: en.listing.relaunch }).dblclick();
    gate.release();
    await expect(page.getByText(/renewed|relaunched/i).first()).toBeVisible({ timeout: 15_000 });
    expect(gate.hits()).toBe(1);
  });

  test("renew 500 → 'something went wrong' (was just 'Error')", async ({ page }) => {
    await force(page, "**/api/me/my/listings/10/renew", { status: 500 }, { method: "PUT" });
    await page.goto("/en/my-listings/10");
    await page.getByRole("button", { name: en.listing.relaunch }).click();
    await expect(page.getByText(SOMETHING_WRONG)).toBeVisible();
    await expect(page.getByText(CONNECTION)).toHaveCount(0);
  });

  test("mark sold offline → check your connection; the prompt stays to retry", async ({ page }) => {
    await force(page, "**/api/me/my/listings/1/sold", "offline", { method: "PUT" });
    await page.goto("/en/my-listings/1");
    await page.getByRole("button", { name: "Mark as Sold" }).first().click();
    await page.getByRole("button", { name: /Sold to someone not on Hatiwal/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm sold" }).click();
    await expect(page.getByText(OFFLINE)).toBeVisible();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("duplicate 429 → too many attempts, no draft opened", async ({ page }) => {
    await force(page, "**/api/me/my/listings/1/duplicate", { status: 429, json: RATE_LIMITED }, { method: "POST" });
    await page.goto("/en/my-listings");
    const card = page.locator('a[href="/en/my-listings/1"]').locator("..");
    await expect(card).toBeVisible({ timeout: 60_000 });
    await card.getByRole("button", { name: /More options/ }).click();
    await page.getByTestId("duplicate-listing").click();
    await expect(page.getByText(TOO_MANY)).toBeVisible();
    await expect(page).toHaveURL(/\/en\/my-listings$/);
  });
});

test.describe("Auth forms (guest)", () => {
  async function signIn(page: Page) {
    await page.goto("/en/login");
    await page.getByLabel(/Email/i).fill("buyer@hatiwal.test");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: /Sign In/i }).click();
  }

  test("sign in 429 → too many attempts, not 'check your email and password'", async ({ page }) => {
    await force(page, "**/api/auth/login", { status: 429, json: { error: "rate_limited" } });
    await signIn(page);
    await expect(page.getByText(TOO_MANY)).toBeVisible();
    await expect(page.getByText(en.auth.loginError)).toHaveCount(0);
  });

  test("sign in offline → check your connection", async ({ page }) => {
    await force(page, "**/api/auth/login", "offline");
    await signIn(page);
    await expect(page.getByText(OFFLINE)).toBeVisible();
  });

  test("sign in, Rails 5xx → something went wrong", async ({ page }) => {
    await force(page, "**/api/auth/login", { status: 500, json: { error: "server_error" } });
    await signIn(page);
    await expect(page.getByText(SOMETHING_WRONG)).toBeVisible();
    await expect(page.getByText(en.auth.loginError)).toHaveCount(0);
  });

  test("sign up 429 → too many attempts", async ({ page }) => {
    await force(page, "**/api/auth/register", { status: 429, json: { error: "rate_limited" } });
    await page.goto("/en/signup");
    await page.locator("#firstname").fill("Sara");
    await page.locator("#lastname").fill("Ahmadi");
    await page.locator("#email").fill("sara@example.com");
    await page.locator("#password").fill("Password123!");
    await page.locator("#passwordConfirmation").fill("Password123!");
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByText(TOO_MANY)).toBeVisible();
  });

  test("forgot password 429 → too many attempts, NOT 'link sent'", async ({ page }) => {
    await force(page, "**/api/auth/forgot-password", { status: 429, json: { error: "rate_limited" } });
    await page.goto("/en/forgot-password");
    await page.locator("#email").fill("sara@example.com");
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByText(TOO_MANY)).toBeVisible();
    await expect(page.getByText(en.auth.resetLinkSent)).toHaveCount(0);
  });

  test("ps: sign in 429 in Pashto", async ({ page }) => {
    await force(page, "**/api/auth/login", { status: 429, json: { error: "rate_limited" } });
    await page.goto("/ps/login");
    await page.locator("#email").fill("buyer@hatiwal.test");
    await page.locator("#password").fill("Password123!");
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByText(ps.common.tooManyAttempts)).toBeVisible();
  });
});

test.describe("Shop create / verification apply", () => {
  test.use({ storageState: BUYER_STATE });

  /** Resume a finished shop draft at "Check and open" (same trick as shops.spec). */
  async function shopDraftAtReview(page: Page) {
    await page.goto("/en/profile");
    await page.evaluate(() =>
      window.localStorage.setItem(
        "hatiwal.shop-draft",
        JSON.stringify({
          userId: 1, step: "review", name: "Kabul Phones", description: "", categoryId: 1,
          latitude: 34.55, longitude: 69.2, addressLine: "Shar-e Naw, Kabul",
          hoursPreset: null, hours: {}, phone: "", phonePublic: false,
        }),
      ),
    );
    await page.goto("/en/shops/new");
  }

  test("shop create 500 → 'couldn't save, try again', never 'connection'", async ({ page }) => {
    await force(page, "**/api/me/shops", { status: 500 }, { method: "POST" });
    await shopDraftAtReview(page);
    await page.getByTestId("shop-form-open").click();
    await expect(page.getByText(en.shops.form.review.failed)).toBeVisible();
    await expect(page.getByText(CONNECTION)).toHaveCount(0);
  });

  test("shop create offline → check your connection", async ({ page }) => {
    await force(page, "**/api/me/shops", "offline", { method: "POST" });
    await shopDraftAtReview(page);
    await page.getByTestId("shop-form-open").click();
    await expect(page.getByText(OFFLINE)).toBeVisible();
  });

  test("shop create 429 → its 'opened many shops today' sentence", async ({ page }) => {
    await force(page, "**/api/me/shops", { status: 429, json: RATE_LIMITED }, { method: "POST" });
    await shopDraftAtReview(page);
    await page.getByTestId("shop-form-open").click();
    await expect(page.getByText(en.shops.form.review.tooMany)).toBeVisible();
  });

  async function submitVerification(page: Page) {
    await page.goto("/en/profile/verify");
    for (let i = 0; i < 3; i++) await page.getByTestId("verify-next").click();
    for (let i = 0; i < 3; i++) {
      await page.getByTestId("verify-photo-input").setInputFiles("e2e/fixtures/photo-a.png");
      await expect(page.getByTestId("verify-photo-preview")).toBeVisible();
      await page.getByTestId("verify-photo-use").click();
    }
    await page.getByTestId("verify-number-input").fill("1234564821");
    await page.getByTestId("verify-next").click();
    await page.getByTestId("verify-submit").click();
  }

  test("verification 500 → 'couldn't send', not 'Error' / 'connection'", async ({ page }) => {
    await force(page, "**/api/me/verification_requests", { status: 500 }, { method: "POST" });
    await submitVerification(page);
    await expect(page.getByTestId("verify-submit-error")).toHaveText(en.verify.review.failed);
  });

  test("verification 502 upstream_failed → check your connection (not the word 'upstream_failed')", async ({ page }) => {
    await force(page, "**/api/me/verification_requests", { status: 502, json: { error: "upstream_failed" } }, { method: "POST" });
    await submitVerification(page);
    await expect(page.getByTestId("verify-submit-error")).toHaveText(OFFLINE);
  });

  test("verification 429 → its 'tried 3 times today' sentence", async ({ page }) => {
    await force(page, "**/api/me/verification_requests", { status: 429, json: RATE_LIMITED }, { method: "POST" });
    await submitVerification(page);
    await expect(page.getByText(en.verify.review.tooMany)).toBeVisible();
  });
});

test.describe("Shop team + invite page", () => {
  test.use({ storageState: BUYER_STATE });

  async function asOwnerOf42(page: Page) {
    await withSessionUser(page, { sellerMode: true, shops: [shopEntry(42, "Safi Cosmetics", "active", "owner")] });
    await page.route("**/api/me/shops/42", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const res = await route.fetch();
      const json = await res.json();
      json.shop = { ...json.shop, role: "owner" };
      await route.fulfill({ response: res, json });
    });
  }

  test("invite create 429 (rate_limited, no team code) → too many attempts", async ({ page }) => {
    await asOwnerOf42(page);
    await force(page, "**/api/me/shops/42/invites", { status: 429, json: RATE_LIMITED }, { method: "POST" });
    await page.goto("/en/shops/42/team");
    await page.getByTestId("team-invite").click();
    await page.getByTestId("invite-share-link").click();
    await expect(page.getByText(TOO_MANY)).toBeVisible();
  });

  test("invite create offline → check your connection (was 'Something went wrong')", async ({ page }) => {
    await asOwnerOf42(page);
    await force(page, "**/api/me/shops/42/invites", "offline", { method: "POST" });
    await page.goto("/en/shops/42/team");
    await page.getByTestId("team-invite").click();
    await page.getByTestId("invite-share-link").click();
    await expect(page.getByText(OFFLINE)).toBeVisible();
  });

  test("invite page 404 → 'expired' state with a way to the Bazaar, never a spinner", async ({ page }) => {
    await force(page, "**/api/proxy/shop_invites/qa-gone", { status: 404, json: { error: "Not found" } });
    await page.goto("/en/join/qa-gone");
    await expect(page.getByTestId("join-error-invite_expired")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("join-error-action").click();
    await expect(page).toHaveURL(/\/en\/bazaar/);
  });

  test("invite page 429 → retry state that says 'too many', not 'connection'", async ({ page }) => {
    await force(page, "**/api/proxy/shop_invites/qa-team-link", { status: 429, json: RATE_LIMITED });
    await page.goto("/en/join/qa-team-link");
    await expect(page.getByTestId("join-load-error-reason")).toHaveText(TOO_MANY, { timeout: 15_000 });
    await expect(page.getByTestId("join-retry")).toBeVisible();
  });

  test("invite page offline → check your connection + Retry", async ({ page }) => {
    await force(page, "**/api/proxy/shop_invites/qa-team-link", "offline");
    await page.goto("/en/join/qa-team-link");
    await expect(page.getByTestId("join-load-error-reason")).toHaveText(OFFLINE, { timeout: 30_000 });
  });
});

test.describe("Resource pages: 404 says 'no longer available', with the way back", () => {
  // Server-rendered: the mock API itself answers 404 for these ids.
  test("listing", async ({ page }) => {
    const resp = await page.goto("/en/listings/99999");
    expect(resp?.status()).toBe(404);
    await expect(page.getByTestId("listing-unavailable")).toContainText(en.listing.detail.unavailableNotice);
    await page.getByTestId("listing-unavailable").getByRole("link").click();
    await expect(page).toHaveURL(/\/en\/bazaar/);
  });

  test("shop", async ({ page }) => {
    const resp = await page.goto("/en/shops/999");
    expect(resp?.status()).toBe(404);
    await expect(page.getByTestId("shop-unavailable")).toContainText(en.common.noLongerAvailable);
    await expect(page.getByTestId("shop-unavailable").getByRole("link")).toHaveAttribute("href", "/en/bazaar");
  });

  test("seller profile", async ({ page }) => {
    const resp = await page.goto("/en/sellers/99999");
    expect(resp?.status()).toBe(404);
    await expect(page.getByTestId("seller-unavailable")).toContainText(en.common.noLongerAvailable);
  });

  test("ps: shop 404 in Pashto", async ({ page }) => {
    await page.goto("/ps/shops/999");
    await expect(page.getByTestId("shop-unavailable")).toContainText(ps.common.noLongerAvailable);
  });
});

test.describe("Seller's own listing views (client-loaded)", () => {
  test.use({ storageState: BUYER_STATE });

  test("manage page 404 (deleted meanwhile) → 'no longer available' + back to My Listings", async ({ page }) => {
    await force(page, "**/api/me/my/listings/1", { status: 404, json: { error: "Not found" } }, { method: "GET" });
    await page.goto("/en/my-listings/1");
    await expect(page.getByTestId("manage-listing-error")).toContainText(en.listing.detail.unavailableNotice, { timeout: 15_000 });
    await page.getByTestId("manage-listing-error").getByRole("link", { name: en.listing.myListings }).click();
    await expect(page).toHaveURL(/\/en\/my-listings$/);
  });

  test("manage page 500 → 'something went wrong' + Retry, never 'connection'", async ({ page }) => {
    await force(page, "**/api/me/my/listings/1", { status: 500 }, { method: "GET" });
    await page.goto("/en/my-listings/1");
    await expect(page.getByTestId("manage-listing-error")).toContainText(en.common.errorTitle, { timeout: 15_000 });
    await expect(page.getByRole("button", { name: en.common.retry })).toBeVisible();
    await expect(page.getByText(CONNECTION)).toHaveCount(0);
  });

  test("edit page 404 → 'no longer available', not a bare 'Error'", async ({ page }) => {
    await force(page, "**/api/me/my/listings/1", { status: 404, json: { error: "Not found" } }, { method: "GET" });
    await page.goto("/en/listings/1/edit");
    await expect(page.getByTestId("edit-listing-error")).toContainText(en.listing.detail.unavailableNotice, { timeout: 15_000 });
  });
});
