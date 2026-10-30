import type { Category } from "@/lib/types";

/**
 * Sell with a photo — the owner's rules as pure functions (hatiwal-mobile
 * docs/design/SELL_WITH_PHOTO.md §1), so they are unit-tested apart from the
 * form. Mobile carries the same two functions.
 */

/** What the API answered, plus WHICH photo it was about. */
export interface SuggestionAnswer {
  categoryId: number;
  parentId: number | null;
  confidence: number;
  photoKey: string;
}

/**
 * At most ONE request per new listing, and only where a chip could show:
 * never when editing, offline, without the server feature, once asked, before
 * a photo, or when the seller already has a category.
 */
export function shouldAskForSuggestion(s: {
  isEdit: boolean;
  enabled: boolean;
  online: boolean;
  alreadyAsked: boolean;
  photoCount: number;
  categoryId: string;
}): boolean {
  return !s.isEdit && s.enabled && s.online && !s.alreadyAsked && s.photoCount > 0 && !s.categoryId;
}

/**
 * The category to offer RIGHT NOW, or null. Checked on every render, not when
 * the photo was sent: a category set meanwhile (by hand, a restored draft)
 * always wins. Nothing after ✕, nor when the photo it was about is gone, nor
 * for a category this client does not know.
 */
export function suggestedCategory(s: {
  answer: SuggestionAnswer | null;
  categoryId: string;
  dismissed: boolean;
  photoKeys: string[];
  categories: Category[];
}): { category: Category; parent: Category | null } | null {
  const { answer } = s;
  if (!answer || s.dismissed || s.categoryId || !s.photoKeys.includes(answer.photoKey)) return null;
  for (const top of s.categories) {
    if (top.id === answer.categoryId) return { category: top, parent: null };
    const child = top.subcategories?.find((c) => c.id === answer.categoryId);
    if (child) return { category: child, parent: top };
  }
  return null;
}
