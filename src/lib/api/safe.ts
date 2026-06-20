/**
 * Resolve a fetch, falling back to a default if it throws. Used by ISR pages so a
 * transient API outage at build/revalidate renders an empty state instead of
 * crashing the page. The next revalidation backfills real data.
 */
export async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}
