import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

/**
 * VER-1 + SHOP-1/2 verification cards on the web, state by state, against the
 * same shapes as the API (VerificationStatusSerializer) and the same testids as
 * mobile (VerificationCard / ShopVerificationCard). The mock answers "none", so
 * each state is served through page.route.
 *
 * Web = app parity: every reject reason the API can send (incl. the shop-only
 * proof_not_accepted) has its own sentence; an unknown code shows the
 * server's localized text; rejected → "Try again", revoked → "Apply again".
 */
const request = (over: Record<string, unknown> = {}) => ({
  id: 901, status: "rejected", document_type: "e_tazkira", name_on_document: "Ahmad Karimi",
  document_last4: "4821", files_count: 3, reason_code: null, created_at: "2026-10-04T10:00:00Z", decided_at: "2026-10-05T10:00:00Z",
  ...over,
});

async function serveStatus(page: Page, subject: string, status: Record<string, unknown>) {
  await page.route(new RegExp(`/api/me/verification_requests/current\\?subject=${subject.replace(":", "(:|%3A)")}$`), (route) =>
    route.fulfill({
      json: { verification_status: { verified_since: null, missing: [], reason: null, name_changed: false, request: null, ...status } },
    }),
  );
}

test.describe("Your verification card (Profile)", () => {
  test.use({ storageState: BUYER_STATE });

  test("under review: the sent date, the photo count, Cancel request", async ({ page }) => {
    await serveStatus(page, "me", { status: "requested", request: request({ status: "requested", decided_at: null }) });
    await page.goto("/en/profile");
    await expect(page.getByTestId("verify-card-status-requested")).toBeVisible();
    await expect(page.getByText("3 photos sent")).toBeVisible();
    await expect(page.getByTestId("verify-cancel")).toBeVisible();
  });

  const reasons: [string, string][] = [
    ["photo_not_clear", "The photo is not clear"],
    ["name_mismatch", "The name does not match your document"],
    ["selfie_mismatch", "The selfie is missing or does not match the document"],
    ["document_not_accepted", "This document is not accepted"],
    ["proof_not_accepted", "The proof of business was not accepted"],
  ];
  for (const [code, sentence] of reasons) {
    test(`rejected (${code}): its own sentence + Try again`, async ({ page }) => {
      await serveStatus(page, "me", { status: "rejected", reason: "server words", request: request({ reason_code: code }) });
      await page.goto("/en/profile");
      await expect(page.getByTestId("verify-card-reason")).toHaveText(sentence);
      await expect(page.getByTestId("verify-start")).toHaveText("Try again");
    });
  }

  test("rejected with 'other' or a code this build doesn't know: the server's own words", async ({ page }) => {
    await serveStatus(page, "me", { status: "rejected", reason: "Photo too dark (admin)", request: request({ reason_code: "some_future_reason" }) });
    await page.goto("/en/profile");
    await expect(page.getByTestId("verify-card-reason")).toHaveText("Photo too dark (admin)");
  });

  test("revoked: the reason + Apply again", async ({ page }) => {
    await serveStatus(page, "me", { status: "revoked", reason: "x", request: request({ status: "revoked", reason_code: "policy_violation" }) });
    await page.goto("/en/profile");
    await expect(page.getByTestId("verify-card-status-revoked")).toBeVisible();
    await expect(page.getByTestId("verify-card-reason")).toHaveText("Our rules were broken");
    await expect(page.getByTestId("verify-start")).toHaveText("Apply again");
  });

  test("verified: the badge line, no apply button", async ({ page }) => {
    await serveStatus(page, "me", { status: "verified", verified_since: "2026-10-01T00:00:00Z" });
    await page.goto("/en/profile");
    await expect(page.getByTestId("verify-card-status-verified")).toBeVisible();
    await expect(page.getByTestId("verify-start")).toHaveCount(0);
  });

  test("the name changed after approval: 'verify again'", async ({ page }) => {
    await serveStatus(page, "me", { status: "none", name_changed: true });
    await page.goto("/en/profile");
    await expect(page.getByTestId("verify-card-status-none")).toHaveText("Your name changed — verify again");
  });
});

test.describe("The shop's verification card (shop page, owner)", () => {
  test.use({ storageState: BUYER_STATE });

  // Make the buyer persona a member of shop 42, so the owner's card shows.
  test.beforeEach(async ({ page }) => {
    await page.route(/\/api\/me\/users\/me(\?|$)/, async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const res = await route.fetch();
      const json = await res.json();
      json.user = {
        ...json.user,
        seller_mode: true,
        shops: [{ id: 42, name: "Safi Cosmetics", logo_url: null, verified: false, province: "Kabul", city: "Kabul", role: "owner", status: "active" }],
      };
      await route.fulfill({ response: res, json });
    });
  });

  test("under review", async ({ page }) => {
    await serveStatus(page, "shop:42", { status: "requested", request: request({ status: "requested", decided_at: null }) });
    await page.goto("/en/shops/42");
    await expect(page.getByTestId("shop-verify-card-status-requested")).toBeVisible();
  });

  test("rejected for the proof: its sentence + Try again into the person's form + proof", async ({ page }) => {
    await serveStatus(page, "shop:42", { status: "rejected", reason: "x", request: request({ reason_code: "proof_not_accepted" }) });
    await page.goto("/en/shops/42");
    await expect(page.getByTestId("shop-verify-card-reason")).toHaveText("The proof of business was not accepted");
    await page.getByTestId("shop-verify-start").click();
    await expect(page.getByTestId("shop-verify-progress-label")).toHaveText("Step 1 of 9");
  });

  test("verified: no card at all (the badge says it)", async ({ page }) => {
    await serveStatus(page, "shop:42", { status: "verified", verified_since: "2026-10-01T00:00:00Z" });
    await page.goto("/en/shops/42");
    await expect(page.getByTestId("shop-page")).toBeVisible();
    await expect(page.getByTestId("shop-verify-card")).toHaveCount(0);
  });
});

test.describe("Selling as, with several shops (SHOP-2)", () => {
  test.use({ storageState: BUYER_STATE });

  test("the sheet lists Me + every ACTIVE shop (not a pending one), with their unread", async ({ page }) => {
    await page.route(/\/api\/me\/users\/me(\?|$)/, async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const res = await route.fetch();
      const json = await res.json();
      const card = (id: number, name: string, status = "active") => ({ id, name, logo_url: null, verified: false, province: "Kabul", city: "Kabul", role: "owner", status });
      json.user = {
        ...json.user,
        seller_mode: true,
        shops: [card(42, "Safi Cosmetics"), card(43, "Safi Phones"), card(44, "Safi Shoes", "pending")],
        selling_as_shop: null,
        unread_counts: { buying: 0, selling_me: 0, shops: { "43": 5 } },
      };
      await route.fulfill({ response: res, json });
    });
    // The sheet asks once by itself; mark it asked so the pill opens it.
    await page.addInitScript(() => window.localStorage.setItem("hatiwal.sell-as-asked-1", "1"));
    await page.goto("/en/my-listings");
    await page.getByTestId("selling-as-pill").click();
    await expect(page.getByTestId("sell-as-sheet")).toBeVisible();
    await expect(page.getByTestId("sell-as-option-me")).toBeVisible();
    await expect(page.getByTestId("sell-as-option-shop-42")).toBeVisible();
    await expect(page.getByTestId("sell-as-option-shop-43")).toContainText("5");
    await expect(page.getByTestId("sell-as-option-shop-44")).toHaveCount(0);
  });
});
