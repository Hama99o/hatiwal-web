/**
 * Stays — hotel rooms, guest houses, B&B, short-stay apartments
 * (hatiwal-api docs/STAYS_DESIGN.md). One place for what makes a listing a stay
 * and how its extra facts read, so the form, the listing page, the cards and
 * the bazaar filters never hard-code a category slug. Mirrors hatiwal-mobile
 * src/lib/stays.ts (same keys, same rules).
 *
 * The API marks every category with `kind` ("item" | "stay"; a subcategory
 * carries its parent's). An older API sends no kind: everything is an item.
 */
import type { LucideIcon } from "lucide-react";
import { Car, Coffee, Droplets, Flame, Snowflake, Tv, Users, Utensils, Wifi, Zap } from "lucide-react";

export type PriceUnit = "night" | "month";

export const STAY_AMENITIES = [
  "wifi",
  "heating",
  "ac",
  "hot_water",
  "parking",
  "breakfast",
  "kitchen",
  "tv",
  "power_backup",
  "family_only",
] as const;
export type StayAmenity = (typeof STAY_AMENITIES)[number];

export const AMENITY_ICONS: Record<StayAmenity, LucideIcon> = {
  wifi: Wifi,
  heating: Flame,
  ac: Snowflake,
  hot_water: Droplets,
  parking: Car,
  breakfast: Coffee,
  kitchen: Utensils,
  tv: Tv,
  power_backup: Zap,
  family_only: Users,
};

/** A stay's facts as the client holds them (keys camel-cased on ingest). */
export interface StayDetails {
  guests?: number;
  beds?: number;
  bathroom?: "private" | "shared";
  amenities?: StayAmenity[];
  checkIn?: string;
  checkOut?: string;
}

export const STAY_LIMITS = { guests: { min: 1, max: 50 }, beds: { min: 0, max: 50 } } as const;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

type WithKind = { kind?: string | null } | null | undefined;

export function isStayCategory(category: WithKind): boolean {
  return category?.kind === "stay";
}

type CategoryNode = { id: number; kind?: string | null; subcategories?: CategoryNode[] };

/** Finds a category by id anywhere in a tree (roots and their subcategories). */
export function findCategory<T extends CategoryNode>(tree: T[] | undefined, id: number | null | undefined): T | undefined {
  if (!tree || id == null) return undefined;
  for (const root of tree) {
    if (root.id === id) return root;
    const child = root.subcategories?.find((c) => c.id === id);
    if (child) return child as T;
  }
  return undefined;
}

export function isStayCategoryId(tree: CategoryNode[] | undefined, id: number | null | undefined): boolean {
  return isStayCategory(findCategory(tree, id));
}

export function isStayAmenity(value: string): value is StayAmenity {
  return (STAY_AMENITIES as readonly string[]).includes(value);
}

/**
 * A stay's details as the API sent them, safe to read: anything but a plain
 * object (null, a string, an array) is `{}`, so a malformed payload renders as
 * a room with no facts instead of crashing the page (security review, dd).
 */
export function asStayDetails(raw: unknown): StayDetails {
  return raw != null && typeof raw === "object" && !Array.isArray(raw) ? (raw as StayDetails) : {};
}

/** The known amenities of a stay, in order — [] unless `amenities` is a real array. */
export function stayAmenities(details: StayDetails | null | undefined): StayAmenity[] {
  const raw: unknown = asStayDetails(details).amenities;
  return Array.isArray(raw) ? raw.filter((a): a is StayAmenity => typeof a === "string" && isStayAmenity(a)) : [];
}

/** A check-in / check-out value, only when it is a string. */
export function stayTime(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

/** Only what the server accepts: counts in range, known amenities, HH:MM times. */
export function cleanStayDetails(input: StayDetails): StayDetails {
  const details = asStayDetails(input);
  const out: StayDetails = {};
  const count = (v: unknown, min: number, max: number) =>
    typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : undefined;
  const guests = count(details.guests, STAY_LIMITS.guests.min, STAY_LIMITS.guests.max);
  if (guests != null) out.guests = guests;
  const beds = count(details.beds, STAY_LIMITS.beds.min, STAY_LIMITS.beds.max);
  if (beds != null) out.beds = beds;
  if (details.bathroom === "private" || details.bathroom === "shared") out.bathroom = details.bathroom;
  const amenities = stayAmenities(details);
  if (amenities.length) out.amenities = Array.from(new Set(amenities));
  const checkIn = stayTime(details.checkIn);
  const checkOut = stayTime(details.checkOut);
  if (checkIn && TIME_PATTERN.test(checkIn)) out.checkIn = checkIn;
  if (checkOut && TIME_PATTERN.test(checkOut)) out.checkOut = checkOut;
  return out;
}

/**
 * The multipart fields for a stay's details (snake_case, Rails nested params).
 * Always at least one field: the API replaces the whole details hash when it is
 * present, so clearing every fact on edit really clears them (a blank amenity
 * is dropped server-side).
 */
export function stayDetailsFormFields(details: StayDetails): [string, string][] {
  const clean = cleanStayDetails(details);
  const fields: [string, string][] = [];
  if (clean.guests != null) fields.push(["listing[details][guests]", String(clean.guests)]);
  if (clean.beds != null) fields.push(["listing[details][beds]", String(clean.beds)]);
  if (clean.bathroom) fields.push(["listing[details][bathroom]", clean.bathroom]);
  for (const a of clean.amenities ?? []) fields.push(["listing[details][amenities][]", a]);
  if (!clean.amenities?.length) fields.push(["listing[details][amenities][]", ""]);
  if (clean.checkIn) fields.push(["listing[details][check_in]", clean.checkIn]);
  if (clean.checkOut) fields.push(["listing[details][check_out]", clean.checkOut]);
  return fields;
}

/** i18n key of a price unit suffix ("/ night"), or null for a total price. */
export function priceUnitKey(unit: PriceUnit | null | undefined): string | null {
  if (unit === "night") return "listing.stays.perNight";
  if (unit === "month") return "listing.stays.perMonth";
  return null;
}
