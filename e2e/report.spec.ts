import { test, expect, type Page, type Request } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import en from "../messages/en.json";

/**
 * The listing page's seller CTA, READ FROM THE CATALOG rather than retyped, the
 * same way `listing-action-bar.spec.ts` does it: a copy change to
 * `listing.detail.contactSeller` must not leave this suite waiting for a string
 * the UI no longer shows.
 */
const CTA_LABEL = en.listing.detail.contactSeller;

// Report is hidden on your own content, so we report listing 2 (owned by
// seller 2, not the buyer persona who is seller 1).
test.describe("Report a listing", () => {
  test.use({ storageState: BUYER_STATE });

  test("opens the report dialog, requires a reason, then submits", async ({
    page,
  }) => {
    await page.goto("/en/listings/2");
    // Wait for the session to SETTLE before clicking. The seller CTA beside the
    // trigger is the page's auth tell, but its ELEMENT TYPE is not: a viewer whose
    // session is still resolving now gets a `<button aria-busy>` too (it used to
    // be an `<a href="/login">`, which is what made `getByRole("button")` a proxy
    // for "authed"). The absence of `aria-busy` is the tell that survives.
    await expectSettledCta(page);
    const trigger = page.getByRole("button", { name: "Report", exact: true });
    await expect(trigger).toBeVisible();
    // Retry click until the dialog opens (rides out client-island hydration).
    await expect(async () => {
      await trigger.click();
      await expect(
        page.getByText("Why are you reporting this?"),
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15_000 });

    const submit = page.getByRole("button", { name: "Submit Report" });
    await expect(submit).toBeDisabled(); // no reason chosen yet
    await page.getByRole("button", { name: "Spam" }).click();
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(
      page.getByText("Report submitted. Thank you."),
    ).toBeVisible();
  });

  test("the trigger is a thumb-sized target", async ({ page }) => {
    // It used to be bare inline text — a ~20px-tall tap target on the one
    // control a user reaches for when something is wrong. Now the shared Button
    // primitive, so it gets a real 40px hit box while keeping the quiet look.
    await page.goto("/en/listings/2");
    const trigger = page.getByRole("button", { name: "Report", exact: true });
    await expect(trigger).toBeVisible();
    const box = (await trigger.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(40);
  });

  test("a listing report never offers to block", async ({ page }) => {
    const blockCalls = trackBlockCalls(page);
    await page.goto("/en/listings/2");
    await expectSettledCta(page);
    await submitReport(page);
    // The block follow-up is for people, not items.
    await expect(blockPrompt(page)).toHaveCount(0);
    expect(blockCalls).toHaveLength(0);
  });

  test("a tap during auth bootstrap is held, not bounced to /login", async ({
    page,
  }) => {
    // Same defect the seller CTA and the save heart were fixed for, on the third
    // control of the same page: `status` is "loading" until /api/auth/session
    // answers, and the trigger read that as "not authed" and pushed /login — a
    // signed-in person who tapped Report during bootstrap was thrown off the very
    // page they were reporting, and their report was lost. Hold the probe to make
    // the window observable.
    let open: () => void = () => {};
    const gate = new Promise<void>((resolve) => (open = resolve));
    await page.route("**/api/auth/session", async (route) => {
      await gate;
      await route.continue();
    });

    await page.goto("/en/listings/2");
    const trigger = page.getByRole("button", { name: "Report", exact: true });
    await expect(trigger).toBeVisible();
    // It says it is not ready rather than looking identical to its ready state.
    await expect(trigger).toHaveAttribute("aria-busy", "true");

    // Every main-frame navigation across the click, by URL — not a bare count:
    // Next's own hydration does a same-document `replaceState` to the current
    // URL, which registers as a navigation, so a count of 0 is not the invariant.
    // "It never left this listing" is, and `toHaveURL` alone cannot express it
    // (it polls and passes on its first sample, so a bounce a tick later slips
    // through).
    const navigated: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigated.push(new URL(frame.url()).pathname);
    });
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-disabled", "true");
    // A real window for a bounce to show up in, rather than one raw sample.
    await page.waitForTimeout(500);
    expect(navigated.filter((p) => p !== "/en/listings/2")).toEqual([]);

    // Identity lands → the held tap opens the report dialog, on the listing.
    open();
    await page.unroute("**/api/auth/session");
    await expect(page.getByText("Why are you reporting this?")).toBeVisible();
    expect(navigated.filter((p) => p !== "/en/listings/2")).toEqual([]);
    await expect(page).toHaveURL(/\/en\/listings\/2$/);
  });
});

