/**
 * Chat day-grouping helper (WEB D2-READ).
 *
 * A conversation thread shows a day separator before the first message of each
 * new calendar day. Grouping must use the VIEWER'S LOCAL day — slicing the ISO
 * string would group by UTC and put a 01:30 local message on the previous day
 * for any timezone east of UTC (Afghanistan is UTC+4:30, so this is the common
 * case, not an edge case).
 *
 * One implementation, imported by the thread and by its E2E spec, so the
 * separator logic can never drift between the two.
 */

/**
 * Local calendar day of `iso` as `YYYY-MM-DD`. Two messages share a separator
 * group exactly when their keys are equal. Returns "" for a missing/invalid
 * date (matching `formatDate`/`formatTime`), which groups undated messages
 * together instead of emitting a separator with no label.
 */
export function dayKey(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
