import { convertKeysToCamel } from "../api/case";
import { RAILS_SERVER_BASE } from "../env";
import type { User } from "../types";
import {
  deviseRequestHeaders,
  tokensFromResponse,
  type DeviseTokens,
} from "./devise";

/**
 * Fetch the current user from Rails `/users/me` with the given tokens.
 * Returns the user plus the (possibly rotated) tokens to re-persist, or null
 * if the tokens are no longer valid.
 */
export async function fetchMe(
  tokens: DeviseTokens,
): Promise<{ user: User; tokens: DeviseTokens } | null> {
  const res = await fetch(`${RAILS_SERVER_BASE}/users/me`, {
    headers: { Accept: "application/json", ...deviseRequestHeaders(tokens) },
    cache: "no-store",
  });
  if (!res.ok) return null;
  // Guard against a 2xx with a non-JSON body (proxy/maintenance page, etc.).
  const json: unknown = await res.json().catch(() => null);
  if (!json) return null;
  const { user } = convertKeysToCamel<{ user: User }>(json);
  return { user, tokens: tokensFromResponse(res) ?? tokens };
}
