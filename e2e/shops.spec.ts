import { test, expect } from "@playwright/test";
import { BUYER_STATE, EMPTY_STATE } from "./auth-paths";

/**
 * SHOP-1 on the web (hatiwal-mobile docs/SHOPS.md phase 1). Mock fixture: shop
 * 42 "Safi Cosmetics" with one product (listing 9042), which only the shop
 * filters return. Neither persona has a shop, which is the regression half:
 * users without a shop see exactly today's site. Sharing is covered by the QA
 * guard's e2e/shop-share.spec.ts.
 */
test.describe("Shop page (guest)", () => {
  test("shows the shop: name, Shop chip, Directions + Call, products, no chat button", async ({ page }) => {
    await page.goto("/en/shops/42");
    await expect(page.getByTestId("shop-page")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Safi Cosmetics" })).toBeVisible();
    await expect(page.getByTestId("shop-verified-badge")).toBeVisible();
    await expect(page.getByTestId("shop-directions")).toBeVisible();
    await expect(page.getByTestId("shop-call")).toHaveAttribute("href", "tel:+93 700 111 222");
    await expect(page.getByTestId("shop-message")).toHaveCount(0);
    await expect(page.getByText("Chanel No. 5 (100 ml)")).toBeVisible();
  });

  test("About lists the address and the week's hours, Friday closed", async ({ page }) => {
    await page.goto("/en/shops/42");
    await page.getByTestId("shop-tab-about").click();
    await expect(page.getByText("Near Kabul Bank, 3rd floor")).toBeVisible();
    await expect(page.getByTestId("shop-hours-fri")).toContainText("Closed");
    await expect(page.getByTestId("shop-hours-sat")).toContainText("08:00–18:00");
  });

  test("an unknown shop is a 404", async ({ page }) => {
    const resp = await page.goto("/en/shops/999");
    expect(resp?.status()).toBe(404);
  });

  test("is right-to-left in Pashto", async ({ page }) => {
    await page.goto("/ps/shops/42");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("shop-page")).toBeVisible();
  });
});

test.describe("Shop listings in the Bazaar and on detail", () => {
  test("the Shops chip shows only shop listings, with the Shop chip", async ({ page }) => {
    await page.goto("/en/bazaar");
    await page.getByTestId("browse-filter-shops").first().click();
    await expect(page).toHaveURL(/shops=1/);
    await expect(page.getByText("Chanel No. 5 (100 ml)")).toBeVisible();
    await expect(page.getByTestId("listing-shop-chip").first()).toBeVisible();
    await expect(page.getByText("iPhone 13 Pro")).toHaveCount(0);
  });

  test("a shop listing names the shop and says Message shop", async ({ page }) => {
    await page.goto("/en/listings/9042");
    await expect(page.getByTestId("listing-shop-link")).toContainText("Safi Cosmetics");
    await expect(page.getByTestId("listing-message-shop").first()).toHaveText("Message shop");
  });

  test("a personal listing is unchanged (Contact Seller, no Shop chip)", async ({ page }) => {
    await page.goto("/en/listings/1");
    await expect(page.getByTestId("listing-shop-link")).toHaveCount(0);
    await expect(page.getByText("Contact Seller").first()).toBeVisible();
  });
});

test.describe("A signed-in user with no shop", () => {
  test.use({ storageState: BUYER_STATE });

  test("sees 'Open your shop' on Profile and no Selling-as pill on My listings", async ({ page }) => {
    await page.goto("/en/profile");
    await expect(page.getByTestId("profile-open-shop")).toBeVisible();
    await page.goto("/en/my-listings");
    await expect(page.getByRole("heading", { name: "My listings" })).toBeVisible();
    await expect(page.getByTestId("selling-as-pill")).toHaveCount(0);
  });

  test("the shop form walks one question per screen with the progress bar", async ({ page }) => {
    await page.goto("/en/shops/new");
    await expect(page.getByTestId("shop-form-progress-label")).toHaveText("Step 1 of 8");
    await page.getByTestId("shop-form-next").click();
    await expect(page.getByTestId("shop-form-progress-label")).toHaveText("Step 2 of 8");
    await page.getByTestId("shop-form-name-input").fill("S");
    await page.getByTestId("shop-form-name-input").blur();
    await expect(page.getByText("Use 2 to 50 characters")).toBeVisible();
    await page.getByTestId("shop-form-name-input").fill("Safi Mobile");
    await expect(page.getByTestId("shop-form-preview")).toContainText("Safi Mobile");
    await page.getByTestId("shop-form-next").click();
    await expect(page.getByTestId("shop-form-progress-label")).toHaveText("Step 3 of 8");
  });
});

