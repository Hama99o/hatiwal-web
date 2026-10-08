import path from "node:path";
import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

/**
 * UPLOAD SWEEP — the web half of the upload problem.
 *
 * Why this file exists: `grep -rn setInputFiles e2e/` returned NOTHING across 41
 * specs, so all three of this app's upload paths were completely untested —
 * the avatar, a listing's photos, and a chat attachment. Upload is the kind of
 * feature that fails silently (the picker opens, nothing appears, no error), and
 * silence is exactly what no assertion catches.
 *
 * All three inputs are `className="hidden"` and driven by a label or a ref, which
 * is why they are addressed as `input[type="file"]` rather than by clicking: an
 * `input` that is `display:none` cannot be clicked, but Playwright's
 * `setInputFiles` sets it directly and fires the same change event the app
 * listens for. That is the real code path, not a simulation of it.
 *
 * The fixtures are REAL 640x480 PNGs (e2e/fixtures), not 1x1 placeholders. A
 * photo path may legitimately reject a degenerate image, and a test that fails
 * on its own fixture rather than on the feature is worse than no test.
 */

const PHOTO_A = path.join(__dirname, "fixtures", "photo-a.png");
const PHOTO_B = path.join(__dirname, "fixtures", "photo-b.png");

test.describe("avatar upload", () => {
  test.use({ storageState: BUYER_STATE });

  // Owner, 2026-10-08: a picked photo is only a preview; Save (in the top bar)
  // uploads it, BEFORE the fields. Nothing is sent at pick time.
  test("picking an image previews it; Save uploads it, then the fields", async ({ page }) => {
    await page.goto("/en/profile/edit");
    await page.waitForLoadState("networkidle");

    const puts: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "PUT" && /\/api\/me\/users\/me$/.test(r.url())) {
        puts.push((r.headers()["content-type"] ?? "").includes("multipart") ? "avatar" : "fields");
      }
    });

    const input = page.locator('input[type="file"]').first();
    await expect(input, "the profile form has no file input at all").toHaveCount(1);
    await input.setInputFiles(PHOTO_A);

    await expect(page.locator('img[src^="blob:"]').first(), "no local preview of the picked photo").toBeVisible();
    await page.waitForTimeout(500);
    expect(puts, "the photo was uploaded at pick time; it must wait for Save").toEqual([]);

    await page.getByTestId("edit-profile-save").click();
    await expect(page).toHaveURL(/\/en\/profile$/, { timeout: 30_000 });
    expect(puts).toEqual(["avatar", "fields"]);
  });
});

test.describe("listing photos", () => {
  // One account is both buyer and seller in this product, and
  // my-listings.spec.ts authenticates the same way.
  test.use({ storageState: BUYER_STATE });

  test("MULTIPLE photos can be attached in one pick", async ({ page }) => {
    // The route create-listing.spec.ts already exercises, rather than hunting a
    // link by name — a guessed selector failing here would read as an upload bug.
    await page.goto("/en/listings/new");
    await expect(page.getByRole("heading", { name: "Create Listing" })).toBeVisible();

    const input = page.locator('input[type="file"]').first();
    if ((await input.count()) === 0) test.skip();

    // `multiple` is set on this input (listing-form.tsx), so BOTH files in one
    // call is the real path a seller uses — and the case most likely to be
    // broken, because handling one file is easy and handling a FileList is where
    // implementations forget to iterate.
    await input.setInputFiles([PHOTO_A, PHOTO_B]);

    const previews = page.locator('img[src^="blob:"], img[src^="data:"]');
    await expect(
      previews,
      "picked 2 photos in one go and got a different number of previews — " +
        "the change handler is probably taking files[0] instead of iterating",
    ).toHaveCount(2, { timeout: 15_000 });
  });
});

test.describe("chat attachment", () => {
  test.use({ storageState: BUYER_STATE });

  test("an attachment can be added to a conversation", async ({ page }) => {
    await page.goto("/en/conversations/1");
    await page.waitForLoadState("networkidle");

    // ASSERT the precondition instead of skipping on it. This app renders the
    // composer — and the file input inside it — only when the conversation is
    // neither closed nor blocked (`{closed || blocked ? notice : form}`), so a
    // leftover block from another spec makes the input vanish. Skipping there
    // hides the reason; failing names it.
    await expect(
      page.getByPlaceholder("Type a message..."),
      "this conversation has no composer — it is closed or blocked, so the " +
        "attachment path cannot be reached",
    ).toBeVisible();

    const input = page.locator('input[type="file"]').first();
    await expect(input, "the composer has no file input").toHaveCount(1);

    // THE ACK IS A NEW MESSAGE, not a preview or a chip — my first version
    // looked for both and failed on a working feature. The handler is
    // `if (f) sendAttachment(f)`: the file is SENT immediately, so it arrives in
    // the thread rather than sitting in the composer.
    //
    // Counted before and after, because "a message exists" is true before the
    // attachment too — only the INCREASE proves this upload did anything.
    // `p`, because that is how this app's messages are addressable: MessageBubble
    // renders plain divs with no data attribute and no li/article, and
    // conversation-thread.spec.ts already targets message text with
    // `locator("p", { hasText: ... })`. My first two locators
    // (`[data-message-id], li, article`) matched ZERO elements, so the count
    // never moved and the failure said "the thread still has 0 items" — a
    // selector problem wearing the costume of a dropped upload.
    const bubbles = page.locator("p").filter({ hasText: /./ });
    const before = await bubbles.count();
    expect(
      before,
      "the thread has no message paragraphs at all — the conversation did not " +
        "render, so an attachment cannot be observed arriving in it",
    ).toBeGreaterThan(0);

    await input.setInputFiles(PHOTO_A);

    await expect(
      async () => expect(await bubbles.count()).toBeGreaterThan(before),
      `the thread still has ${before} items after attaching a file — ` +
        `sendAttachment dropped it or the request failed`,
    ).toPass({ timeout: 20_000 });
  });
});
