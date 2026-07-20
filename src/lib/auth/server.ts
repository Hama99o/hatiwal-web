import { convertKeysToCamel } from "../api/case";
import { RAILS_SERVER_BASE, rewriteRailsHost } from "../env";
import type { User } from "../types";
import {
  deviseRequestHeaders,
  tokensFromResponse,
  type DeviseTokens,
} from "./devise";

/**
 * Result of probing Rails `/users/me`:
 * - `ok`           — valid session; carries the user + (possibly rotated) tokens.
 * - `unauthorized` — Rails said 401: the tokens are genuinely invalid, so it is
 *                    safe (and correct) to clear the cookies.
 * - `error`        — a TRANSIENT failure (5xx, network error, non-JSON body).
 *                    The tokens may still be perfectly valid, so callers MUST
 *                    NOT clear cookies — a backend hiccup must never log the
 *                    user out. Mirrors the authed proxy's 401-only clear.
 */
export type FetchMeResult =
  | { status: "ok"; user: User; tokens: DeviseTokens }
  | { status: "unauthorized" }
  | { status: "error" };

/**
 * Fetch the current user from Rails `/users/me` with the given tokens.
 * Distinguishes an explicit 401 from a transient failure so a backend blip
 * doesn't wipe a valid session (see FetchMeResult).
 */
export async function fetchMe(tokens: DeviseTokens): Promise<FetchMeResult> {
  let res: Response;
  try {
    res = await fetch(`${RAILS_SERVER_BASE}/users/me`, {
      headers: { Accept: "application/json", ...deviseRequestHeaders(tokens) },
      cache: "no-store",
    });
  } catch {
    return { status: "error" }; // network error — Rails unreachable, keep cookies
  }
  if (res.status === 401) return { status: "unauthorized" };
  if (!res.ok) return { status: "error" }; // 5xx/maintenance — keep cookies
  // Guard against a 2xx with a non-JSON body (proxy/maintenance page, etc.).
  const raw = await res.text().catch(() => "");
  let json: unknown = null;
  try {
    json = raw ? JSON.parse(rewriteRailsHost(raw)) : null;
  } catch {
    json = null;
  }
  if (!json) return { status: "error" };
  const { user } = convertKeysToCamel<{ user: User }>(json);
  return { status: "ok", user, tokens: tokensFromResponse(res) ?? tokens };
}
