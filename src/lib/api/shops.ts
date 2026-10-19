import { apiGet } from "./client";
import { meRequest, putVideo, type VideoUpload } from "./me";
import type { ShopCard } from "../types";
import type { ShopHours } from "../shop-hours";

/**
 * SHOP-1 shops (docs/SHOPS.md phase 1). Same endpoints and shapes as mobile
 * (hatiwal-mobile src/api/shops.ts; contract qa/api_contract/SHOPS_2026-10.md).
 */
export interface Shop extends ShopCard {
  description: string | null;
  categoryId: number;
  category: { id: number; slug: string; nameEn: string; namePs: string; nameFa: string; nameUr?: string } | null;
  latitude: string | number;
  longitude: string | number;
  addressLine: string;
  hours: ShopHours;
  /** Computed by the API in Asia/Kabul; null = no hours given. Absent on an older API. */
  openNow?: boolean | null;
  /** The next open↔closed moment (ISO8601), or null. */
  nextChangeAt?: string | null;
  /** The zone open_now is computed in: Asia/Kabul, or Asia/Karachi for Pakistan. */
  timeZone?: string | null;
  createdAt: string;
  coverUrl: string | null;
  /** 1.1.6 photo variants: the 1200px cover for the shop page (fallback: coverUrl). */
  coverMediumUrl?: string | null;
  /** SHOP-MEDIA (docs/SHOP_MEDIA.md): one optional video ("▶ Video" on the cover). Absent on an older API. */
  hasVideo?: boolean;
  videoUrl?: string | null;
  videoPosterUrl?: string | null;
  videoDurationS?: number | null;
  /** SHOP-MEDIA: up to 5 photos of the real shop, in the owner's order. Absent on an older API. */
  galleryPhotos?: ShopGalleryPhoto[];
  phone: string | null;
  listingsCount: number;
  verifiedAt: string | null;
  /** Members only (api 9d153d0): the public shop page never names its owner. */
  owner?: { id: number; name: string };
  shareUrl: string | null;
  avgRating: number | null;
  reviewCount: number;
  status?: "active" | "suspended" | "pending" | "closed";
  phonePublic?: boolean;
  role?: "owner" | "manager" | "staff" | null;
  /**
   * Members only (owner view, api docs/WARNINGS_API.md): the shop's own active
   * moderation warnings. 3 active → the SHOP is suspended (they never count
   * toward the owner's personal 3). Absent on an older API and in the public
   * view — which is all the server-rendered shop page ever gets.
   */
  activeWarningsCount?: number;
  warningsThreshold?: number;
  latestWarning?: ShopWarning | null;
}

/** One shop photo; `id` is what PUT shops/:id/gallery takes back to keep or reorder it. */
export interface ShopGalleryPhoto {
  id: string;
  url: string;
  mediumUrl: string | null;
  thumbUrl: string | null;
}

/** SHOP-MEDIA: the most photos a shop shows (Shop::MAX_GALLERY_PHOTOS). */
export const MAX_SHOP_PHOTOS = 5;

export interface ShopWarning {
  category: string;
  /** Display reason, in the reader's language. */
  reason: string;
  createdAt: string;
  /** The taken-down listing's title, or null for a shop-level warning. */
  listingTitle: string | null;
}

/**
 * The shop's warning card, or null when there is nothing to show: the viewer
 * is not a member (no `role` — never a buyer, whatever the payload says), no
 * active warnings, or an API that does not send the keys. Mirrors mobile's
 * `shopWarnings` (src/api/shops.ts).
 */
export function shopWarnings(
  shop: Pick<Shop, "role" | "activeWarningsCount" | "warningsThreshold" | "latestWarning"> | null | undefined,
): { activeCount: number; threshold: number; warnings: ShopWarning[] } | null {
  if (!shop?.role) return null;
  const count = shop.activeWarningsCount;
  const threshold = shop.warningsThreshold;
  if (typeof count !== "number" || count <= 0 || typeof threshold !== "number") return null;
  const latest = shop.latestWarning;
  return { activeCount: count, threshold, warnings: latest && typeof latest === "object" ? [latest] : [] };
}

