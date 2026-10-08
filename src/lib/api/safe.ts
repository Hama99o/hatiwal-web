import { ApiError } from "./client";

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

/**
 * For a RESOURCE page (listing, shop, seller): the fallback (→ `notFound()`)
 * only when Rails said the thing is not there (404); any other failure — a 500,
 * Rails unreachable — is rethrown to the route's error boundary, which offers
 * Retry. `safe` turned a 500 into "404 — no results", telling the reader a
 * listing they could open a minute later did not exist (error sweep, 1.1.6).
 */
export async function unlessNotFound<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return fallback;
    throw e;
  }
}
