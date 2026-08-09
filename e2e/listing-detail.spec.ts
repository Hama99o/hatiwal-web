import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

test.describe("Listing detail", () => {
  test("shows full listing info, seller and description", async ({ page }) => {
    await page.goto("/en/listings/1");
    await expect(page.getByRole("heading", { name: "iPhone 13 Pro" })).toBeVisible();
    await expect(page.getByText("AFN 45,000")).toBeVisible();
    await expect(page.getByText("Barely used iPhone 13 Pro, 256GB.")).toBeVisible();
    await expect(page.getByText("Ahmad Karimi")).toBeVisible();
    await expect(page.getByText("Phones & Tablets")).toBeVisible();
    await expect(page.getByText(/12% price drop/i)).toBeVisible();
  });

  test("gated actions are present (Message Seller / Report)", async ({ page }) => {
    await page.goto("/en/listings/1");
    await expect(page.getByText(/Message Seller/i)).toBeVisible();
    await expect(page.getByText(/Report/i).first()).toBeVisible();
  });

  test("unknown listing id returns a 404", async ({ page }) => {
    const resp = await page.goto("/en/listings/99999");
    expect(resp?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  });

  test("a reserved listing is still viewable by direct id", async ({ page }) => {
    const resp = await page.goto("/en/listings/6");
    expect(resp?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Mountain Bike (Reserved)" })).toBeVisible();
  });

  test("meetup safety tips open in a dialog and close", async ({ page }) => {
    await page.goto("/en/listings/1");
    await page
      .getByRole("button", { name: /Meetup safety tips/i })
      .click();
    await expect(
      page.getByRole("heading", { name: "Meetup Safety Tips" }),
    ).toBeVisible();
    await expect(
      page.getByText(/Meet in a busy, public place/i),
    ).toBeVisible();
    await page.getByRole("button", { name: "Got it" }).click();
    await expect(
      page.getByRole("heading", { name: "Meetup Safety Tips" }),
    ).toHaveCount(0);
  });
});

// The buyer persona is user 1, who is also the seller of listing 1 — so this
// signed-in visit is a seller opening their OWN listing's public page.
test.describe("Listing detail — viewed by its own seller", () => {
  test.use({ storageState: BUYER_STATE });

  test("shows the owner panel with manage / edit / conversations", async ({
    page,
  }) => {
    await page.goto("/en/listings/1");
    const panel = page.getByTestId("owner-listing-bar");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("This is your listing")).toBeVisible();
    // Lifecycle is legible from here (listing 1 is active).
    await expect(panel.getByText("Active")).toBeVisible();

    await expect(
      panel.getByRole("link", { name: /Manage Listing/i }),
    ).toHaveAttribute("href", "/en/my-listings/1");
    await expect(panel.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/en/listings/1/edit",
    );
    await expect(
      panel.getByRole("link", { name: /View Conversations/i }),
    ).toHaveAttribute("href", "/en/conversations?listing=1");
  });

  test("buyer-only affordances stay hidden for the owner", async ({ page }) => {
    await page.goto("/en/listings/1");
    await expect(page.getByTestId("owner-listing-bar")).toBeVisible();
    // Meetup tips are buyer guidance — not shown to the seller of the item.
    await expect(
      page.getByRole("button", { name: /Meetup safety tips/i }),
    ).toHaveCount(0);
    await expect(page.getByText(/Message Seller/i)).toHaveCount(0);
    await expect(page.getByText(/Not interested/i)).toHaveCount(0);
  });

  test("owner panel also works on a non-active listing", async ({ page }) => {
    // Listing 9 is user 1's RESERVED listing: the panel still renders (that's
    // where Manage lives) and the expiry pill stays out — only active listings
    // have a live expiry clock.
    await page.goto("/en/listings/9");
    const panel = page.getByTestId("owner-listing-bar");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Reserved")).toBeVisible();
    await expect(panel.getByText(/Expires|Expired/i)).toHaveCount(0);
    await expect(
      panel.getByRole("link", { name: /Manage Listing/i }),
    ).toHaveAttribute("href", "/en/my-listings/9");
  });

  test("owner panel is localized and keeps the locale prefix (ps)", async ({
    page,
  }) => {
    await page.goto("/ps/listings/1");
    const panel = page.getByTestId("owner-listing-bar");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("دا ستاسو اعلان دی")).toBeVisible();
    await expect(
      panel.getByRole("link", { name: "اعلان اداره کول" }),
    ).toHaveAttribute("href", "/ps/my-listings/1");
  });

  test("a non-owner still sees the buyer actions and no owner panel", async ({
    page,
  }) => {
    // Listing 2 belongs to seller 2, so the same signed-in user is a buyer here.
    await page.goto("/en/listings/2");
    await expect(page.getByTestId("owner-listing-bar")).toHaveCount(0);
    await expect(page.getByText(/Message Seller/i).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Meetup safety tips/i }),
    ).toBeVisible();
  });
});

