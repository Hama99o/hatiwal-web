import { apiGet } from "./client";
import type { Category } from "../types";

/**
 * Top-level categories, each with its nested `subcategories`.
 *
 * `withCounts` adds `activeListingsCount` to every category in the tree —
 * parents *and* their subcategories — via Rails' `?with_counts=true` (a single
 * GROUP BY on the server: no N+1, and no per-category request from here). A
 * parent's count includes its subcategories' listings, matching what filtering
 * by that category returns. Mirrors mobile's
 * `categoriesAPI.getCategoriesWithCounts`.
 */
export async function getCategories(
  opts: { revalidate?: number; withCounts?: boolean } = {},
): Promise<Category[]> {
  const data = await apiGet<{ categories: Category[] }>("categories", {
    revalidate: opts.revalidate,
    params: opts.withCounts ? { with_counts: true } : undefined,
  });
  return data.categories ?? [];
}

/** Flatten the category tree (top-level + subcategories) into a single list. */
export function flattenCategories(categories: Category[]): Category[] {
  const out: Category[] = [];
  for (const c of categories) {
    out.push(c);
    if (c.subcategories?.length) out.push(...flattenCategories(c.subcategories));
  }
  return out;
}

export function findCategoryBySlug(
  categories: Category[],
  slug: string,
): Category | undefined {
  return flattenCategories(categories).find((c) => c.slug === slug);
}

/** Localized category name for the active locale. */
export function categoryName(category: CategoryNameFields, locale: string): string {
  if (locale === "ps") return category.namePs || category.nameEn;
  if (locale === "fa") return category.nameFa || category.nameEn;
  return category.nameEn;
}

interface CategoryNameFields {
  nameEn: string;
  namePs: string;
  nameFa: string;
}
