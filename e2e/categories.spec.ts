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
  // Home & Garden has nothing anywhere — including in any of its 5 children,
  // which is the production shape (see the fixture comment).

  test("every card states its count, rolled up from its subcategories", async ({
    page,
  }) => {
    await page.goto("/en/categories");
    // 4, not 1: counting only listings filed directly under Electronics would
    // under-report the inventory sitting behind the card. (2 under phones — one
    // of them the multi-unit batch fixture — 1 under laptops, 1 direct.)
    await expect(
      page.getByRole("link", { name: "Electronics — 4 listings" }),
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

  test("a category's children are all offered as chips, stocked ones first", async ({
    page,
  }) => {
    await page.goto("/en/categories");
    const electronics = page
      .getByTestId("category-card")
      .filter({ hasText: "Electronics" });
    const phones = electronics.getByRole("link", {
      name: "Phones & Tablets — 2 listings",
    });
    await expect(phones).toBeVisible();
    await expect(
      electronics.getByRole("link", { name: "Computers & Laptops — 1 listing" }),
    ).toBeVisible();
    // The empty child is still reachable — filtering it out is what made the
    // whole drill-down vanish live, where every subcategory sits at 0 — but it
    // says so in its accessible name and sorts behind the stocked ones.
    await expect(
      electronics.getByRole("link", { name: "Cameras — No listings" }),
    ).toBeVisible();
    const chipLabels = await electronics
      .getByRole("link")
      // [0] is the card link itself; the chips follow it in DOM order.
      .evaluateAll((els) =>
        els.slice(1).map((el) => el.getAttribute("aria-label") ?? ""),
      );
    expect(chipLabels.at(-1)).toContain("Cameras");
    // Chips are real tap targets (mobile's SubcategoryPanel uses minHeight 44).
    const box = await phones.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test("children of a category with no stock anywhere are still offered, capped at 4 + more", async ({
    page,
  }) => {
    await page.goto("/en/categories");
    const homeGarden = page
      .getByTestId("category-card")
      .filter({ hasText: "Home & Garden" });
    // The regression this test exists for: gating the chips on "has stock"
    // rendered NOTHING here, so the drill-down was invisible in the live app
    // even though every parent has children.
    await expect(
      homeGarden.getByRole("link", {
        name: "Furniture — No listings",
        exact: true,
      }),
    ).toBeVisible();
    // 5 children → 4 chips + the overflow link into the drill-down, which reads
    // as the parent page it lands on rather than a bare "+1 more".
    const overflow = homeGarden.getByRole("link", {
      name: "All listings in Home & Garden",
      exact: true,
    });
    await expect(overflow).toBeVisible();
    await expect(overflow).toHaveText("+1 more");
    // An empty chip never prints a bare "0", and "No listings" is not repeated
    // on every chip — the dashed tone carries it, the accessible name spells it
    // out. The single visible occurrence is the card's own count line.
    await expect(
      homeGarden.getByText("No listings", { exact: true }),
    ).toHaveCount(1);

    // exact: a substring match would also hit the card's own
    // "Home & Garden — No listings" link.
    await homeGarden
      .getByRole("link", { name: "Garden — No listings", exact: true })
      .click();
    await expect(page).toHaveURL(/\/categories\/garden/);
    await expect(page.getByRole("heading", { name: /Garden/ })).toBeVisible();
    await expect(
      page.getByText("No listings in this category yet"),
    ).toBeVisible();
    // Sibling row: "you are here" is marked and is not a link.
    await expect(page.locator('[aria-current="page"]')).toContainText("Garden");
    await expect(
      page.getByRole("link", { name: "Furniture — No listings", exact: true }),
    ).toBeVisible();
    // …and the back link out is a full 44px tap target.
    const back = page.getByRole("link", { name: "Home & Garden", exact: true });
    await expect(back).toBeVisible();
    const box = await back.boundingBox();
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
