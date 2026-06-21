import { NextResponse } from "next/server";
import { RAILS_SERVER_BASE } from "@/lib/env";
import { deviseRequestHeaders } from "@/lib/auth/devise";
import { clearTokenCookies, readTokensFromCookies } from "@/lib/auth/cookies";
import { isSameOrigin } from "@/lib/auth/origin";

/**
 * Schedule the signed-in account for deletion (mirrors mobile `DELETE /auth`,
 * a devise_token_auth registrations#destroy with a 30-day grace window). The
 * user is logged out; logging back in within the window restores the account.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  }
  const tokens = await readTokensFromCookies();
  if (!tokens) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const res = await fetch(`${RAILS_SERVER_BASE}/auth`, {
    method: "DELETE",
    headers: { Accept: "application/json", ...deviseRequestHeaders(tokens) },
    cache: "no-store",
  }).catch(() => null);

  if (!res || !res.ok) {
    return NextResponse.json({ error: "delete_failed" }, { status: 502 });
  }
  // Account is scheduled for deletion → drop our session cookies.
  const out = NextResponse.json({ ok: true });
  clearTokenCookies(out);
  return out;
}
