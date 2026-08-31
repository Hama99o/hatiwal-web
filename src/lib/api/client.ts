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
    /**
     * Rails' MACHINE-READABLE reason for a 422, when it sent one
     * (`render_unprocessable_entity(record, code: ...)` → `body.code`).
     *
     * This is the field a user-facing message must be chosen from. `errors`
     * above is English prose built by ActiveModel and is NEVER safe to render:
     * a Pashto or Dari seller would be shown an English sentence, which is how
     * "the user did not see this error, it said server error" happened. Map the
     * code to a localized string with `errorCodeMessageKey` and keep `errors`
     * for logs and for the pre-code fallback only.
     *
     * Undefined for every failure Rails did not tag — including most 422s.
     */
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Pull Rails' failure detail out of a response body: its human-readable reasons
 * AND its machine-readable `code`, tolerating every shape the API uses
 * (`{ errors: [...] }`, `{ error: "..." }`, either with an optional `code`) plus
 * an empty or non-JSON body. Never throws — a failed parse just means "no
 * reason given".
 */
export async function readApiError(
  res: Response,
): Promise<{ errors: string[]; code?: string }> {
  try {
    const text = await res.text();
    if (!text) return { errors: [] };
    const body: unknown = JSON.parse(text);
    if (!body || typeof body !== "object") return { errors: [] };
    const {
      errors,
      error,
      code: rawCode,
    } = body as { errors?: unknown; error?: unknown; code?: unknown };
    const code = typeof rawCode === "string" && rawCode ? rawCode : undefined;
    if (Array.isArray(errors)) return { errors: errors.map(String), code };
    if (typeof errors === "string") return { errors: [errors], code };
    if (typeof error === "string") return { errors: [error], code };
    return { errors: [], code };
  } catch {
    return { errors: [] };
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