test.describe("Buyer mode is personal (owner, 2026-10-05)", () => {
  test.use({ storageState: EMPTY_STATE });

  test("your own Profile in Buyer mode shows no shop tools, but keeps Get verified", async ({ page }) => {
    await page.goto("/en/profile");
    await expect(page.getByTestId("verify-missing-avatar")).toBeVisible();
    await expect(page.getByTestId("profile-open-shop")).toHaveCount(0);
    await expect(page.getByTestId("profile-my-shop")).toHaveCount(0);
    await expect(page.getByTestId("selling-as-pill")).toHaveCount(0);
  });
});

test.describe("SHOP-2 (several shops, Message shop)", () => {
  test.use({ storageState: BUYER_STATE });

  test("'Message shop' on a shop page opens the shop's chat, which shows the shop, no product", async ({ page }) => {
    await page.goto("/en/shops/42");
    await page.getByTestId("shop-message").click();
    await expect(page).toHaveURL(/\/en\/conversations\/420$/);
    await expect(page.getByTestId("chat-shop-identity")).toContainText("Safi Cosmetics");
    await expect(page.getByText("Umair Safi")).toHaveCount(0);
    // No product: plain messages only (the API refuses offers and meetups here).
    await expect(page.getByRole("button", { name: "Propose Meetup" })).toHaveCount(0);
  });

  test("opening the same shop twice says so and links to the shop you already have", async ({ page }) => {
    // Resume a finished draft at "Check and open" (the form's own saved progress).
    await page.goto("/en/profile");
    await page.evaluate(() =>
      window.localStorage.setItem(
        "hatiwal.shop-draft",
        JSON.stringify({
          userId: 1, step: "review", name: "Safi Cosmetics", description: "", categoryId: 1,
          latitude: 34.55, longitude: 69.2, addressLine: "Shar-e Naw, Kabul",
          hoursPreset: null, hours: {}, phone: "", phonePublic: false,
        }),
      ),
    );
    await page.goto("/en/shops/new");
    await page.getByTestId("shop-form-open").click();
    await expect(page.getByText("You already have this shop (the same name nearby, or the same address).")).toBeVisible();
    await expect(page.getByTestId("shop-form-open-duplicate")).toHaveAttribute("href", "/en/shops/42");
  });
});

test.describe("an owner of several shops", () => {
  test.use({ storageState: BUYER_STATE });

  test("sees 'My shops' with one row per shop and 'Open another shop'", async ({ page }) => {
    await page.route("**/api/me/users/me**", async (route) => {
      const res = await route.fetch();
      const json = await res.json();
      const card = (id: number, name: string, status = "active") => ({ id, name, logo_url: null, verified: false, province: "Kabul", city: "Kabul", role: "owner", status });
      json.user = { ...json.user, shops: [card(42, "Safi Cosmetics"), card(43, "Safi Phones"), card(44, "Safi Shoes", "pending")] };
      await route.fulfill({ response: res, json });
    });
    await page.goto("/en/profile");
    await expect(page.getByRole("heading", { name: "My shops" })).toBeVisible();
    await expect(page.getByTestId("profile-my-shop")).toContainText("Safi Cosmetics");
    await expect(page.getByTestId("profile-my-shop-43")).toContainText("Safi Phones");
    await expect(page.getByTestId("profile-my-shop-44")).toBeVisible();
    await expect(page.getByTestId("profile-open-another-shop")).toBeVisible();
  });
});
