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

export function writeTokenCookies(res: NextResponse, t: DeviseTokens): void {
  const opts = { ...COOKIE_OPTS, maxAge: maxAgeFromExpiry(t.expiry) };
  res.cookies.set(AUTH_COOKIES.accessToken, t.accessToken, opts);
  res.cookies.set(AUTH_COOKIES.client, t.client, opts);
  res.cookies.set(AUTH_COOKIES.uid, t.uid, opts);
  if (t.expiry) res.cookies.set(AUTH_COOKIES.expiry, t.expiry, opts);
}

export function clearTokenCookies(res: NextResponse): void {
  for (const name of Object.values(AUTH_COOKIES)) {
    res.cookies.set(name, "", { ...COOKIE_OPTS, maxAge: 0 });
  }
}
