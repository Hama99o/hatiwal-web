import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

test.describe("Conversation thread", () => {
  test.use({ storageState: BUYER_STATE });

  test("shows the message history and a composer", async ({ page }) => {
    await page.goto("/en/conversations/1");
    await expect(
      page.getByText("Hello, I'm interested in the iPhone."),
    ).toBeVisible();
    // "Is this still available?" is ALSO a quick-reply chip in the composer
    // (chat.quickReplies.stillAvailable), so target the message bubble's <p>
    // specifically to avoid a strict-mode violation (2 matches).
    await expect(
      page.locator("p", { hasText: "Is this still available?" }),
    ).toBeVisible();
    await expect(page.getByPlaceholder("Type a message...")).toBeVisible();
    // `exact` matters: the accessible-name match is a SUBSTRING by default, and
    // the composer's quick-reply chip "I can send more photos" contains "send"
    // — two matches is a strict-mode violation. The send button is aria-labelled.
    await expect(
      page.getByRole("button", { name: "Send", exact: true }),
    ).toBeVisible();
  });

  test("sending a message appends it to the thread", async ({ page }) => {
    await page.goto("/en/conversations/1");
    const composer = page.getByPlaceholder("Type a message...");
    await composer.fill("Can we meet tomorrow?");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText("Can we meet tomorrow?")).toBeVisible();
  });

  test("a closed conversation disables replies", async ({ page }) => {
    await page.goto("/en/conversations/2");
    await expect(
      page.getByText("Conversation closed — replies disabled."),
    ).toBeVisible();
  });

  // The seller can advance the listing from the thread itself (mobile's
  // ListingHeader parity). It runs on the SAME shared lifecycle brain as the
  // /my-listings cards and the owner detail screen — same buyer picker, same
  // copy, same toast — so this covers the third surface of that one hook.
  /**
   * REPLACES "the seller can mark the pinned listing reserved from the thread".
   *
   * The thread's own control used to be "Mark as Reserved" on an active listing,
   * becoming "Mark as Sold" only once it was reserved — the reserve-then-sold
   * ladder, inside chat. Chat is now the SHORTEST path to a sale (the buyer is
   * already there), so the thread leads with the sale and needs no picker at all.
   */
  test("the seller can sell the pinned listing from the thread, in one step", async ({
    page,
  }) => {
    await page.goto("/en/conversations/1");
    await page.getByRole("button", { name: "Mark Sold" }).click();
    const picker = page.getByRole("dialog");
    // CONFIRM mode: the buyer is the person in this thread, so there is no list.
    await expect(picker.getByText("Who bought this item?")).toBeVisible();
    // Named, so a seller with several threads open knows what they are selling.
    await expect(picker.getByText("iPhone 13 Pro")).toBeVisible();
    await expect(picker.getByText("Sara Ahmadi")).toBeVisible();
    await picker.getByRole("button", { name: "Confirm sold" }).click();
    await expect(page.getByText("Listing marked as sold")).toBeVisible();
  });

  test("an unknown conversation shows the load error", async ({ page }) => {
    await page.goto("/en/conversations/99999");
    await expect(page.getByText("Could not load messages.")).toBeVisible();
  });

  // Regression: blocking used to leave the composer fully enabled.
  //
  // `blocked` reached only the shield's colour and the confirm dialog's wording,
  // while the composer was gated on `closed` alone — so you could type into it
  // and press send, and the API (which refuses on either condition) just failed
  // the send. Mobile has disabled it and shown a banner all along, so this was a
  // cross-client divergence on one backend rule.
  //
  // SELF-CLEANING: it blocks and then unblocks, because this suite runs against
  // the real dev API, and a block left behind would strand every later
  // conversation test on the notice this test is asserting.
  test("blocking replaces the composer with a reason, and unblocking restores it", async ({
    page,
  }) => {
    await page.goto("/en/conversations/1");
    await expect(page.getByPlaceholder("Type a message...")).toBeVisible();

    // ── Block ───────────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "Block User", exact: true }).click();
    await expect(page.getByText("Block this user?")).toBeVisible();
    // The dialog's confirm shares its label with the shield's aria-label, so
    // scope to the dialog rather than matching two "Block User" controls.
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Block User", exact: true })
      .click();

    // The notice names the BLOCK, never "Conversation closed" — that copy is for
    // a genuinely closed conversation and would report the wrong cause.
    await expect(page.getByText("You can't message this user.")).toBeVisible();
    await expect(page.getByText("Conversation closed", { exact: false })).toHaveCount(0);
    await expect(page.getByPlaceholder("Type a message...")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Send", exact: true }),
    ).toHaveCount(0);

    // ── Unblock, and prove the composer comes back ──────────────────────────
    await page
      .getByRole("button", { name: "Unblock User", exact: true })
      .first()
      .click();
    // Unblocking confirms too on web (the dialog reuses the same title slot).
    const confirm = page
      .getByRole("dialog")
      .getByRole("button", { name: "Unblock User", exact: true });
    if (await confirm.count()) await confirm.click();

    await expect(page.getByPlaceholder("Type a message...")).toBeVisible();
    await expect(page.getByText("You can't message this user.")).toHaveCount(0);
  });
});