// ── Report → block follow-up (WEB-R612, mirrors mobile's ReportSheet) ────────

test.describe("Report a user → offer to block", () => {
  test.use({ storageState: BUYER_STATE });

  test("confirming the follow-up blocks the reported user", async ({ page }) => {
    const blockCalls = trackBlockCalls(page);
    await gotoSellerAuthed(page);
    await submitReport(page);

    await expect(blockPrompt(page)).toBeVisible();
    await expect(
      page.getByText(
        "Do you also want to block this user so they can't contact you or see your listings?",
      ),
    ).toBeVisible();

    await page.getByRole("button", { name: "Yes, block them" }).click();
    await expect(page.getByText("User blocked successfully.")).toBeVisible();
    await expect(blockPrompt(page)).toHaveCount(0);
    // Exactly one POST /users/2/block, for the reported seller.
    await expect
      .poll(() => blockCalls.map((r) => new URL(r.url()).pathname))
      .toEqual(["/api/me/users/2/block"]);
  });

  test("'Not now' closes the follow-up and blocks nobody", async ({ page }) => {
    const blockCalls = trackBlockCalls(page);
    await gotoSellerAuthed(page);
    await submitReport(page);

    await expect(blockPrompt(page)).toBeVisible();
    await page.getByRole("button", { name: "Not now" }).click();
    await expect(blockPrompt(page)).toHaveCount(0);
    await expect(page.getByText("User blocked successfully.")).toHaveCount(0);
    expect(blockCalls).toHaveLength(0);
  });

  test("someone already blocked is never offered again", async ({ page }) => {
    // Seller 3 (Najib Rahimi) is on the viewer's blocked list. Every surface
    // asks the same shared `["blocked-users"]` query, so the profile answers
    // this identically to the chat header — it is not a per-host prop any more.
    const blockCalls = trackBlockCalls(page);
    await gotoSellerAuthed(page, 3);
    await submitReport(page);
    await expect(blockPrompt(page)).toHaveCount(0);
    expect(blockCalls).toHaveLength(0);
  });

  test("a duplicate report is named, not swallowed as a generic error", async ({
    page,
  }) => {
    // Rails answers 422 `{ errors: [...] }` for "already reported" AND for
    // "can't report your own content". The status alone can't tell them apart,
    // so the reason has to survive the failed request — it used to be thrown
    // away, and the reporter was told "something went wrong" when in truth
    // their earlier report was already on file.
    await page.route("**/api/me/reports", (route) =>
      route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          errors: ["Reportable has already been reported by you"],
        }),
      }),
    );
    await gotoSellerAuthed(page);
    await fillAndSubmitReport(page);

    await expect(page.getByText("You have already reported this.")).toBeVisible();
    // A report that never landed must not offer a block follow-up.
    await expect(blockPrompt(page)).toHaveCount(0);
  });

  test("a failed block shows the error and keeps the report", async ({
    page,
  }) => {
    await page.route("**/api/me/users/*/block", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ errors: ["boom"] }),
      }),
    );
    await gotoSellerAuthed(page);
    await submitReport(page);

    await page.getByRole("button", { name: "Yes, block them" }).click();
    await expect(
      page.getByText("Could not block user. Please try again."),
    ).toBeVisible();
    // The report stands — its success toast is never retracted.
    await expect(page.getByText("Report submitted. Thank you.")).toBeVisible();
  });
});

