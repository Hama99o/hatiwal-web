import { NextResponse } from "next/server";
import {
  clearTokenCookies,
  readTokensFromCookies,
  writeTokenCookies,
} from "@/lib/auth/cookies";
import { fetchMe } from "@/lib/auth/server";

// Returns { user } (camelCase) or { user: null } for guests. Persists rotated tokens.
export async function GET() {
  const tokens = await readTokensFromCookies();
  if (!tokens) return NextResponse.json({ user: null });

  const me = await fetchMe(tokens);
  if (!me) {
    const out = NextResponse.json({ user: null });
    clearTokenCookies(out);
    return out;
  }

  const out = NextResponse.json({ user: me.user });
  writeTokenCookies(out, me.tokens);
  return out;
}
