import { test, expect, type Page, type Route } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
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
    await expect(page.getByRole("button", { name: en.chat.send })).toBeDisabled();
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
