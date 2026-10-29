import { readFileSync } from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE, EMPTY_STATE } from "./auth-paths";

/**
 * Search by image (hatiwal-api docs/IMAGE_SEARCH.md, design in hatiwal-mobile
 * docs/design/IMAGE_SEARCH.md): 📷 in the search field → one photo → similar
 * listings. The mock API picks its answer from the photo's FILENAME
 * (e2e/mock-api/server.mjs): *nomatch*, *ratelimit*, *notaphoto*, else results.
 */
const MOCK_API = `http://localhost:${process.env.E2E_MOCK_API_PORT || 4010}/api/v1`;
const PHOTO = readFileSync(path.join(__dirname, "fixtures", "photo-a.png"));

function photo(name: string) {
  return { name, mimeType: "image/png", buffer: PHOTO };
}

async function pickPhoto(page: Page, name: string) {
  // The gallery input behind the VISIBLE 📷 (desktop: the icon opens it directly).
  // Two header copies exist (bar / phone row); only one is shown per width.
  await page.locator('[data-testid="image-search-gallery-input"]').first().setInputFiles(photo(name));
  await expect(page).toHaveURL(/\/image-search\?p=\w+/);
}

function visibleButton(page: Page) {
  return page.locator('[data-testid="image-search-button"]:visible').first();
}

async function searchesSoFar(page: Page): Promise<{ filename: string; persona: string | null }[]> {
  const res = await page.request.get(`${MOCK_API}/__image_searches`);
  return (await res.json()).searches;
}

