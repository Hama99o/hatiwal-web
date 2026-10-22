import { getProvinceByValue, type Province } from "@/lib/provinces";

/**
 * City landing pages (/[locale]/cities/<slug>, docs/SEO.md): the five largest
 * cities of the provinces the apps offer, each one the CAPITAL of its province,
 * so its point is the province's own coordinates in src/lib/provinces.ts (the
 * same point a listing in that province is placed at). The page lists what is
 * for sale within CITY_RADIUS_KM of it and links to the Bazaar with the same
 * zone filter.
 *
 * Display names live in messages (`cities.names.<slug>`), not here.
 */
export const CITY_RADIUS_KM = 25;

const CITY_PROVINCES = {
  kabul: "Kabul",
  herat: "Herat",
  kandahar: "Kandahar",
  "mazar-i-sharif": "Balkh",
  jalalabad: "Nangarhar",
} as const;

export type CitySlug = keyof typeof CITY_PROVINCES;

export const CITY_SLUGS = Object.keys(CITY_PROVINCES) as CitySlug[];

export interface City {
  slug: CitySlug;
  province: Province;
}

export function getCity(slug: string): City | undefined {
  if (!Object.prototype.hasOwnProperty.call(CITY_PROVINCES, slug)) return undefined;
  const province = getProvinceByValue(CITY_PROVINCES[slug as CitySlug]);
  return province ? { slug: slug as CitySlug, province } : undefined;
}

/** The Bazaar filtered to this city's zone (filters.ts URL vocabulary). */
export function cityBazaarHref(city: City): string {
  const sp = new URLSearchParams({
    lat: String(city.province.lat),
    lng: String(city.province.lng),
    radius: String(CITY_RADIUS_KM),
  });
  return `/bazaar?${sp.toString()}`;
}
