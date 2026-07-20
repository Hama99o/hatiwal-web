import { apiGet } from "./client";
import { meRequest } from "./me";
import type { Review, ReviewRole, Transaction } from "../types";
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

/**
 * Leave a review on a sold transaction (authed — routed through the /api/me
 * proxy). The review is created HIDDEN and revealed once both parties rate
 * each other (or after 14 days). Backend infers the reviewer's role, so only
 * rating + optional comment are sent. Mirrors the mobile `createReview`.
 */
export async function createReview(
  transactionId: number,
  data: { rating: number; comment?: string },
): Promise<Review> {
  const res = await meRequest<{ review: Review }>(
    `transactions/${transactionId}/reviews`,
    { method: "POST", json: { review: data } },
  );
  return res.review;
}

/** Edit your own review while it's still hidden (403 once revealed). */
export async function updateReview(
  id: number,
  data: { rating?: number; comment?: string },
): Promise<Review> {
  const res = await meRequest<{ review: Review }>(`reviews/${id}`, {
    method: "PATCH",
    json: { review: data },
  });
  return res.review;
}

/** Sold transactions the caller still owes a review on — the "rate your recent
 *  deals" nudge. Empty array when nothing is pending. */
export async function getPendingReviews(): Promise<Transaction[]> {
  const data = await meRequest<{ transactions: Transaction[] }>(
    "my/reviews/pending",
  );
  return data.transactions ?? [];
}
