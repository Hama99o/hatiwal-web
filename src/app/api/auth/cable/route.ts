import { NextResponse } from "next/server";
import { readTokensFromCookies } from "@/lib/auth/cookies";
import { isSameOrigin } from "@/lib/auth/origin";

/**
 * Hands the devise token to the client so it can open the ActionCable WebSocket
 * (Rails authenticates the WS via `access_token`/`client`/`uid` query params, and
 * the browser can't read our httpOnly cookies). Same-origin only.
 *
 * Tradeoff: this exposes the current token to JS for the socket connection. The
 * WS auths once at connect; rotation on later HTTP requests doesn't drop the live
 * socket. Acceptable for v1; harden later if needed.
 */
export async function GET(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  }
  const tokens = await readTokensFromCookies();
  if (!tokens) {
    return NextResponse.json({ authed: false }, { status: 401 });
  }
  return NextResponse.json({
    authed: true,
    accessToken: tokens.accessToken,
    client: tokens.client,
    uid: tokens.uid,
  });
}
