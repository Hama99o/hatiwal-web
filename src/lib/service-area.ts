// The countries Hatiwal serves: Afghanistan and Pakistan (1.1.7, owner). A
// location outside them is never used as a default; Kabul is used instead
// (owner's rule, 2026-10-05; hatiwal-mobile/docs/USER_LOCATION.md).
//
// A PORT of hatiwal-mobile/src/lib/serviceArea.ts (and of hatiwal-api's
// app/models/service_area.rb): the same hand-traced outline, point for point,
// and the same ~13 km margin, so border towns on our side (Islam Qala, Zaranj,
// Taftan, Torkham, Chaman…) stay inside. Change all three together, never one.
//
// Not to be confused with SERVICE_AREA_BOUNDS in ./geo.ts, which is the
// RECTANGLE the basemap has tiles for. This is the stricter test of whether a
// point is in a country we serve (Dubai is inside the tile box, not in here).
const OUTLINE: ReadonlyArray<readonly [number, number]> = [
  // [longitude, latitude], clockwise from Afghanistan's north-west corner.
  [61.3, 35.6], [62.3, 35.3], [63.1, 35.9], [64.5, 36.3], [65.6, 37.4],
  [66.5, 37.4], [67.8, 37.2], [68.9, 37.3], [70.2, 37.6], [71.5, 37.9],
  [72.6, 37.0], [74.9, 37.4], [75.7, 36.7], [77.0, 35.6], [77.8, 35.5],
  [76.0, 34.6], [74.0, 34.4], [74.6, 33.0], [75.4, 32.3], [74.95, 31.95],
  [74.57, 31.6], [74.55, 31.1], [73.9, 30.0], [72.9, 29.0], [71.9, 27.9],
  [70.6, 27.7], [70.3, 26.5], [70.0, 25.7], [70.9, 24.3], [68.8, 23.8],
  [67.0, 24.8], [66.6, 25.4], [64.0, 25.2], [62.3, 25.0], [61.6, 25.0],
  // Pakistan's western border, north from Gwadar Bay to the three-country point…
  [61.65, 25.6], [61.8, 26.2], [62.3, 26.5], [63.2, 26.6], [63.3, 27.1],
  [62.8, 27.3], [62.8, 28.2], [61.9, 28.6], [61.5, 29.0], [60.87, 29.86],
  // …then Afghanistan's western border, north past Zaranj and Islam Qala.
  [61.6, 30.55], [61.75, 31.0], [61.65, 31.4], [60.85, 31.5], [60.85, 32.2],
  [60.6, 33.1], [60.95, 33.6], [60.9, 34.1], [61.0, 34.6], [61.1, 35.1],
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

/** True when the point is in Afghanistan or Pakistan (or within ~13 km of their border). */
export function isInServiceArea(c: { latitude: number; longitude: number } | null | undefined): boolean {
  if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return false;
  return insideOutline(c.longitude, c.latitude) || distanceToOutline(c.longitude, c.latitude) <= MARGIN_DEG;
}
