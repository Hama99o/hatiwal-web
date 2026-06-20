/**
 * devise_token_auth token plumbing. Rails rotates the access-token on (almost)
 * every request, so we always re-read the latest token from each Rails response
 * and persist it. token-type is always "Bearer".
 */

export const AUTH_COOKIES = {
  accessToken: "dta_access_token",
  client: "dta_client",
  uid: "dta_uid",
  expiry: "dta_expiry",
} as const;

export interface DeviseTokens {
  accessToken: string;
  client: string;
  uid: string;
  expiry?: string;
}

/** Pull rotated tokens out of a Rails fetch Response (null if none present). */
export function tokensFromResponse(res: Response): DeviseTokens | null {
  const accessToken = res.headers.get("access-token");
  const client = res.headers.get("client");
  const uid = res.headers.get("uid");
  if (!accessToken || !client || !uid) return null;
  return {
    accessToken,
    client,
    uid,
    expiry: res.headers.get("expiry") ?? undefined,
  };
}

/** Build the devise auth headers to send to Rails. */
export function deviseRequestHeaders(t: DeviseTokens): Record<string, string> {
  return {
    "access-token": t.accessToken,
    client: t.client,
    uid: t.uid,
    "token-type": "Bearer",
    ...(t.expiry ? { expiry: t.expiry } : {}),
  };
}
