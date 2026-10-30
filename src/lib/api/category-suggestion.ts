import { meRequest } from "./me";

/**
 * Sell with a photo (hatiwal-api docs/SELL_WITH_PHOTO.md):
 * `POST /my/listings/category_suggestion`, multipart, ONE `image`, through the
 * authed proxy. Ids only (the form shows the category's own localized name),
 * or null when the server is not sure (204). Rails keeps nothing of the photo.
 */
export interface CategorySuggestion {
  categoryId: number;
  parentId: number | null;
  confidence: number;
}

/** The server looks at 224×224: 512 px keeps the upload ~40 KB on a slow line. */
export const SUGGESTION_PHOTO_SIDE = 512;

export async function suggestCategory(photo: Blob, filename: string): Promise<CategorySuggestion | null> {
  const form = new FormData();
  form.append("image", photo, filename);
  const data = await meRequest<CategorySuggestion | undefined>("my/listings/category_suggestion", { method: "POST", form });
  return data?.categoryId ? data : null;
}

/** What the seller did with it — one log line on the server, for tuning. */
export type SuggestionOutcome = "accepted" | "dismissed" | "replaced";

export function reportSuggestionOutcome(outcome: SuggestionOutcome, s: CategorySuggestion): Promise<unknown> {
  return meRequest("my/listings/category_suggestion/outcome", {
    json: { outcome, categoryId: s.categoryId, confidence: s.confidence },
  }).catch(() => undefined); // tuning data: never an error the seller sees
}
