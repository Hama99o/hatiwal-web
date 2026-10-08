import { NextResponse } from "next/server";

/**
 * The auth route handlers (/api/auth/*) translate Rails' answers into a small
 * `{ error }` vocabulary for the forms. Two answers used to be lost in that
 * translation: a 429 (sign-in, sign-up, Google, password reset are throttled)
 * and a Rails 5xx both came back as "invalid credentials" / "registration
 * failed", so a person typing the RIGHT password was told it was wrong — and
 * a Rails that could not be reached at all threw inside the handler.
 *
 * `railsFetch` returns either Rails' Response (for the route's own handling of
 * 2xx/4xx) or the ready-made failure for the three cases every auth route
 * shares:
 *   - fetch threw            → 502 `upstream_failed` (the client: "check your connection")
 *   - 429                    → 429 `rate_limited`    (the client: "too many attempts")
 *   - 5xx                    → 500 `server_error`    (the client: "something went wrong")
 */
export async function railsFetch(
  url: string,
  init: RequestInit,
): Promise<{ res: Response; failure?: undefined } | { res?: undefined; failure: NextResponse }> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    return { failure: NextResponse.json({ error: "upstream_failed" }, { status: 502 }) };
  }
  if (res.status === 429) {
    return { failure: NextResponse.json({ error: "rate_limited" }, { status: 429 }) };
  }
  if (res.status >= 500) {
    return { failure: NextResponse.json({ error: "server_error" }, { status: 500 }) };
  }
  return { res };
}
