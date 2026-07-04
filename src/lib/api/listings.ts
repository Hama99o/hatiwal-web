import { apiGet, type QueryParams } from "./client";
import type {
  Listing,
  ListingsResult,
  ListingSort,
  Pagination,
} from "../types";

/** Filters accepted by the listings index — mirrors the mobile getListings query. */
export interface ListingsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: number;
  condition?: string;
  userId?: number;
  status?: string;
  priceMin?: number;
  priceMax?: number;
  sort?: ListingSort;
  latitude?: number;
  longitude?: number;
  radius?: number;
  location?: string;
}

/** Raw listing as it arrives (after snake→camel) — price/lat/lng are strings. */
export interface RawListing
  extends Omit<Listing, "price" | "latitude" | "longitude" | "images"> {
  price: string | number;
  latitude: string | number | null;
  longitude: string | number | null;
  images?: string[];
  imageUrls?: string[];
}

function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

/** Normalize Rails string numerics and unify the image arrays. */
export function normalizeListing(raw: RawListing): Listing {
  const images =
    raw.images && raw.images.length
      ? raw.images
      : raw.imageUrls && raw.imageUrls.length
        ? raw.imageUrls
        : raw.thumbnailUrl
          ? [raw.thumbnailUrl]
          : [];

  return {
    ...raw,
    price: num(raw.price) ?? 0,
    latitude: num(raw.latitude),
    longitude: num(raw.longitude),
    images,
  };
}

function toParams(q: ListingsQuery): QueryParams {
  return {
    "page[number]": q.page,
    "page[size]": q.pageSize,
    search: q.search,
    category_id: q.categoryId,
    condition: q.condition,
    user_id: q.userId,
    status: q.status,
    price_min: q.priceMin,
    price_max: q.priceMax,
    sort: q.sort,
    latitude: q.latitude,
    longitude: q.longitude,
    radius: q.radius,
    location: q.location,
  };
}

interface ListingsEnvelope {
  listings: RawListing[];
  meta: { pagination: Pagination };
}

export async function getListings(
  query: ListingsQuery = {},
  opts: { revalidate?: number } = {},
): Promise<ListingsResult> {
  const data = await apiGet<ListingsEnvelope>("listings", {
    params: toParams(query),
    revalidate: opts.revalidate,
  });
  return {
    items: data.listings.map(normalizeListing),
    pagination: data.meta.pagination,
  };
}

/**
 * Sold listings for a seller's public profile (F742).
 *
 * Reuses the same guest-accessible endpoint mobile uses
 * (`GET /users/:id/sold_listings`, `:list` view) — no contract change.
 */
export async function getSoldListings(
  userId: number | string,
  page?: number,
  opts: { revalidate?: number } = {},
): Promise<ListingsResult> {
  const data = await apiGet<ListingsEnvelope>(
    `users/${userId}/sold_listings`,
    { params: { "page[number]": page }, revalidate: opts.revalidate },
  );
  return {
    items: data.listings.map(normalizeListing),
    pagination: data.meta.pagination,
  };
}

export async function getListing(
  id: number | string,
  opts: { revalidate?: number } = {},
): Promise<Listing> {
  const data = await apiGet<{ listing: RawListing }>(`listings/${id}`, {
    revalidate: opts.revalidate,
  });
  return normalizeListing(data.listing);
}

/** Safe empty result for ISR fallbacks (see lib/api/safe). */
export const EMPTY_LISTINGS: ListingsResult = {
  items: [],
  pagination: {
    currentPage: 1,
    nextPage: null,
    prevPage: null,
    totalCount: 0,
    totalPages: 0,
  },
};
