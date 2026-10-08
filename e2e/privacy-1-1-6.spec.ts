import { test, expect } from "@playwright/test";

/**
 * The 1.1.6 privacy policy (DRAFT until the owner approves): the three new
 * sections render in Pashto, right-to-left, with the brand spelled هټیوال and
 * the facts that match what 1.1.6 ships (e-Tazkira only, a shop's proof of
 * business, photos deleted after 90 days, the number kept encrypted, buyers see
 * the shop and never the owner's personal details; the shop team: members
 * answer the shop's chats, never see each other's personal chats, only the
 * owner changes roles / transfers / closes; a shop chat includes the team).
 */
test("the 1.1.6 sections render in ps (هټیوال)", async ({ page }) => {
  await page.goto("/ps/privacy");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByText("وروستی تازه: د ۲۰۲۶ اکتوبر")).toBeVisible();
  for (const title of ["تایید کېدل (اختیاري)", "ستاسو ځای", "دوکانونه"]) {
    await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
  }
  const body = page.locator("main, body").first();
  await expect(body).toContainText("هټیوال");
  await expect(body).toContainText("برېښنايي تذکره");
  await expect(body).toContainText("۹۰");
  await expect(body).toContainText("د دوکان په چټونو کې پیرودونکي د دوکان نوم او لوګو ویني");
  // The team (SHOP-3, in 1.1.6): members, personal chats, owner-only actions.
  await expect(body).toContainText("دوکان کولای شي ټیم ولري");
  await expect(body).toContainText("غړي هېڅکله د یو بل شخصي چټونه نه ویني");
  await expect(body).toContainText("یوازې مالک رولونه بدلولی");
  // A shop chat is not "two people" any more.
  await expect(body).toContainText("د دوکان ټول ټیم د دوکان په توګه حسابېږي");
  // ID photos: Hatiwal's own reviewers, never a shop's team.
  await expect(body).toContainText("هېڅکله د کوم دوکان ټیم نه");
});

test("the team and shop-chat facts read in en", async ({ page }) => {
  await page.goto("/en/privacy");
  const body = page.locator("main, body").first();
  await expect(body).toContainText("A shop can have a team.");
  await expect(body).toContainText("Members never see each other's personal chats");
  await expect(body).toContainText("In a chat with a shop, the shop's whole team counts as the shop");
  await expect(body).toContainText("Only Hatiwal's own reviewers can see your photos and number (never a shop's team)");
  await expect(body).not.toContainText("private between the two people in a conversation");
});

// Edge pass 1.1.6 (d0, 2026-10-08): the text follows what the code does now —
// a closed shop's chats continue under the owner's own name; an account
// deletion removes the shop page only when it is final; a member's products
// stay with the shop when they delete their account; Support messages push.
test("closing a shop, deleting an account, and Support pushes read as built (en)", async ({ page }) => {
  await page.goto("/en/privacy");
  const body = page.locator("main, body").first();
  await expect(body).toContainText("chats about its products continue with you personally, under your own name");
  await expect(body).toContainText("its page is removed when the deletion becomes final, after 30 days");
  await expect(body).toContainText("when they leave, are removed or delete their account");
  await expect(body).toContainText("and messages from Hatiwal Support");
});
