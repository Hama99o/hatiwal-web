import { convertKeysToCamel } from "./case";
import { PROXY_BASE, RAILS_SERVER_BASE, rewriteRailsHost } from "../env";

/**
 * Isomorphic API access to the Rails backend.
 *
 * - On the SERVER (RSC / ISR): fetch Rails directly via RAILS_SERVER_BASE (no CORS, fast).
 * - In the BROWSER: fetch the same-origin proxy at /api/proxy/* which forwards to
 *   Rails. This avoids CORS entirely and keeps the Rails URL server-side.
 *
 * Mobile and web hit the SAME endpoints — never add a Next route handler for data.
 */

function apiBase(): string {
  return typeof window === "undefined" ? RAILS_SERVER_BASE : PROXY_BASE;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type QueryParams = Record<
  string,
  string | number | boolean | null | undefined
>;

function buildQuery(params?: QueryParams): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    sp.append(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

interface FetchOptions {
  params?: QueryParams;
  /** ISR window in seconds (server only; ignored in the browser). */
  revalidate?: number;
}

export async function apiGet<T>(
  path: string,
  { params, revalidate }: FetchOptions = {},
): Promise<T> {
  const url = `${apiBase()}/${path}${buildQuery(params)}`;

  const init: RequestInit & { next?: { revalidate: number } } = {
    headers: { Accept: "application/json" },
  };
  if (typeof window === "undefined" && revalidate !== undefined) {
    init.next = { revalidate };
  }

  const res = await fetch(url, init);
  if (!res.ok) {
    throw new ApiError(res.status, `GET ${path} failed (${res.status})`);
  }
  const text = await res.text();
  const json: unknown = text ? JSON.parse(rewriteRailsHost(text)) : null;
  return convertKeysToCamel<T>(json);
}