test.describe("Search by image (web: signed in)", () => {
  test.use({ storageState: BUYER_STATE });

  test("📷 in the search field → one photo → similar listings, with the photo on top", async ({ page }) => {
    await page.goto("/en");
    await expect(visibleButton(page)).toHaveAccessibleName("Search with a photo");

    await pickPhoto(page, "jacket.png");

    await expect(page.getByRole("heading", { name: "Similar items" })).toBeVisible();
    await expect(page.getByTestId("image-search-preview")).toHaveAttribute("alt", "Your photo");
    await expect(page.getByTestId("image-search-status")).toHaveText("6 items");
    await expect(page.getByTestId("image-search-view").getByText("iPhone 13 Pro")).toBeVisible();
    // Through the authed proxy, as the buyer: Rails can leave out what they hid.
    expect((await searchesSoFar(page)).find((s) => s.filename === "jacket.png")?.persona).toBe("full");
  });

  test("Back from a listing returns to the same results without sending the photo again", async ({ page }) => {
    await page.goto("/en");
    await pickPhoto(page, "back-nav.png");
    const results = page.getByTestId("image-search-view");
    await expect(results.getByText("iPhone 13 Pro")).toBeVisible();
    const sent = () => searchesSoFar(page).then((all) => all.filter((s) => s.filename === "back-nav.png").length);
    const before = await sent();

    await results.getByText("iPhone 13 Pro").click();
    // Generous: the first visit to a listing compiles the route in dev mode.
    await expect(page).toHaveURL(/\/en\/listings\//, { timeout: 60_000 });
    await page.goBack();

    await expect(page.getByTestId("image-search-view").getByText("iPhone 13 Pro")).toBeVisible();
    expect(await sent()).toBe(before);
  });

  test("no match: says what to try, and offers text search instead", async ({ page }) => {
    await page.goto("/en/bazaar");
    await pickPhoto(page, "nomatch.png");

    await expect(page.getByText("No similar items found")).toBeVisible();
    await expect(page.getByText("Try a photo where the item is clear and fills the frame.")).toBeVisible();
    await expect(page.getByTestId("image-search-status")).toHaveText("0 items");
    await page.getByRole("link", { name: "Search by text" }).click();
    await expect(page).toHaveURL(/\/en\/bazaar/);
  });

  test("a file that is not a photo, and too many searches, each get their own message", async ({ page }) => {
    await page.goto("/en");
    await pickPhoto(page, "notaphoto.png");
    await expect(page.getByText("This file isn't a photo we can read. Try another photo.")).toBeVisible();

    await page.locator('[data-testid="image-search-gallery-input"]').first().setInputFiles(photo("ratelimit.png"));
    await expect(page.getByText("Too many photo searches. Please wait a few minutes and try again.")).toBeVisible();
    await expect(page.getByTestId("image-search-try-another").first()).toBeVisible();
  });

  test("no connection: says that search with a photo needs the internet", async ({ page }) => {
    await page.route("**/api/me/listings/image_search*", (route) => route.abort("internetdisconnected"));
    await page.goto("/en");
    await pickPhoto(page, "offline.png");
    await expect(page.getByText("Search with a photo needs the internet. Check your connection and try again.")).toBeVisible();
  });

  test("opening the page with no photo (a reload) asks for one instead of failing", async ({ page }) => {
    await page.goto("/en/image-search?p=gone");
    await expect(page.getByText("Take or choose one photo of an item to find listings that look like it.")).toBeVisible();
    await expect(page.getByTestId("image-search-try-another")).toBeVisible();
  });

  test("no 📷 when the API says it cannot search by image", async ({ page }) => {
    await page.route("**/api/proxy/app_config*", (route) =>
      route.fulfill({ json: { status: "ok", features: { image_search: false } } }),
    );
    await page.goto("/en/bazaar");
    await expect(page.getByRole("search").first()).toBeVisible();
    await expect(page.locator('[data-testid="image-search-button"]')).toHaveCount(0);
  });

  test("keyboard: Tab from the search field reaches 📷, and Enter and Space open the file chooser", async ({ page }) => {
    await page.goto("/en/saved");
    const button = visibleButton(page);
    await expect(button).toBeVisible();
    await page.locator('header input[name="q"]').first().focus();
    await page.keyboard.press("Tab");
    await expect(button).toBeFocused();
    for (const key of ["Enter", "Space"]) {
      const chooser = page.waitForEvent("filechooser", { timeout: 5000 });
      await page.keyboard.press(key);
      expect(await chooser, key).toBeTruthy();
      await button.focus();
    }
  });

  test("Pashto: right-to-left, translated", async ({ page }) => {
    await page.goto("/ps");
    await pickPhoto(page, "ps.png");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "ورته توکي" })).toBeVisible();
  });
});

test.describe("Search by image as a guest (web)", () => {
  test("📷 is the usual sign-in prompt, and signing in lands on the photo search", async ({ page }) => {
    await page.goto("/en");
    await visibleButton(page).click();
    await expect(page).toHaveURL(/\/en\/login\?next=%2Fimage-search/);
    // A returning buyer: no welcome modal over the page (as auth.setup.ts does).
    await page.evaluate(() => window.localStorage.setItem("hatiwal.onboarded", "1"));

    await page.getByLabel(/Email/i).fill("buyer@hatiwal.test");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: /Sign In/i }).click();
    await expect(page).toHaveURL(/\/en\/image-search/, { timeout: 60_000 });
    await expect(page.getByText("Take or choose one photo of an item to find listings that look like it.")).toBeVisible();
  });
});

test.describe("Search by image on a phone", () => {
  // A phone shows the search row in BUYER mode (seller mode shows the selling
  // shortcuts there instead, mode-nav.tsx); the empty persona is a buyer.
  test.use({ storageState: EMPTY_STATE, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("📷 offers both sources: take a photo, or choose from the gallery", async ({ page }) => {
    await page.goto("/en");
    await visibleButton(page).tap();
    await expect(page.getByRole("menuitem", { name: "Take a photo" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Choose from gallery" })).toBeVisible();
    // "Take a photo" asks the browser for the rear camera.
    await expect(page.locator('[data-testid="image-search-camera-input"]').first()).toHaveAttribute("capture", "environment");
  });
});
