import { localizeDigits } from "./format";
/**
 * SHOP-1 opening hours (docs/SHOPS.md "When are you open?" + shop page).
 *
 * Wire format (hatiwal-api Shop#hours, qa/api_contract/SHOPS_2026-10.md):
 *   { sat: [["08:00","18:00"]], fri: [], … }
 *   - days sat sun mon tue wed thu fri (the Afghan week starts on Saturday);
 *   - each a list of [from, to] "HH:MM" pairs; to < from = closes after
 *     midnight (18:00–02:00 on fri = fri 18:00 → sat 02:00); from == to is invalid;
 *   - [] = closed that day, a missing day = not stated, {} = no hours at all.
 *
 * "Open now" comes from the SERVER when it sends it (shop.open_now +
 * next_change_at, computed in Asia/Kabul — shopOpenStatus below); the device
 * clock is only the fallback for an older API. Pure, no React. Identical port of
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
  return TIME.test(range[0]) && TIME.test(range[1]) && minutes(range[0]) !== minutes(range[1]);
}

/** Closes after midnight (18:00–02:00). */
export const isOvernight = (range: TimeRange) => minutes(range[1]) < minutes(range[0]);

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
  const yesterday = SHOP_DAYS[(SHOP_DAYS.indexOf(today) + 6) % 7];

  // Still open from last night's overnight range?
  for (const range of hours![yesterday] ?? []) {
    if (isOvernight(range) && nowMin < minutes(range[1])) return { state: "open", until: range[1] };
  }
  for (const range of hours![today] ?? []) {
    const [from, to] = range;
    if (isOvernight(range) ? nowMin >= minutes(from) : minutes(from) <= nowMin && nowMin < minutes(to)) {
      return { state: "open", until: to };
    }
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

// ── Server-computed status (Asia/Kabul) ─────────────────────────────────────

/**
 * The zones a shop can be in (API `time_zone`), as fixed UTC offsets: neither
 * observes daylight saving. Unknown → Kabul.
 */
const ZONE_OFFSET_MIN: Record<string, number> = { "Asia/Kabul": 270, "Asia/Karachi": 300 };

function zoneParts(date: Date, timeZone?: string | null): { day: ShopDay; hhmm: string; dateKey: string } {
  const offset = ZONE_OFFSET_MIN[timeZone ?? ""] ?? ZONE_OFFSET_MIN["Asia/Kabul"];
  const k = new Date(date.getTime() + offset * 60_000);
  const hh = String(k.getUTCHours()).padStart(2, "0");
  const mm = String(k.getUTCMinutes()).padStart(2, "0");
  return { day: BY_JS_DAY[k.getUTCDay()], hhmm: `${hh}:${mm}`, dateKey: k.toISOString().slice(0, 10) };
}

/**
 * The status from the API's `open_now` + `next_change_at` (computed in the
 * shop's own zone, `time_zone`: Asia/Kabul, or Asia/Karachi in Pakistan). Times
 * are shown in that zone, so a shop page reads the same on every phone and on
 * the server-rendered web page.
 */
export function openStatusFromServer(
  openNow: boolean | null,
  nextChangeAt: string | null,
  now: Date = new Date(),
  timeZone?: string | null
): OpenStatus {
  if (openNow === null) return { state: "unknown" };
  const next = nextChangeAt ? new Date(nextChangeAt) : null;
  if (next && Number.isNaN(next.getTime())) return openNow ? { state: "open", until: "" } : { state: "closed", opensAt: null };
  if (openNow) return { state: "open", until: next ? zoneParts(next, timeZone).hhmm : "" };
  if (!next) return { state: "closed", opensAt: null };
  const at = zoneParts(next, timeZone);
  return { state: "closed", opensAt: { day: at.day, time: at.hhmm, today: at.dateKey === zoneParts(now, timeZone).dateKey } };
}

/** Prefer the server's status; fall back to the device clock on an older API. */
export function shopOpenStatus(
  shop: { hours?: ShopHours | null; openNow?: boolean | null; nextChangeAt?: string | null; timeZone?: string | null },
  now: Date = new Date()
): OpenStatus {
  if (shop.openNow !== undefined) return openStatusFromServer(shop.openNow, shop.nextChangeAt ?? null, now, shop.timeZone);
  return openStatus(shop.hours, now);
}

/**
 * "Open now · until 20:00" / "Opens at 08:00" / "Opens Sat 08:00" / "Closed
 * now", translated (a `shops`-namespace t) — or null when no hours were given.
 * One wording for the page's line and the share text (owner, 2026-10-08).
 */
export function shopOpenText(
  shop: Parameters<typeof shopOpenStatus>[0],
  t: (key: string, values?: Record<string, string | number>) => string,
  locale = "en",
): { open: boolean; text: string } | null {
  const status = shopOpenStatus(shop);
  if (status.state === "unknown") return null;
  // "08:00" in the reader's digits ("۰۸:۰۰" on /ps and /fa; design QA 1.1.6).
  const time = (hhmm: string) => localizeDigits(hhmm, locale);
  if (status.state === "open") return { open: true, text: t("openUntil", { time: time(status.until) }) };
  const text = status.opensAt
    ? status.opensAt.today
      ? t("opensAt", { time: time(status.opensAt.time) })
      : t("opensOn", { day: t(`days.${status.opensAt.day}`), time: time(status.opensAt.time) })
    : t("closedNow");
  return { open: false, text };
}
