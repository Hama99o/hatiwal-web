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
    await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  });

  test("sending a message appends it to the thread", async ({ page }) => {
    await page.goto("/en/conversations/1");
    const composer = page.getByPlaceholder("Type a message...");
    await composer.fill("Can we meet tomorrow?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Can we meet tomorrow?")).toBeVisible();
  });

  test("a closed conversation disables replies", async ({ page }) => {
    await page.goto("/en/conversations/2");
    await expect(
      page.getByText("Conversation closed — replies disabled."),
    ).toBeVisible();
  });

  test("an unknown conversation shows the load error", async ({ page }) => {
    await page.goto("/en/conversations/99999");
    await expect(page.getByText("Could not load messages.")).toBeVisible();
  });
});
