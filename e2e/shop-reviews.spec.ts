import { test, expect, type Page } from "@playwright/test";

/**
 * The shop page's Reviews tab shows the SHOP's reviews (GET /shops/:id/reviews),
 * never the owner's personal ones; and a review card keeps its date inside the
 * card however long the reviewer's name (the bug mobile had).
 * Mock: shop 42 (owner Umair, id 2) has 2 shop reviews.
 */
const OWNER_PERSONAL = {
  reviews: [{ id: 999, rating: 1, comment: "OWNER PERSONAL REVIEW", role: "of_buyer", visible: true,
    revealed_at: "2026-09-01T10:00:00Z", created_at: "2026-09-01T09:00:00Z", transaction_id: 9, reviewee_id: 2,
    reviewer: { id: 5, name: "Someone", avatar_url: null } }],
  meta: { pagination: { current_page: 1, next_page: null, prev_page: null, total_count: 1, total_pages: 1 } },
};

async function ownerHasPersonalReviews(page: Page) {
  await page.route("**/api/proxy/users/2/reviews*", (route) => route.fulfill({ json: OWNER_PERSONAL }));
}

test("the Reviews tab lists the shop's reviews, never the owner's personal one", async ({ page }) => {
  await ownerHasPersonalReviews(page);
  await page.goto("/en/shops/42");
  await page.getByTestId("shop-tab-reviews").click();
  await expect(page.getByTestId("shop-reviews")).toBeVisible();
  await expect(page.getByText("Original perfume, the shop was easy to find.")).toBeVisible();
  await expect(page.getByTestId("review-card")).toHaveCount(2);
  await expect(page.getByText("OWNER PERSONAL REVIEW")).toHaveCount(0);
});

test("a shop with no reviews says so", async ({ page }) => {
  await ownerHasPersonalReviews(page);
  await page.route("**/api/proxy/shops/42/reviews*", (route) =>
    route.fulfill({ json: { reviews: [], meta: { pagination: { current_page: 1, next_page: null, prev_page: null, total_count: 0, total_pages: 1 } } } }),
  );
  await page.goto("/en/shops/42");
  await page.getByTestId("shop-tab-reviews").click();
  await expect(page.getByTestId("shop-reviews-empty")).toContainText("No reviews yet");
  await expect(page.getByText("OWNER PERSONAL REVIEW")).toHaveCount(0);
});

for (const locale of ["en", "ps"] as const) {
  test(`a long reviewer name keeps the date inside the card at 375px (${locale})`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.route("**/api/proxy/shops/42/reviews*", (route) =>
      route.fulfill({ json: { reviews: [{ id: 703, rating: 5, comment: "ok", role: "of_seller", visible: true,
        revealed_at: "2026-10-02T10:00:00Z", created_at: "2026-10-01T09:00:00Z", transaction_id: 803, reviewee_id: 2,
        reviewer: { id: 6, name: "Abdul Rahman Mohammad Ibrahim Khan Ahmadzai Popalzai Barakzai", avatar_url: null } }],
        meta: { pagination: { current_page: 1, next_page: null, prev_page: null, total_count: 1, total_pages: 1 } } } }),
    );
    await page.goto(`/${locale}/shops/42`);
    await page.getByTestId("shop-tab-reviews").click();
    const card = page.getByTestId("review-card");
    const date = card.getByTestId("review-date");
    await expect(date).toBeVisible();
    const c = (await card.boundingBox())!;
    const d = (await date.boundingBox())!;
    expect(d.x).toBeGreaterThanOrEqual(c.x);
    expect(d.x + d.width).toBeLessThanOrEqual(c.x + c.width);
    // One line: the date doesn't wrap.
    expect(d.height).toBeLessThan(24);
  });
}
