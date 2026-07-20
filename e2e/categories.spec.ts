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
