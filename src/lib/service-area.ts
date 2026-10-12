// The countries Hatiwal serves: Afghanistan, Pakistan and Iran. A location
// outside them is never used as a default; Kabul is used instead (owner's rule,
// 2026-10-05; hatiwal-mobile/docs/USER_LOCATION.md).
//
// A PORT of hatiwal-mobile/src/lib/serviceArea.ts (and of hatiwal-api's
// app/models/service_area.rb): the same hand-traced outline, point for point,
// and the same ~13 km margin. Change all three together, never one.
//
// Not to be confused with SERVICE_AREA_BOUNDS in ./geo.ts, which is the
// RECTANGLE the basemap has tiles for. This is the stricter test of whether a
// point is in a country we serve (Dubai is inside the tile box, not in here).
const OUTLINE: ReadonlyArray<readonly [number, number]> = [
  // [longitude, latitude], clockwise from Iran's north-west corner.
  [44.0, 39.4], [45.0, 39.7], [46.5, 38.9], [48.0, 38.4], [48.9, 38.4],
  [49.0, 37.6], [50.5, 37.0], [53.9, 36.9], [54.0, 37.4], [55.4, 38.1],
  [57.3, 38.2], [59.6, 37.1], [61.1, 36.6], [61.3, 35.6], [62.3, 35.3],
  [63.1, 35.9], [64.5, 36.3], [65.6, 37.4], [66.5, 37.4], [67.8, 37.2],
  [68.9, 37.3], [70.2, 37.6], [71.5, 37.9], [72.6, 37.0], [74.9, 37.4],
  [75.7, 36.7], [77.0, 35.6], [77.8, 35.5], [76.0, 34.6], [74.0, 34.4],
  [74.6, 33.0], [75.4, 32.3], [74.95, 31.95], [74.57, 31.6], [74.55, 31.1], [73.9, 30.0], [72.9, 29.0],
  [71.9, 27.9], [70.6, 27.7], [70.3, 26.5], [70.0, 25.7], [70.9, 24.3],
  [68.8, 23.8], [67.0, 24.8], [66.6, 25.4], [64.0, 25.2], [62.3, 25.0], [61.6, 25.0],
  [60.5, 25.3], [59.0, 25.4], [57.3, 25.8], [56.3, 27.0], [54.0, 26.5],
  [52.5, 27.4], [51.4, 27.9], [50.3, 29.2], [49.0, 30.0], [48.4, 30.0],
  [48.0, 30.5], [47.7, 31.0], [47.4, 32.4], [46.1, 33.0], [45.4, 33.9],
  [45.5, 34.8], [46.1, 35.2], [45.4, 35.9], [44.8, 37.2], [44.3, 38.4],
];

const MARGIN_DEG = 0.12;

function insideOutline(lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = OUTLINE.length - 1; i < OUTLINE.length; j = i++) {
    const [xi, yi] = OUTLINE[i];
    const [xj, yj] = OUTLINE[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distanceToOutline(lng: number, lat: number): number {
  let best = Infinity;
  for (let i = 0, j = OUTLINE.length - 1; i < OUTLINE.length; j = i++) {
    const [ax, ay] = OUTLINE[j];
    const [bx, by] = OUTLINE[i];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((lng - ax) * dx + (lat - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(lng - (ax + t * dx), lat - (ay + t * dy)));
  }
  return best;
}

/** True when the point is in Afghanistan, Pakistan or Iran (or within ~13 km of their border). */
export function isInServiceArea(c: { latitude: number; longitude: number } | null | undefined): boolean {
  if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return false;
  return insideOutline(c.longitude, c.latitude) || distanceToOutline(c.longitude, c.latitude) <= MARGIN_DEG;
}
