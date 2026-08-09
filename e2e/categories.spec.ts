import { test, expect } from "@playwright/test";

test.describe("Categories", () => {
  test("categories index lists all top-level categories", async ({ page }) => {
    await page.goto("/en/categories");
    await expect(page.getByRole("heading", { name: "Categories" })).toBeVisible();
    await expect(page.getByText("Electronics")).toBeVisible();
    await expect(page.getByText("Vehicles")).toBeVisible();
    await expect(page.getByText("Clothes & Fashion")).toBeVisible();
  });

  test("a category page shows only its listings", async ({ page }) => {
    await page.goto("/en/categories/vehicles");
    await expect(page.getByRole("heading", { name: /Vehicles/ })).toBeVisible();
    await expect(page.getByText("Toyota Corolla 2015")).toBeVisible();
    await expect(page.getByText("iPhone 13 Pro")).toHaveCount(0);
  });

  test("clicking a category from the index navigates to it", async ({ page }) => {
    await page.goto("/en/categories");
    await page.getByRole("link", { name: /Vehicles/ }).first().click();
    await expect(page).toHaveURL(/\/categories\/vehicles/);
    await expect(page.getByText("Toyota Corolla 2015")).toBeVisible();
  });

  // ── Hub counts + drill-down (TASK-WEB-CAT623) ────────────────────────────
  // Fixture: Electronics holds 1 listing directly (Samsung 4K TV) plus 1 in
  // Phones (iPhone) and 1 in Laptops (MacBook) → 3. Cameras is empty, and
  // Home & Garden has nothing anywhere.

  test("every card states its count, rolled up from its subcategories", async ({
    page,
  }) => {
    await page.goto("/en/categories");
    // 3, not 1: counting only listings filed directly under Electronics would
    // under-report the inventory sitting behind the card.
    await expect(
      page.getByRole("link", { name: "Electronics — 3 listings" }),
    ).toBeVisible();
    // A real ICU plural, never "1 listings".
    await expect(
      page.getByRole("link", { name: "Vehicles — 1 listing" }),
    ).toBeVisible();
  });

  test("an empty category says so instead of showing a bare 0, and sorts last", async ({
    page,
  }) => {
    await page.goto("/en/categories");
    const cards = page.getByTestId("category-card");
    await expect(cards).toHaveCount(4);
    await expect(
      page.getByRole("link", { name: "Home & Garden — No listings" }),
    ).toBeVisible();
    // Categories with stock come first so buyers do not click into a dead end.
    await expect(cards.last()).toContainText("Home & Garden");
    await expect(cards.first()).toContainText("Electronics");
  });

  test("stocked subcategories are chips; the empty one hides behind +N more", async ({
    page,
  }) => {
    await page.goto("/en/categories");
    const electronics = page
      .getByTestId("category-card")
      .filter({ hasText: "Electronics" });
    const phones = electronics.getByRole("link", {
      name: "Phones & Tablets — 1 listing",
    });
    await expect(phones).toBeVisible();
    await expect(
      electronics.getByRole("link", { name: "Computers & Laptops — 1 listing" }),
    ).toBeVisible();
    // Cameras is empty, so it is never offered as a chip — a chip that leads
    // nowhere is the dead end this hub exists to prevent.
    await expect(electronics.getByRole("link", { name: /Cameras/ })).toHaveCount(
      0,
    );
    await expect(
      electronics.getByRole("link", { name: "+1 more" }),
    ).toBeVisible();
    // Chips are real tap targets (mobile's SubcategoryPanel uses minHeight 44).
    const box = await phones.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test("the drill-down states every sibling's count and lists the rolled-up stock", async ({
    page,
  }) => {
    await page.goto("/en/categories/electronics");
    // The empty sibling is shown here, de-emphasised and labelled — not hidden.
    await expect(
      page.getByRole("link", { name: "Cameras — No listings" }),
    ).toBeVisible();
    // The hub promised 3; the category page must actually deliver 3.
    await expect(page.getByText("Samsung 4K TV")).toBeVisible();
    await expect(page.getByText("iPhone 13 Pro")).toBeVisible();
    await expect(page.getByText("MacBook Pro M2")).toBeVisible();
  });

  test("an empty category's page explains itself rather than showing a void", async ({
    page,
  }) => {
    await page.goto("/en/categories/home-garden");
    await expect(
      page.getByText("No listings in this category yet"),
    ).toBeVisible();
  });

  test("drills down from a category into its subcategories and back", async ({
    page,
  }) => {
    await page.goto("/en/categories/electronics");
    // Subcategory chips are shown for a top-level category.
    await expect(
      page.getByRole("link", { name: /Phones & Tablets/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Computers & Laptops/ }),
    ).toBeVisible();
    // Drill into a subcategory.
    await page.getByRole("link", { name: /Phones & Tablets/ }).click();
    await expect(page).toHaveURL(/\/categories\/phones/);
    // Parent breadcrumb links back to the top-level category.
    await page.getByRole("link", { name: /Electronics/ }).click();
    await expect(page).toHaveURL(/\/categories\/electronics/);
  });
});
