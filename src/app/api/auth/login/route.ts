import { NextResponse } from "next/server";
import { RAILS_SERVER_BASE } from "@/lib/env";
import { tokensFromResponse } from "@/lib/auth/devise";
import { writeTokenCookies } from "@/lib/auth/cookies";
import { isSameOrigin } from "@/lib/auth/origin";
import { fetchMe } from "@/lib/auth/server";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const email = body?.email;
  const password = body?.password;
  if (!email || !password) {
    return NextResponse.json({ error: "missing_credentials" }, { status: 400 });
  }

  const res = await fetch(`${RAILS_SERVER_BASE}/auth/sign_in`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const tokens = tokensFromResponse(res);
  if (!tokens) {
    return NextResponse.json({ error: "no_token" }, { status: 502 });
  }

  const me = await fetchMe(tokens);
  if (!me) {
    return NextResponse.json({ error: "me_failed" }, { status: 502 });
  }

  const out = NextResponse.json({ user: me.user });
  writeTokenCookies(out, me.tokens);
  return out;
}
