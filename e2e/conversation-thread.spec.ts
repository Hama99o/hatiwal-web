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
  test("the seller can mark the pinned listing reserved from the thread", async ({
    page,
  }) => {
    await page.goto("/en/conversations/1");
    await page.getByRole("button", { name: "Mark as Reserved" }).click();
    const picker = page.getByRole("dialog");
    await expect(picker.getByText("Who's buying this item?")).toBeVisible();
    // Named, so a seller with several threads open knows what they're reserving.
    await expect(picker.getByText("iPhone 13 Pro")).toBeVisible();
    await picker.getByRole("button", { name: /Sara Ahmadi/ }).click();
    await picker.getByRole("button", { name: "Confirm reserve" }).click();
    await expect(page.getByText("Listing marked as reserved")).toBeVisible();
  });

  test("an unknown conversation shows the load error", async ({ page }) => {
    await page.goto("/en/conversations/99999");
    await expect(page.getByText("Could not load messages.")).toBeVisible();
  });
});