test.describe("Report → block from the conversation thread", () => {
  test.use({ storageState: BUYER_STATE });

  test("confirming flips the header shield to unblock", async ({ page }) => {
    await page.goto("/en/conversations/1");
    await expect(
      page.getByText("Hello, I'm interested in the iPhone."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Block User" }),
    ).toBeVisible();

    await submitReport(page);
    await expect(blockPrompt(page)).toBeVisible();
    await page.getByRole("button", { name: "Yes, block them" }).click();
    await expect(page.getByText("User blocked successfully.")).toBeVisible();
    // Same header, no reload: the shield now offers unblock.
    await expect(
      page.getByRole("button", { name: "Unblock User" }),
    ).toBeVisible();
  });

  test("an already-blocked participant is never offered again", async ({
    page,
  }) => {
    // Conversation 2's participant (Najib Rahimi, #3) is on the viewer's
    // blocked list, so the follow-up has nothing to offer. The question is
    // answered by `GET /blocks` — the people *I* have blocked — and NOT by the
    // conversation's `blockedWithParticipant`, which is true in either
    // direction: reading that one would have denied the block to the person
    // being harassed, the very case this feature exists for.
    const blockCalls = trackBlockCalls(page);
    await page.goto("/en/conversations/2");
    await expect(page.getByText("Thanks!")).toBeVisible();

    await submitReport(page);
    await expect(blockPrompt(page)).toHaveCount(0);
    expect(blockCalls).toHaveLength(0);
  });
});

// ── helpers ─────────────────────────────────────────────────────────────────

/** The follow-up confirm's heading (`report.block.title`). */
function blockPrompt(page: Page) {
  return page.getByRole("heading", { name: "Block this user?" });
}

/** Every POST the browser fires at the block endpoint, in order. */
function trackBlockCalls(page: Page): Request[] {
  const calls: Request[] = [];
  page.on("request", (req) => {
    if (req.method() === "POST" && /\/api\/me\/users\/\d+\/block$/.test(req.url()))
      calls.push(req);
  });
  return calls;
}

/**
 * Wait until the listing page's seller CTA is SETTLED — visible and no longer
 * `aria-busy` — i.e. the session probe has answered. See the note at the first
 * call site for why the element's type is no longer a usable auth tell.
 */
async function expectSettledCta(page: Page) {
  const cta = page.getByRole("button", { name: CTA_LABEL });
  await expect(cta).toBeVisible({ timeout: 15_000 });
  await expect(cta).not.toHaveAttribute("aria-busy", "true");
}

/** A seller's public profile, once the session has hydrated (avatar in header). */
async function gotoSellerAuthed(page: Page, sellerId = 2) {
  await page.goto(`/en/sellers/${sellerId}`);
  // The header avatar is labelled with the signed-in user's name, so it only
  // appears once auth has resolved — the Report trigger sends guests to /login.
  await expect(
    page.getByRole("button", { name: "Ahmad Karimi" }),
  ).toBeVisible({ timeout: 15_000 });
}

/** Open the report dialog, pick a reason and submit — without judging the outcome. */
async function fillAndSubmitReport(page: Page) {
  const trigger = page.getByRole("button", { name: "Report", exact: true });
  await expect(async () => {
    await trigger.click();
    await expect(page.getByText("Why are you reporting this?")).toBeVisible({
      timeout: 2000,
    });
  }).toPass({ timeout: 15_000 });
  await page.getByRole("button", { name: "Fraud or scam" }).click();
  await page.getByRole("button", { name: "Submit Report" }).click();
}

/** File a report and wait for it to be accepted. */
async function submitReport(page: Page) {
  await fillAndSubmitReport(page);
  await expect(page.getByText("Report submitted. Thank you.")).toBeVisible();
}
