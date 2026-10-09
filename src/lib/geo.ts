// The self-hosted basemap (map.hatiwal.com) carries vector tiles for
// Afghanistan, Pakistan and the region around them — a tile outside that area
// comes back empty (HTTP 204), so the map paints blank. Rather than show a blank
// box for an out-of-area point (e.g. a diaspora user who taps "use my location"
// from abroad), callers check this and render a fallback instead.
//
// WIDENED 2026-09-13, and the ORDER mattered: the owner reported the map
// showing nothing for Pakistan, and the cause was the TILESET, not this box.
// Widening here first would only have replaced an honest fallback with a blank
// map. The wider tileset (862 MB, zoom 0-14) was built and deployed first; this
// now matches the `bounds` those tiles and all 8 styles declare.
//
// This box is wider than the SERVICE area on purpose (western edge 44.0, not
// the ~60.3 an Afghanistan-and-Pakistan box would need): it follows the tiles.
// What counts as served is ./service-area.ts (Afghanistan + Pakistan since
// 1.1.7); shrinking this box means rebuilding the tiles and the styles first.
export const SERVICE_AREA_BOUNDS = {
  minLat: 23.6,
  maxLat: 39.8,
  minLng: 44.0,
  maxLng: 77.9,
} as const;

/** True when a point falls inside the area our basemap actually has tiles for. */
export function isInServiceArea(lat: number, lng: number): boolean {
  return (
    lat >= SERVICE_AREA_BOUNDS.minLat &&
    lat <= SERVICE_AREA_BOUNDS.maxLat &&
    lng >= SERVICE_AREA_BOUNDS.minLng &&
    lng <= SERVICE_AREA_BOUNDS.maxLng
  );
}
