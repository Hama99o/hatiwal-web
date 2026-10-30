/**
 * "0:07", "2:00" — a voice message's clock. Western digits in every locale and
 * always laid out left to right (callers wrap it in `dir="ltr"`), like the
 * other chat apps do in Pashto and Dari, so "0:07 / 2:00" never reads backwards.
 * A running clock counts whole seconds ("floor"): showing "0:01" after 0.6 s
 * and then refusing the clip as under a second would contradict itself.
 */
export function voiceClock(ms: number, mode: "round" | "floor" = "round"): string {
  const total = Math.max(0, (mode === "floor" ? Math.floor : Math.round)(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** The longest voice message (the API allows 2 s of slack beyond it). */
export const VOICE_MAX_MS = 120_000;
/** The shortest one the API keeps. */
export const VOICE_MIN_MS = 1_000;
/** Bars in every waveform: the server sends 64, the recorder's preview makes 64. */
export const VOICE_BARS = 64;

/** `levels` (any length, 0–100) squeezed or stretched into `bars` values. */
export function resampleLevels(levels: number[], bars = VOICE_BARS): number[] {
  if (levels.length === 0) return Array.from({ length: bars }, () => 0);
  return Array.from({ length: bars }, (_, i) => {
    const from = Math.floor((i * levels.length) / bars);
    const to = Math.max(from + 1, Math.floor(((i + 1) * levels.length) / bars));
    const slice = levels.slice(from, to);
    return Math.round(Math.max(...slice));
  });
}
