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
    /**
     * Rails' OWN reasons for the failure, verbatim — `render_unprocessable_entity`
     * answers `{ errors: [...full_messages] }` (and other handlers `{ error }`).
     * A caller cannot tell "you already reported this" from "you can't report
     * yourself" out of the status alone: both are 422. Mobile reads exactly this
     * array off axios (`error.response.data.errors`) to pick which translated
     * message to show, so keeping it here is what lets the two clients explain
     * the same failure the same way. Empty when the body carried no reason.
     */
    public errors: string[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Pull Rails' error reasons out of a failed response body, tolerating every
 * shape the API uses (`{ errors: [...] }`, `{ error: "..." }`) and an empty or
 * non-JSON body. Never throws — a failed parse just means "no reason given".
 */
export async function readApiErrors(res: Response): Promise<string[]> {
  try {
    const text = await res.text();
    if (!text) return [];
    const body: unknown = JSON.parse(text);
    if (!body || typeof body !== "object") return [];
    const { errors, error } = body as { errors?: unknown; error?: unknown };
    if (Array.isArray(errors)) return errors.map(String);
    if (typeof errors === "string") return [errors];
    if (typeof error === "string") return [error];
    return [];
  } catch {
    return [];
  }
}

export type QueryParams = Record<
  string,
  string | number | boolean | null | undefined
>;

/**
 * Serialize a param bag to a `?a=1&b=2` string, dropping empty values.
 *
 * Exported because the AUTHED variant of a public GET has to build the exact
 * same querystring and then send it through a different transport (the /api/me
 * proxy — see `getListingsAsViewer`). Two copies of this mapping would drift.
 */
export function buildQuery(params?: QueryParams): string {
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
