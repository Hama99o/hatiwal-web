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
