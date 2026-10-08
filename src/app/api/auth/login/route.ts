import { NextResponse } from "next/server";
import { RAILS_SERVER_BASE, RAILS_CLIENT_HEADERS } from "@/lib/env";
import { railsFetch } from "@/lib/auth/upstream";
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

  // 429 / 5xx / unreachable are NOT "wrong password" (see railsFetch).
  const { res, failure } = await railsFetch(`${RAILS_SERVER_BASE}/auth/sign_in`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...RAILS_CLIENT_HEADERS },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  if (failure) return failure;

  if (!res.ok) {
    // Distinguish a blocked/suspended account (Rails 403 with a status+reason)
    // from genuinely wrong credentials (401).
    const data = await res.json().catch(() => ({}));
    if (
      res.status === 403 ||
      data?.status === "suspended" ||
      data?.status === "banned"
    ) {
      return NextResponse.json(
        {
          error: "blocked",
          status: data?.status ?? "blocked",
          reason: data?.reason ?? null,
        },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const tokens = tokensFromResponse(res);
  if (!tokens) {
    return NextResponse.json({ error: "no_token" }, { status: 502 });
  }

  const me = await fetchMe(tokens);
  if (me.status !== "ok") {
    return NextResponse.json({ error: "me_failed" }, { status: 502 });
  }

  const out = NextResponse.json({ user: me.user });
  writeTokenCookies(out, me.tokens, me.user.id);
  return out;
}
