import { test, expect } from "@playwright/test";
import { shouldAskForSuggestion, suggestedCategory } from "../src/lib/category-suggestion/rules";
import type { Category } from "../src/lib/types";

/**
 * Unit checks for sell with a photo's rules (hatiwal-mobile
 * docs/design/SELL_WITH_PHOTO.md §1). No page, no server: Playwright is this
 * repo's only runner (see image-search-unit.spec.ts).
 */
const phones = { id: 101, slug: "phones", name_en: "Phones & Tablets", subcategories: [] } as unknown as Category;
const electronics = { id: 1, slug: "electronics", name_en: "Electronics", subcategories: [phones] } as unknown as Category;
const tree = [electronics];
const answer = { categoryId: 101, parentId: 1, confidence: 0.62, photoKey: "blob:a" };
const ask = { isEdit: false, enabled: true, online: true, alreadyAsked: false, photoCount: 1, categoryId: "" };

test.describe("shouldAskForSuggestion: at most one request, only where a chip could show", () => {
  test("a new listing, first photo, empty category, online → ask", () => {
    expect(shouldAskForSuggestion(ask)).toBe(true);
  });

  test("never when editing, off, offline, already asked, photo-less or with a category", () => {
    expect(shouldAskForSuggestion({ ...ask, isEdit: true })).toBe(false);
    expect(shouldAskForSuggestion({ ...ask, enabled: false })).toBe(false);
    expect(shouldAskForSuggestion({ ...ask, online: false })).toBe(false);
    expect(shouldAskForSuggestion({ ...ask, alreadyAsked: true })).toBe(false);
    expect(shouldAskForSuggestion({ ...ask, photoCount: 0 })).toBe(false);
    expect(shouldAskForSuggestion({ ...ask, categoryId: "26" })).toBe(false);
  });
});

test.describe("suggestedCategory: the owner's rule — never over the seller's choice", () => {
  const show = { answer, categoryId: "", dismissed: false, photoKeys: ["blob:a"], categories: tree };

  test("shows the suggested category, with its parent", () => {
    expect(suggestedCategory(show)).toEqual({ category: phones, parent: electronics });
  });

  test("nothing once a category is set — even one set AFTER the photo was sent", () => {
    expect(suggestedCategory({ ...show, categoryId: "26" })).toBeNull();
    expect(suggestedCategory({ ...show, categoryId: "101" })).toBeNull();
  });

  test("nothing after ✕, without an answer, or when its photo was removed", () => {
    expect(suggestedCategory({ ...show, dismissed: true })).toBeNull();
    expect(suggestedCategory({ ...show, answer: null })).toBeNull();
    expect(suggestedCategory({ ...show, photoKeys: ["blob:b"] })).toBeNull();
  });

  test("nothing for a category this client does not know (switched off since)", () => {
    expect(suggestedCategory({ ...show, answer: { ...answer, categoryId: 999 } })).toBeNull();
  });
});