export interface ShopInput {
  name: string;
  description?: string;
  categoryId: number;
  latitude: number;
  longitude: number;
  province?: string | null;
  city?: string | null;
  addressLine: string;
  phone?: string;
  phonePublic?: boolean;
  hours?: ShopHours;
  logo?: Blob | null;
  cover?: Blob | null;
}

/** Public shop page (guests too); server-rendered. */
export async function getShop(id: number | string, opts: { revalidate?: number } = {}): Promise<Shop> {
  return (await apiGet<{ shop: Shop }>(`shops/${id}`, opts)).shop;
}

/** Owner view, signed in (Edit shop prefill). */
export async function getMyShop(id: number): Promise<Shop> {
  return (await meRequest<{ shop: Shop }>(`shops/${id}`)).shop;
}

export async function getMyShops(): Promise<Shop[]> {
  return (await meRequest<{ shops: Shop[] }>("my/shops?page[size]=20")).shops ?? [];
}

const SNAKE: Record<string, string> = {
  categoryId: "category_id",
  addressLine: "address_line",
  phonePublic: "phone_public",
};

function toForm(input: Partial<ShopInput>): FormData {
  const form = new FormData();
  const { logo, cover, hours, ...fields } = input;
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    form.append(`shop[${SNAKE[key] ?? key}]`, value === null ? "" : String(value));
  }
  if (hours !== undefined) form.append("shop[hours]", JSON.stringify(hours));
  if (logo) form.append("shop[logo]", logo, "logo.jpg");
  if (cover) form.append("shop[cover]", cover, "cover.jpg");
  return form;
}

export async function createShop(input: ShopInput): Promise<Shop> {
  return (await meRequest<{ shop: Shop }>("shops", { form: toForm(input) })).shop;
}

export async function updateShop(id: number, input: Partial<ShopInput>): Promise<Shop> {
  return (await meRequest<{ shop: Shop }>(`shops/${id}`, { method: "PATCH", form: toForm(input) })).shop;
}

/** SHOP-MEDIA: set (or replace) the shop's video — the listing video's wire (me.ts putVideo). */
export function uploadShopVideo(
  id: number,
  video: VideoUpload,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<Shop> {
  return putVideo(`shops/${id}/video`, video, onProgress, signal).then((data) => (data as { shop: Shop }).shop);
}

export async function deleteShopVideo(id: number): Promise<Shop> {
  return (await meRequest<{ shop: Shop }>(`shops/${id}/video`, { method: "DELETE" })).shop;
}

/** SHOP-MEDIA: the gallery in one save — kept ids in order, then new photos. A photo left out is deleted. */
export async function updateShopGallery(id: number, keepIds: string[], files: File[]): Promise<Shop> {
  const form = new FormData();
  for (const keep of keepIds) form.append("gallery[keep_ids][]", keep);
  for (const file of files) form.append("gallery[photos][]", file);
  // An emptied gallery still sends the field: no keep_ids means "keep none".
  if (keepIds.length === 0 && files.length === 0) form.append("gallery[keep_ids][]", "");
  return (await meRequest<{ shop: Shop }>(`shops/${id}/gallery`, { method: "PUT", form })).shop;
}

export async function moveListingsToShop(id: number, listingIds: number[]): Promise<number> {
  return (await meRequest<{ moved: number }>(`shops/${id}/move_listings`, { json: { listingIds, to: "shop" } })).moved;
}

/** Who the user sells as (null = Me). Answers the fresh `me`. */
export async function sellAs<T>(shopId: number | null): Promise<T> {
  return (await meRequest<{ user: T }>("users/me/selling_as", { method: "PATCH", json: { shopId } })).user;
}
