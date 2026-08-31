// The self-hosted basemap (map.hatiwal.com) only carries Afghanistan vector
// tiles — a tile outside the country comes back empty (HTTP 204), so the map
// paints blank. Rather than show a blank box for an out-of-country point (e.g.
// a diaspora user who taps "use my location" from abroad), callers check this
// and render a fallback instead.
//
// Generous bounding box (includes border areas), matching the Afghanistan
// scope the Nominatim place search uses (countrycodes=af).
export const AFGHANISTAN_BOUNDS = {
  minLat: 29.0,
  maxLat: 38.8,
  minLng: 60.3,
  maxLng: 75.2,
} as const;

/** True when a point falls inside Afghanistan's bounding box. */
export function isInAfghanistan(lat: number, lng: number): boolean {
  return (
    lat >= AFGHANISTAN_BOUNDS.minLat &&
    lat <= AFGHANISTAN_BOUNDS.maxLat &&
    lng >= AFGHANISTAN_BOUNDS.minLng &&
    lng <= AFGHANISTAN_BOUNDS.maxLng
  );
}
