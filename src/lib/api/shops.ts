import { apiGet } from "./client";
import { meRequest } from "./me";
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
  phone: string | null;
  listingsCount: number;
  verifiedAt: string | null;
  owner: { id: number; name: string };
  shareUrl: string | null;
  avgRating: number | null;
  reviewCount: number;
  status?: "active" | "suspended" | "pending" | "closed";
  phonePublic?: boolean;
  role?: "owner" | "manager" | "staff" | null;
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

export async function moveListingsToShop(id: number, listingIds: number[]): Promise<number> {
  return (await meRequest<{ moved: number }>(`shops/${id}/move_listings`, { json: { listingIds, to: "shop" } })).moved;
}

/** Who the user sells as (null = Me). Answers the fresh `me`. */
export async function sellAs<T>(shopId: number | null): Promise<T> {
  return (await meRequest<{ user: T }>("users/me/selling_as", { method: "PATCH", json: { shopId } })).user;
}
