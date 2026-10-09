import { test, expect } from "@playwright/test";

/**
 * The 1.1.6 privacy policy (approved by the owner, 2026-10-09): the three new
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
  await expect(body).toContainText("What your team wrote as the shop stays under the shop's name; new messages in its chats come from you personally, under your own name.");
  await expect(body).not.toContainText("chats about its products continue with you personally");
  await expect(body).toContainText("its page is removed when the deletion becomes final, after 30 days");
  await expect(body).toContainText("when they leave, are removed or delete their account");
  await expect(body).toContainText("and messages from Hatiwal Support");
});

// Owner, 2026-10-09: the approved 1.1.6 wording, and option B for translations.
test("the approved shop sentence and the photo copies sentence (en), with no translation note", async ({ page }) => {
  await page.goto("/en/privacy");
  const body = page.locator("main, body").first();
  await expect(body).toContainText("In chats with your shop, buyers see the shop's name and logo, not your personal details.");
  await expect(body).not.toContainText("never your personal name, photo or city");
  await expect(body).toContainText("We keep smaller copies of your photos so the app loads quickly.");
  await expect(page.getByTestId("privacy-translation-note")).toHaveCount(0);
});

// ur carries the same translated note, but Urdu is hidden on the site (owner,
// 2026-10-05; HIDDEN_LOCALES): /ur/privacy redirects to the English page.
for (const [locale, note] of [
  ["ps", "دا یوه ژباړه ده."],
  ["fa", "این یک ترجمه است."],
] as const) {
  test(`${locale}: says it is a translation and links to the English text`, async ({ page }) => {
    await page.goto(`/${locale}/privacy`);
    const n = page.getByTestId("privacy-translation-note");
    await expect(n).toContainText(note);
    await expect(n.locator("a")).toHaveAttribute("href", "/en/privacy");
  });
}

test("ur is hidden on the site: /ur/privacy shows the English page, with no note", async ({ page }) => {
  await page.goto("/ur/privacy");
  await expect(page).toHaveURL(/\/en\/privacy$/);
  await expect(page.getByTestId("privacy-translation-note")).toHaveCount(0);
});
