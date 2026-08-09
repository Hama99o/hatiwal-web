import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

const OUT = "/tmp/claude-1001/-home-hama99o-Apps-Personal-Hatiwal/bcc9d353-d2c2-459d-bf5f-7b821118074e/scratchpad";

test.describe("TEMP rtl/dark check", () => {
  test.use({ storageState: BUYER_STATE });

  for (const [locale, subtitle, fraud, submit, promptTitle] of [
    ["ps", "ولې یې راپور ورکوئ؟", "درغلي یا کلک", "راپور وسپارئ", "دا کارونکی بلاک کړئ؟"],
    ["fa", "چرا گزارش می‌دهید؟", "کلاهبرداری یا جعل", "ارسال گزارش", "این کاربر را مسدود کنید؟"],
  ] as const) {
    test(`${locale} block prompt`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: locale === "fa" ? "dark" : "light" });
      await page.goto(`/${locale}/sellers/2`);
      await expect(
        page.getByRole("button", { name: "Ahmad Karimi" }),
      ).toBeVisible({ timeout: 15_000 });
      const trigger = page.locator("button", { hasText: /^/ }).first();
      void trigger;
      await expect(async () => {
        await page.locator('button:has(svg.lucide-flag)').first().click();
        await expect(page.getByText(subtitle)).toBeVisible({ timeout: 2000 });
      }).toPass({ timeout: 15_000 });
      await page.getByRole("button", { name: fraud }).click();
      await page.getByRole("button", { name: submit }).click();
      await expect(
        page.getByRole("heading", { name: promptTitle }),
      ).toBeVisible();
      await page
        .getByRole("dialog")
        .screenshot({ path: `${OUT}/r612-${locale}.png` });
      // Report doc order in the DOM: cancel then confirm; RTL mirrors visually.
      const box = await page.getByRole("dialog").boundingBox();
      const cancel = await page.getByRole("dialog").getByRole("button").first().boundingBox();
      const confirm = await page.getByRole("dialog").getByRole("button").last().boundingBox();
      console.log(locale, "dialog", box, "first-btn-x", cancel?.x, "last-btn-x", confirm?.x);
      expect(await page.locator("html").getAttribute("dir")).toBe("rtl");
    });
  }
});
