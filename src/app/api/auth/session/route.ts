import { NextResponse } from "next/server";
import {
  clearTokenCookies,
  readTokensFromCookies,
  writeTokenCookies,
} from "@/lib/auth/cookies";
import { fetchMe } from "@/lib/auth/server";

// Returns { user } (camelCase) or { user: null } for guests. Persists rotated
// tokens. Cookies are cleared ONLY on an explicit 401 — a transient backend
// error returns 503 with the cookies intact so a reload recovers the session.
export async function GET() {
  const tokens = await readTokensFromCookies();
  if (!tokens) return NextResponse.json({ user: null });

  const me = await fetchMe(tokens);

  if (me.status === "ok") {
    const out = NextResponse.json({ user: me.user });
    writeTokenCookies(out, me.tokens);
    return out;
  }

  if (me.status === "unauthorized") {
    // Tokens are genuinely invalid — end the session.
    const out = NextResponse.json({ user: null });
    clearTokenCookies(out);
    return out;
  }

  // Transient (Rails 5xx / unreachable): DON'T touch cookies. Signal the client
  // so it keeps the optimistic session instead of demoting to guest.
  return NextResponse.json({ user: null, transient: true }, { status: 503 });
}
