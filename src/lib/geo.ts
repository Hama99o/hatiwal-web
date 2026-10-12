// The self-hosted basemap (map.hatiwal.com) carries vector tiles for
// Afghanistan, Pakistan and Iran — a tile outside that area comes back empty
// (HTTP 204), so the map paints blank. Rather than show a blank box for an
// out-of-area point (e.g. a diaspora user who taps "use my location" from
// abroad), callers check this and render a fallback instead.
//
// WIDENED 2026-09-13, and the ORDER mattered: the owner reported the map
// showing nothing for Pakistan, and the cause was the TILESET, not this box.
// Widening here first would only have replaced an honest fallback with a blank
// map. The AF+PK+IR tileset (862 MB, zoom 0-14) was built and deployed first;
// this now matches the `bounds` those tiles and all 8 styles declare.
//
// Iran is inside the box deliberately — supported TECHNICALLY, with no
// user-facing copy naming it. That is why the western edge is 44.0 and not the
// ~60.3 an Afghanistan-and-Pakistan box would need.
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
