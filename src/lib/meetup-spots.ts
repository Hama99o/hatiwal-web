import type { MeetupSpot } from "./api/meetup-spots";

/**
 * IDEA-6 (hatiwal-mobile docs/design/SAFE_MEETUP_SPOTS.md): the spots to
 * suggest — within 25 km of the listing, nearest first, at most 6 — and in
 * which language. Same rules as mobile's src/lib/meetupSpots.ts.
 */
export const SPOTS_RADIUS_KM = 25;
export const SPOTS_MAX = 6;

type Point = { latitude: number; longitude: number };

function km(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function spotsNear(spots: MeetupSpot[] | undefined, point: Point | null): MeetupSpot[] {
  if (!spots || !point) return [];
  return spots
    .map((s) => ({ s, d: km(point, s) }))
    .filter(({ d }) => d <= SPOTS_RADIUS_KM)
    .sort((a, b) => a.d - b.d)
    .slice(0, SPOTS_MAX)
    .map(({ s }) => s);
}

/** The user's language, then Dari, then English; Urdu falls back to English. */
export function spotName(spot: MeetupSpot, locale: string): string {
  if (locale === "ur") return spot.nameUr || spot.nameEn;
  const own = locale === "ps" ? spot.namePs : locale === "fa" ? spot.nameFa : spot.nameEn;
  return own || spot.nameFa || spot.nameEn;
}
