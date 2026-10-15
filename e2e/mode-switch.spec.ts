import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import { shopEntry, withSessionUser } from "./session-user";

// Buyer ↔ Seller mode and the shop context in the header (mobile parity,
// docs/design/mode-switch.md): buying links in Buyer mode, selling links in
// Seller mode, an emerald accent while selling, and the switch + a role-aware
// "Sell as" list in the account menu.
test.describe("Mode switch", () => {
  test.use({ storageState: BUYER_STATE });

  const openMenu = async (page: import("@playwright/test").Page) => {
    // The avatar trigger is named after the viewer — waiting for it by name also
    // waits out the session probe (until then the slot is a pulsing placeholder).
    await page.locator("header").getByRole("button", { name: "Ahmad Karimi" }).click();
  };

  test("Buyer mode: buying links, no seller accent, no Sell-as list", async ({ page }) => {
    await withSessionUser(page, { sellerMode: false, shops: [shopEntry(42, "Safi Cosmetics")] });
    await page.goto("/en/bazaar");
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "Bazaar" })).toBeVisible();
    await expect(page.getByTestId("nav-my-listings")).toHaveCount(0);
    await expect(page.getByTestId("seller-mode-bar")).toHaveCount(0);
    await openMenu(page);
    await expect(page.getByTestId("menu-mode-buyer")).toHaveAttribute("aria-current", "true");
    await expect(page.getByRole("menuitem", { name: "Saved" })).toBeVisible();
    // Buyer mode is always personal (owner, 2026-10-05): no shop list here.
    await expect(page.getByTestId("menu-sell-as-me")).toHaveCount(0);
  });

  test("Seller mode: selling links replace the Bazaar, with the emerald bar", async ({ page }) => {
    await withSessionUser(page, { sellerMode: true });
    await page.goto("/en/my-listings");
    const header = page.locator("header");
    await expect(page.getByTestId("nav-my-listings")).toBeVisible();
    await expect(page.getByTestId("nav-new-listing")).toHaveAttribute("href", "/en/listings/new");
    await expect(header.getByRole("link", { name: "Bazaar", exact: true })).toHaveCount(0);
    await expect(page.getByTestId("seller-mode-bar")).toBeVisible();
    await openMenu(page);
    await expect(page.getByTestId("menu-mode-seller")).toHaveAttribute("aria-current", "true");
    await expect(page.getByRole("menuitem", { name: "Saved" })).toHaveCount(0);
  });

  test("phone, Seller mode: the search row becomes the selling shortcuts", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await withSessionUser(page, { sellerMode: true });
    await page.goto("/en/my-listings");
    const sub = page.getByTestId("seller-subnav");
    await expect(sub).toBeVisible();
    await expect(sub.getByRole("link", { name: "New Listing" })).toBeVisible();
    await expect(page.locator("header").getByRole("searchbox")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test("switching to Seller from the menu saves seller_mode and lands on My listings", async ({ page }) => {
    await withSessionUser(page, { sellerMode: false });
    await page.goto("/en/bazaar");
    await openMenu(page);
    const put = page.waitForRequest(
      (r) => r.url().includes("/users/me") && r.method() === "PUT" && (r.postData() ?? "").includes("seller"),
    );
    await page.getByTestId("menu-mode-seller").click();
    expect((await put).postDataJSON()).toMatchObject({ user: { seller_mode: true } });
    await expect(page).toHaveURL(/\/en\/my-listings$/);
  });

  test("Sell as: every active shop with its role; picking one asks the server", async ({ page }) => {
    await withSessionUser(page, {
      sellerMode: true,
      sellingAsShop: null,
      shops: [
        shopEntry(42, "Safi Cosmetics", "active", "owner"),
        shopEntry(43, "Kabul Phones", "active", "staff"),
        shopEntry(44, "Closed Corner", "closed", "owner"),
      ],
    });
    await page.route("**/users/me/selling_as", (route) => route.fulfill({ json: { user: {} } }));
    // The one-time "Sell as" ask (selling-as-pill.tsx) was already answered.
    await page.addInitScript(() => window.localStorage.setItem("hatiwal.sell-as-asked-1", "1"));
    await page.goto("/en/my-listings");
    await openMenu(page);
    await expect(page.getByTestId("menu-sell-as-me")).toHaveAttribute("aria-current", "true");
    await expect(page.getByTestId("menu-sell-as-shop-42")).toContainText("Owner");
    await expect(page.getByTestId("menu-sell-as-shop-43")).toContainText("Staff");
    // Only ACTIVE shops can be sold as (User#sell_as! on the server).
    await expect(page.getByTestId("menu-sell-as-shop-44")).toHaveCount(0);
    const patch = page.waitForRequest((r) => r.url().includes("/users/me/selling_as") && r.method() === "PATCH");
    await page.getByTestId("menu-sell-as-shop-43").click();
    expect((await patch).postDataJSON()).toMatchObject({ shop_id: 43 });
  });
});
