import { test, expect } from "@playwright/test";
import { hasArabicScript, textDir } from "../src/lib/text-direction";

/**
 * User text direction from CONTENT, not the first character (owner,
 * production, iPhone, ps). The title below starts with Latin, so dir="auto"
 * laid it out LTR inside the RTL page and the Pashto runs came out in the
 * wrong order. Any Arabic-script letter → RTL; otherwise LTR.
 */
const MIXED = "YIRONGTANG Fruit Vinegar Black Oil Elegant | د عمده او پرچون | 2 × 250ml سپينو ويښتانو د تورولو لپاره";

test.describe("textDir (pure)", () => {
  test("the owner's title is RTL although it starts with Latin", () => {
    expect(hasArabicScript(MIXED)).toBe(true);
    expect(textDir(MIXED)).toBe("rtl");
  });
  test("English and numbers alone are LTR; Pashto / Dari alone RTL; empty LTR", () => {
    expect(textDir("iPhone 12 Pro")).toBe("ltr");
    expect(textDir("250ml")).toBe("ltr");
    expect(textDir("د عمده او پرچون")).toBe("rtl");
    expect(textDir("کوت زمستانی")).toBe("rtl");
    expect(textDir("")).toBe("ltr");
    expect(textDir(null)).toBe("ltr");
    // Presentation forms (FB50–FDFF, FE70–FEFF) count too.
    expect(textDir("ﻻ")).toBe("rtl");
  });
});

const CASES = [
  { id: 9201, name: "mixed", dir: "rtl" },
  { id: 9202, name: "english", dir: "ltr" },
  { id: 9203, name: "pashto", dir: "rtl" },
] as const;

for (const locale of ["ps", "fa", "en"] as const) {
  test.describe(`listing title on /${locale}`, () => {
    for (const c of CASES) {
      test(`${c.name} title → dir="${c.dir}"`, async ({ page }, info) => {
        await page.goto(`/${locale}/listings/${c.id}`);
        const title = page.getByTestId("listing-title");
        await expect(title).toBeVisible();
        await expect(title).toHaveAttribute("dir", c.dir);
        // The description follows its own content too.
        await expect(page.getByTestId("listing-description")).toHaveAttribute("dir", c.dir);
        await page.screenshot({ path: info.outputPath(`bidi-title-${locale}-${c.name}.png`), fullPage: true });
      });
    }
  });
}

test("inside an RTL title the Latin run and the numbers stay intact (dir only, no character changes)", async ({ page }) => {
  await page.goto("/ps/listings/9201");
  const title = page.getByTestId("listing-title");
  await expect(title).toHaveText(MIXED);
  await expect(title).toContainText("YIRONGTANG Fruit Vinegar Black Oil Elegant");
  await expect(title).toContainText("2 × 250ml");
});
