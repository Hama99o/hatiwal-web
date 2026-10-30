import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

/*
 * IDEA-8 (1.2.1, hatiwal-mobile docs/design/SHARE_AND_QR.md §3.1–3.2, §3.6):
 *
 *   - a share link carries the SHARER's language: /l/<id>?lang=ps lands on
 *     /ps/listings/<id> (so WhatsApp builds the preview in Pashto), /s/<id>?lang=fa
 *     on /fa/shops/<id>; anything but en|ps|fa is ignored — never an open redirect;
 *   - the WhatsApp card: og:title = title · price, og:description = city · category
 *     · Hatiwal ("Sold" first when sold), og:image = the 1200 × 630 share variant
 *     with its size, og:url = the short link;
 *   - a visit from a share (?src=wa|share|qr) is forwarded to the API, which logs
 *     it; an unknown src is not.
 */
const MOCK_API = `http://localhost:${process.env.E2E_MOCK_API_PORT || 4010}/api/v1`;
// Mock listing 5: "MacBook Pro M2", 90,000 AFN, Kabul, 3 photos (so it has a share image).
const LISTING = 5;

test.describe("Share links carry the sharer's language", () => {
  test("/l/<id>?lang=ps&src=wa opens the listing in Pashto, the source kept", async ({ page }) => {
    await page.goto(`/l/${LISTING}?lang=ps&src=wa`);
    await expect(page).toHaveURL(new RegExp(`/ps/listings/${LISTING}\\?.*src=wa`));
  });

  test("/s/<id>?lang=fa&src=qr opens the shop in Dari", async ({ page }) => {
    await page.goto(`/s/42?lang=fa&src=qr`);
    await expect(page).toHaveURL(/\/fa\/shops\/42\?.*src=qr/);
  });

  for (const bad of ["ur", "evil", "ps.evil.example", "//evil.example", "https://evil.example"]) {
    test(`an unknown lang (${bad}) is ignored: the reader's own locale, same site`, async ({ page, baseURL }) => {
      await page.goto(`/l/${LISTING}?lang=${encodeURIComponent(bad)}`);
      const url = new URL(page.url());
      expect(url.origin).toBe(new URL(baseURL!).origin);
      expect(url.pathname).toBe(`/en/listings/${LISTING}`);
    });
  }
});

test.describe("The WhatsApp card (Open Graph)", () => {
  test("title · price, city · category · Hatiwal, the 1200 × 630 share image, the short link", async ({ page }) => {
    await page.goto(`/en/listings/${LISTING}`);
    const og = (p: string) => page.locator(`meta[property="og:${p}"]`);
    await expect(og("title")).toHaveAttribute("content", /^MacBook Pro M2 · .*90,000/);
    await expect(og("description")).toHaveAttribute("content", /^Kabul · .+ · Hatiwal$/);
    await expect(og("image")).toHaveAttribute("content", /-share-0-1200x630\.jpg$/);
    await expect(og("image:width")).toHaveAttribute("content", "1200");
    await expect(og("image:height")).toHaveAttribute("content", "630");
    await expect(og("url")).toHaveAttribute("content", `https://hatiwal.com/l/${LISTING}`);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  });

  test("in Pashto when the link says so: the price in the page's own digits", async ({ page }) => {
    await page.goto(`/l/${LISTING}?lang=ps&src=wa`);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /^MacBook Pro M2 · .*[۰-۹]/);
  });

  test("a sold listing says so first", async ({ page }) => {
    await page.goto(`/en/listings/7`);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", /^Sold · Herat · /);
  });
});

test.describe("Visits from a share are counted by the API", () => {
  test("?src=wa&lang=ps reaches the API with the listing fetch; an unknown src does not", async ({ page }) => {
    await page.goto(`/en/listings/${LISTING}?src=wa&lang=ps`);
    await page.goto(`/en/shops/42?src=qr`);
    await page.goto(`/en/listings/${LISTING}?src=evil`);
    const { visits } = (await (await page.request.get(`${MOCK_API}/__share_visits`)).json()) as {
      visits: { kind: string; id: number; src: string; lang: string | null }[];
    };
    expect(visits).toContainEqual({ kind: "listing", id: LISTING, src: "wa", lang: "ps" });
    expect(visits).toContainEqual({ kind: "shop", id: 42, src: "qr", lang: null });
    expect(visits.map((v) => v.src)).not.toContain("evil");
  });
});

test.describe("Sharing from the web", () => {
  test("the listing's Share sends the short app link in the page's language", async ({ page }) => {
    await page.goto(`/ps/listings/${LISTING}`);
    await expect(page.getByTestId("listing-share-button")).toHaveAttribute(
      "data-share-url",
      `https://hatiwal.com/l/${LISTING}?lang=ps&src=share`,
    );
  });

  test("a buyer sees no QR card button on someone else's shop", async ({ page }) => {
    await page.goto(`/en/shops/42`);
    await expect(page.getByTestId("shop-share-button")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("shop-qr-button")).toHaveCount(0);
  });
});

test.describe("The QR card (the seller's own live listing)", () => {
  test.use({ storageState: BUYER_STATE });

  test("opens the server-made card in the page's language; another language and the A6 PDF are one tap away", async ({ page }) => {
    await page.goto(`/fa/listings/1`);
    await page.getByTestId("listing-qr-button").click();
    const image = page.getByTestId("qr-card-image");
    await expect(image).toHaveAttribute("src", /\/api\/v1\/listings\/1\/qr_card\.png\?lang=fa$/);
    // The card loads (the placeholder goes away), never a collapsed box.
    await expect(page.getByTestId("qr-card-loading")).toHaveCount(0);
    await page.getByRole("radio", { name: "پښتو" }).click();
    await expect(image).toHaveAttribute("src", /\/api\/v1\/listings\/1\/qr_card\.png\?lang=ps$/);
    await expect(page.getByTestId("qr-card-pdf")).toHaveAttribute("href", /\/api\/v1\/listings\/1\/qr_card\.pdf\?lang=ps$/);
    await expect(page.getByTestId("qr-card-png")).toHaveAttribute("href", /\/api\/v1\/listings\/1\/qr_card\.png\?lang=ps&download=1$/);
  });
});
