/**
 * Single source for environment-derived URLs, so port/host changes can't drift
 * between the layout, sitemap, robots, API client, and proxy route.
 */

/** Public site origin (canonical/OG/sitemap). */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3011";

/** Rails API base used server-side (RSC/ISR) — direct, no proxy. */
export const RAILS_SERVER_BASE =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3007/api/v1";

/** Same-origin proxy base used in the browser (CORS-free). */
export const PROXY_BASE = "/api/proxy";

/**
 * Browser-reachable Rails origin. Rails bakes the request Host into Active Storage
 * image/avatar URLs, so when the server fetches Rails via an internal address
 * (e.g. the docker0 gateway 172.17.0.1), those urls aren't loadable by the browser.
 * We rewrite that internal origin → this public one in responses. Default localhost
 * (correct for Docker-on-host and a no-op for plain local dev).
 */
export const RAILS_PUBLIC_ORIGIN =
  process.env.NEXT_PUBLIC_RAILS_ORIGIN || "http://localhost:3007";

function originOf(u: string): string {
  try {
    return new URL(u).origin;
  } catch {
    return "";
  }
}

const INTERNAL_RAILS_ORIGIN = originOf(RAILS_SERVER_BASE);
const PUBLIC_RAILS_ORIGIN = originOf(RAILS_PUBLIC_ORIGIN);

/** Replace the internal Rails origin with the browser-reachable one in a response body. */
export function rewriteRailsHost(text: string): string {
  if (
    !text ||
    !INTERNAL_RAILS_ORIGIN ||
    !PUBLIC_RAILS_ORIGIN ||
    INTERNAL_RAILS_ORIGIN === PUBLIC_RAILS_ORIGIN
  ) {
    return text;
  }
  return text.split(INTERNAL_RAILS_ORIGIN).join(PUBLIC_RAILS_ORIGIN);
}
