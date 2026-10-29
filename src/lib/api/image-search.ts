import { ApiError } from "./client";
import { meRequest } from "./me";
import { normalizeListing, type RawListing } from "./listings";
import type { ListingsResult, Pagination } from "../types";

/**
 * Search by image (hatiwal-api docs/IMAGE_SEARCH.md):
 * `POST /listings/image_search`, multipart, ONE `image`, through the authed
 * proxy: on the web it is for signed-in buyers only (image-search-button.tsx
 * says why), and Rails then also leaves out their hidden listings and blocked
 * sellers.
 *
 * Rails keeps nothing of the photo. Each page re-sends it, so the web asks for
 * one page of IMAGE_SEARCH_PAGE_SIZE (= the server's MAX_RESULTS).
 */
export const IMAGE_SEARCH_PAGE_SIZE = 60;
/** Listing::MAX_IMAGE_SIZE — a bigger file is refused before it is sent. */
export const IMAGE_SEARCH_MAX_BYTES = 10 * 1024 * 1024;

const PATH = "listings/image_search";

interface Envelope {
  listings: RawListing[];
  meta: { pagination: Pagination };
}

export async function searchByImage(
  photo: Blob,
  { filename }: { filename?: string } = {},
): Promise<ListingsResult> {
  const form = new FormData();
  form.append("image", photo, filename || (photo instanceof File ? photo.name : "photo.jpg"));
  form.append("page[size]", String(IMAGE_SEARCH_PAGE_SIZE));
  const data = await meRequest<Envelope>(PATH, { method: "POST", form });
  return { items: data.listings.map(normalizeListing), pagination: data.meta.pagination };
}

/** The translated message (key under `imageSearch.errors`) for a failed search. */
export type ImageSearchErrorKey =
  | "invalidImage"
  | "tooLarge"
  | "rateLimited"
  | "unavailable"
  | "offline"
  | "generic";

export function imageSearchErrorKey(err: unknown): ImageSearchErrorKey {
  if (!(err instanceof ApiError)) return "offline"; // the fetch itself rejected
  if (err.code === "image_too_large") return "tooLarge";
  if (err.code === "invalid_image" || err.code === "image_missing") return "invalidImage";
  if (err.status === 429 || err.code === "rate_limited") return "rateLimited";
  if (err.status === 503 || err.code === "image_search_unavailable") return "unavailable";
  if (err.status === 502) return "offline"; // the proxy could not reach Rails
  return "generic";
}

/**
 * Checked in the browser before any upload: the server refuses the same
 * things, but a buyer on a slow connection should not wait for a 10 MB upload
 * to learn it.
 */
export function precheckPhoto(file: { type: string; size: number }): ImageSearchErrorKey | null {
  // An empty type is what some browsers report for HEIC: let the server decide.
  if (file.type && !file.type.startsWith("image/")) return "invalidImage";
  if (file.size > IMAGE_SEARCH_MAX_BYTES) return "tooLarge";
  return null;
}
