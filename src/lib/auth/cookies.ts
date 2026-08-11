import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { AUTH_COOKIES, type DeviseTokens } from "./devise";

// httpOnly so JS can't read them (XSS-safe); SameSite=Lax + the Origin check in
// lib/auth/origin.ts cover CSRF.
//
// NOTE: devise_token_auth rotates the access-token per request but tolerates
// overlapping requests within `batch_request_buffer_throttle` (default 5s) by
// returning the same token. The web client relies on that window so concurrent
// /api/me + /api/auth/session calls don't invalidate each other. If the backend
// tightens that config, serialize the cookie writes here.
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};

const FALLBACK_MAX_AGE = 60 * 60 * 24 * 14; // 14 days

/**
 * Non-secret companion to the token cookies: the signed-in user's id, so a
 * DYNAMIC Server Component can answer "is the viewer the owner of this?" during
 * SSR without a Rails round-trip.
 *
 * Why it exists: public payloads are fetched anonymously, so ownership used to be
 * decided only in the browser, after `/api/auth/session` resolved. The server
 * HTML therefore always painted the buyer version first — a seller opening their
 * own listing saw "Contact Seller", the save heart and the meetup tips flash by
 * before their owner panel replaced them. No client-side trick can fix that (the
 * SSR HTML is painted before hydration), and re-probing Rails from an RSC is not
 * an option either: devise_token_auth rotates the access-token on every request
 * and a Server Component cannot write the rotated one back, which would log the
 * user out. So the id rides along in its own cookie, written wherever the tokens
 * are written and cleared wherever they are cleared.
 *
 * It grants NOTHING: it carries no token, is never sent to Rails, and every owner
 * action behind it is still authorized by Rails/Pundit. A tampered value can only
 * change which purely presentational block the tamperer sees on their own screen.
 * httpOnly all the same — there is no reason for page JS to read it.
 */
export const VIEWER_ID_COOKIE = "hatiwal_viewer_id";

// devise `expiry` is a Unix timestamp in SECONDS. Convert to a cookie maxAge,
// guarding against unit ambiguity / clock skew with a plausibility window.
function maxAgeFromExpiry(expiry?: string): number {
  if (!expiry) return FALLBACK_MAX_AGE;
  const expSec = Number(expiry);
  if (!Number.isFinite(expSec)) return FALLBACK_MAX_AGE;
  const secs = Math.floor(expSec - Date.now() / 1000);
  return secs > 60 && secs <= 60 * 60 * 24 * 60 ? secs : FALLBACK_MAX_AGE;
}

/** Read the devise tokens from the request cookies (route handlers / RSC). */
export async function readTokensFromCookies(): Promise<DeviseTokens | null> {
  const jar = await cookies();
  const accessToken = jar.get(AUTH_COOKIES.accessToken)?.value;
  const client = jar.get(AUTH_COOKIES.client)?.value;
  const uid = jar.get(AUTH_COOKIES.uid)?.value;
  if (!accessToken || !client || !uid) return null;
  return { accessToken, client, uid, expiry: jar.get(AUTH_COOKIES.expiry)?.value };
}

/**
 * Read the signed-in user's id from the request cookies. Only for DYNAMIC routes
 * (a `cookies()` read opts a page out of static rendering, and the public pages
 * are deliberately ISR) — see VIEWER_ID_COOKIE.
 */
export async function readViewerIdFromCookies(): Promise<number | null> {
  // Never stronger than the session behind it: with no token cookies the viewer
  // is a guest, whatever a leftover id cookie claims.
  if (!(await readTokensFromCookies())) return null;
  const raw = (await cookies()).get(VIEWER_ID_COOKIE)?.value;
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Persist the devise tokens. Pass `viewerId` whenever the caller knows who the
 * session belongs to (login / register / google / the session probe) so SSR can
 * resolve ownership; token-rotation writes omit it and leave the id cookie be.
 */
export function writeTokenCookies(
  res: NextResponse,
  t: DeviseTokens,
  viewerId?: number | null,
): void {
  const opts = { ...COOKIE_OPTS, maxAge: maxAgeFromExpiry(t.expiry) };
  res.cookies.set(AUTH_COOKIES.accessToken, t.accessToken, opts);
  res.cookies.set(AUTH_COOKIES.client, t.client, opts);
  res.cookies.set(AUTH_COOKIES.uid, t.uid, opts);
  if (t.expiry) res.cookies.set(AUTH_COOKIES.expiry, t.expiry, opts);
  if (viewerId != null) res.cookies.set(VIEWER_ID_COOKIE, String(viewerId), opts);
}

export function clearTokenCookies(res: NextResponse): void {
  for (const name of [...Object.values(AUTH_COOKIES), VIEWER_ID_COOKIE]) {
    res.cookies.set(name, "", { ...COOKIE_OPTS, maxAge: 0 });
  }
}