// A sold/reserved listing used to end the visit in a flat grey notice. These
// pages are indexed and stock turns over fast, so the notice now carries two
// recovery paths (same category + price band, and the seller's other stock).
test.describe("Listing detail — sold/reserved recovery CTAs", () => {
  test("a sold listing keeps the notice and offers both next steps", async ({
    page,
  }) => {
    // Listing 7: sold, AFN 8,000, "Clothes & Fashion" (slug clothes), Ahmad Karimi.
    await page.goto("/en/listings/7");
    const card = page.getByTestId("unavailable-actions");
    await expect(card).toBeVisible();
    await expect(card.getByText("This item has been sold")).toBeVisible();
    // Sold is final — the "may free up" nudge belongs to reserved only.
    await expect(card.getByText(/reservation can fall through/i)).toHaveCount(0);

    // ±30% of 8,000, rounded → 5,600 … 10,400, using the shared browse param
    // names (category/min/max) so the Bazaar sidebar renders them as filters.
    await expect(
      card.getByRole("link", { name: /See similar in Clothes & Fashion/i }),
    ).toHaveAttribute("href", "/en/bazaar?category=clothes&min=5600&max=10400");
    await expect(
      card.getByRole("link", { name: /More from Ahmad Karimi/i }),
    ).toHaveAttribute("href", "/en/sellers/1");

    // The rest of the buyer column survives — saving a sold item is still how
    // you follow the seller, and the safety guidance stays put.
    await expect(page.getByText(/Save listing|Remove from saved/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Meetup safety tips/i }),
    ).toBeVisible();
  });

  test("a reserved listing adds the 'may free up' line", async ({ page }) => {
    // Listing 6: reserved, AFN 5,000, Vehicles, Sara Ahmadi.
    await page.goto("/en/listings/6");
    const card = page.getByTestId("unavailable-actions");
    await expect(card.getByText("This item is reserved")).toBeVisible();
    await expect(card.getByText(/reservation can fall through/i)).toBeVisible();
    await expect(
      card.getByRole("link", { name: /See similar in Vehicles/i }),
    ).toHaveAttribute("href", "/en/bazaar?category=vehicles&min=3500&max=6500");
    await expect(
      card.getByRole("link", { name: /More from Sara Ahmadi/i }),
    ).toHaveAttribute("href", "/en/sellers/2");
  });

  test("'See similar' lands on a pre-filtered Bazaar without the dead listing", async ({
    page,
  }) => {
    // Listing 9: reserved, AFN 70,000, Computers & Laptops → band 49,000–91,000,
    // which the active MacBook Pro M2 (90,000) falls inside.
    await page.goto("/en/listings/9");
    await page
      .getByTestId("unavailable-actions")
      .getByRole("link", { name: /See similar in/i })
      .click();

    await expect(page).toHaveURL(/\/en\/bazaar\?category=laptops&min=49000&max=91000/);
    // Category + min + max are all live filters, so the pill counts three.
    await expect(page.getByText("3 filters active")).toBeVisible();
    await expect(page.getByPlaceholder("Min Price")).toHaveValue("49000");
    await expect(page.getByPlaceholder("Max Price")).toHaveValue("91000");
    // Bazaar only ever queries active stock — the reserved item can't come back.
    await expect(page.getByText("MacBook Pro M2")).toBeVisible();
    await expect(page.getByText("Gaming PC")).toHaveCount(0);
  });

  test("an active listing is untouched (no recovery card)", async ({ page }) => {
    await page.goto("/en/listings/1");
    await expect(page.getByTestId("unavailable-actions")).toHaveCount(0);
    await expect(page.getByText(/Message Seller/i).first()).toBeVisible();
  });

  test("the bottom rail is labelled 'Similar Listings', not 'Recent'", async ({
    page,
  }) => {
    await page.goto("/en/listings/7");
    await expect(
      page.getByRole("heading", { name: "Similar Listings" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Recent listings/i }),
    ).toHaveCount(0);
  });

  test("the card is localized and keeps the locale prefix (ps)", async ({
    page,
  }) => {
    await page.goto("/ps/listings/7");
    const card = page.getByTestId("unavailable-actions");
    await expect(card.getByText("دا توکی خرڅ شوی دی")).toBeVisible();
    await expect(card.getByRole("link").first()).toHaveAttribute(
      "href",
      "/ps/bazaar?category=clothes&min=5600&max=10400",
    );
    await expect(
      card.getByRole("link", { name: /Ahmad Karimi/ }),
    ).toHaveAttribute("href", "/ps/sellers/1");
  });
});
