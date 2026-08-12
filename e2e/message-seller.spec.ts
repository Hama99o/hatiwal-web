import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import en from "../messages/en.json";

/**
 * The CTA that opens the composer, READ FROM THE CATALOG rather than retyped
 * (`listing.detail.contactSeller` — see listing-action-bar.spec.ts), so a copy
 * change cannot leave this suite clicking a name the button no longer has.
 */
const CTA_LABEL = en.listing.detail.contactSeller;

// Listing 2 (Samsung) is owned by seller 2 — the buyer persona (seller 1) can
// message/offer on it. (StartConversationButton hides itself on your own listing.)
test.describe("Message seller", () => {
  test.use({ storageState: BUYER_STATE });

  test("Contact Seller composes and opens the conversation", async ({
    page,
  }) => {
    await page.goto("/en/listings/2");
    const msgBtn = page.getByRole("button", { name: CTA_LABEL });
    await expect(msgBtn).toBeVisible();
    await expect(async () => {
      await msgBtn.click();
      await expect(
        page.getByPlaceholder("Ask about this item..."),
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15_000 });

    await page
      .getByPlaceholder("Ask about this item...")
      .fill("Is the price negotiable?");
    await page.getByRole("button", { name: "Send Message" }).click();
    await expect(page).toHaveURL(/\/conversations\/1/, { timeout: 20_000 });
  });

  test("Make an Offer sends an offer and opens the thread", async ({
    page,
  }) => {
    await page.goto("/en/listings/2");
    const offerBtn = page.getByRole("button", { name: "Make an Offer" });
    await expect(offerBtn).toBeVisible();
    await expect(async () => {
      await offerBtn.click();
      await expect(page.getByText("Your offer")).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15_000 });

    await page.locator('input[type="number"]').fill("25000");
    await page.getByRole("button", { name: "Send Offer" }).click();
    await expect(page).toHaveURL(/\/conversations\/1/, { timeout: 20_000 });
  });
});
