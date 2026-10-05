/**
 * SHOP-1 opening hours (docs/SHOPS.md "When are you open?" + shop page).
 *
 * Wire format (hatiwal-api Shop#hours, qa/api_contract/SHOPS_2026-10.md):
 *   { sat: [["08:00","18:00"]], fri: [], … }
 *   - days sat sun mon tue wed thu fri (the Afghan week starts on Saturday);
 *   - each a list of [from, to] "HH:MM" pairs with from < to (no overnight);
 *   - [] = closed that day, a missing day = not stated, {} = no hours at all.
 *
 * "Open now" is computed here, on the device clock (spec: device time zone,
 * Asia/Kabul for AF). Pure, no React. Identical port of
 * hatiwal-mobile src/lib/shopHours.ts (keep them identical).
 */
export const SHOP_DAYS = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"] as const;
export type ShopDay = (typeof SHOP_DAYS)[number];
export type TimeRange = [string, string];
export type ShopHours = Partial<Record<ShopDay, TimeRange[]>>;

/** JS Date#getDay() (0 = Sunday) → our day key. */
const BY_JS_DAY: ShopDay[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function dayOf(date: Date): ShopDay {
  return BY_JS_DAY[date.getDay()];
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export function isValidRange(range: TimeRange): boolean {
  return TIME.test(range[0]) && TIME.test(range[1]) && minutes(range[0]) < minutes(range[1]);
}

/** Every stated range well-formed (mirrors Shop#hours_well_formed). */
export function hoursAreValid(hours: ShopHours): boolean {
  return Object.entries(hours).every(
    ([day, ranges]) => (SHOP_DAYS as readonly string[]).includes(day) && Array.isArray(ranges) && ranges.every(isValidRange)
  );
}

export const hasHours = (hours: ShopHours | null | undefined) => !!hours && Object.keys(hours).length > 0;

export type OpenStatus =
  | { state: "unknown" }
  | { state: "open"; until: string }
  | { state: "closed"; opensAt: { day: ShopDay; time: string; today: boolean } | null };

/** Open now / closed now (and when it next opens) at `now`. */
export function openStatus(hours: ShopHours | null | undefined, now: Date = new Date()): OpenStatus {
  if (!hasHours(hours)) return { state: "unknown" };
  const today = dayOf(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  for (const [from, to] of hours![today] ?? []) {
    if (minutes(from) <= nowMin && nowMin < minutes(to)) return { state: "open", until: to };
  }

  // Next opening: later today, then the following 6 days.
  const laterToday = (hours![today] ?? []).filter(([from]) => minutes(from) > nowMin).sort((a, b) => minutes(a[0]) - minutes(b[0]));
  if (laterToday.length) return { state: "closed", opensAt: { day: today, time: laterToday[0][0], today: true } };
  const start = SHOP_DAYS.indexOf(today);
  for (let i = 1; i <= 7; i++) {
    const day = SHOP_DAYS[(start + i) % 7];
    const ranges = hours![day] ?? [];
    if (ranges.length) {
      const first = [...ranges].sort((a, b) => minutes(a[0]) - minutes(b[0]))[0];
      return { state: "closed", opensAt: { day, time: first[0], today: false } };
    }
  }
  return { state: "closed", opensAt: null };
}

// ── Presets (spec: presets first) ────────────────────────────────────────────

export type HoursPreset = "everyDay" | "satThu" | "custom";

export function presetHours(preset: Exclude<HoursPreset, "custom">): ShopHours {
  if (preset === "everyDay") {
    return Object.fromEntries(SHOP_DAYS.map((d) => [d, [["08:00", "20:00"]]])) as ShopHours;
  }
  const hours = Object.fromEntries(SHOP_DAYS.map((d) => [d, [["08:00", "18:00"]]])) as ShopHours;
  hours.fri = [];
  return hours;
}

/** Which preset these hours are, if any (so Edit shop re-selects it). */
export function detectPreset(hours: ShopHours): HoursPreset | null {
  if (!hasHours(hours)) return null;
  const same = (a: ShopHours, b: ShopHours) => JSON.stringify(SHOP_DAYS.map((d) => a[d] ?? null)) === JSON.stringify(SHOP_DAYS.map((d) => b[d] ?? null));
  if (same(hours, presetHours("everyDay"))) return "everyDay";
  if (same(hours, presetHours("satThu"))) return "satThu";
  return "custom";
}
