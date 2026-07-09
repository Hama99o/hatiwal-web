import { apiGet } from "./client";
import type { Review, ReviewRole } from "../types";
import type { Pagination } from "../types";

interface ReviewsEnvelope {
  reviews: Review[];
  meta: { pagination: Pagination };
}

export interface ReviewsResult {
  items: Review[];
  pagination: Pagination;
}

/**
 * A user's VISIBLE reviews (double-blind: hidden ones never appear). Guest-safe
 * — the Rails `reviews#index` skips auth for reads, since a seller's rating is a
 * public trust signal on the shareable profile. Optional `role` filters to
 * reviews of them AS a seller (`of_seller`) or AS a buyer (`of_buyer`).
 *
 * Reuses the exact mobile contract: `GET /users/:id/reviews?role=&page[number]=`.
 */
export async function getUserReviews(
  userId: number | string,
  opts: { role?: ReviewRole; page?: number; revalidate?: number } = {},
): Promise<ReviewsResult> {
  const data = await apiGet<ReviewsEnvelope>(`users/${userId}/reviews`, {
    params: { role: opts.role, "page[number]": opts.page },
    revalidate: opts.revalidate,
  });
  return { items: data.reviews, pagination: data.meta.pagination };
}
