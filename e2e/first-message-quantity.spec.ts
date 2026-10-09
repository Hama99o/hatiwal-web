import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import en from "../messages/en.json";
import ps from "../messages/ps.json";

/*
 * First-message quantity prefill (1.1.7, mobile parity — mobile 2b7b6917): on a
 * MULTI-UNIT listing, "Contact Seller" offers how many, and the message FOLLOWS
 * the quantity ("Hi! I'd like to buy 3 × AFN 400 = AFN 1,200. …") until the
 * buyer types; their own words are never overwritten; closing forgets both.
 * Quantity 1 keeps today's empty box (placeholder). A single-item listing shows
 * no quantity at all.
 *
 * Mock: listing 9301 "Silicone Phone Cases (box)" — 8 units at 400 AFN, seller 2
 * (detail-only fixture; the signed-in persona owns every other multi-unit one).
 */
test.use({ storageState: BUYER_STATE });

async function openDialog(page: Page, locale: "en" | "ps", m: typeof en) {
  await page.goto(`/${locale}/listings/9301`);
  await page.getByRole("button", { name: m.listing.detail.contactSeller }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

test("the message follows the quantity until the buyer types; closing forgets it", async ({ page }) => {
  const dialog = await openDialog(page, "en", en);
  const box = dialog.getByPlaceholder(en.chat.startConversation.placeholder);
  const more = dialog.getByRole("button", { name: en.common.increaseQuantity });

  // Quantity 1: today's empty box.
  await expect(box).toHaveValue("");

  await more.click();
  await more.click();
  await expect(box).toHaveValue(/I'd like to buy\s*⁨?3⁩?\s*×\s*⁨?.*400.*⁩?\s*=\s*⁨?.*1,200/);

  // The buyer's own words win from now on.
  await box.fill("Salaam, can you deliver to Herat?");
  await more.click();
  await expect(box).toHaveValue("Salaam, can you deliver to Herat?");

  // Closing forgets the edit AND the quantity.
  await dialog.getByRole("button", { name: en.common.cancel }).click();
  await expect(dialog).toBeHidden();
  const again = await openDialog(page, "en", en);
  await expect(again.getByPlaceholder(en.chat.startConversation.placeholder)).toHaveValue("");
});

test("ps: the template in Pashto with Pashto digits and ؋", async ({ page }) => {
  const dialog = await openDialog(page, "ps", ps as unknown as typeof en);
  const more = dialog.getByRole("button", { name: ps.common.increaseQuantity });
  await more.click();
  const value = await dialog.getByRole("textbox").inputValue();
  expect(value).toContain("زه غواړم");
  expect(value).toMatch(/[۲]/); // qty 2 in Eastern Arabic digits
  expect(value).toMatch(/[۸]۰۰/); // total 800
  expect(value).not.toMatch(/[0-9]/); // no Latin digits left in the numbers
});

test("a single-item listing offers no quantity in the message dialog", async ({ page }) => {
  await page.goto("/en/listings/2");
  await page.getByRole("button", { name: en.listing.detail.contactSeller }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: en.common.increaseQuantity })).toHaveCount(0);
});
