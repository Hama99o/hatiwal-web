import { NextResponse } from "next/server";
import { RAILS_SERVER_BASE } from "@/lib/env";
import { isSameOrigin } from "@/lib/auth/origin";
import { writeTokenCookies } from "@/lib/auth/cookies";
import { fetchMe } from "@/lib/auth/server";
import type { DeviseTokens } from "@/lib/auth/devise";

export async function POST(req: Request) {
  if (!isSameOrigin(req))
    return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const { idToken } = await req.json().catch(() => ({}));
  if (!idToken)
    return NextResponse.json({ error: "missing_token" }, { status: 400 });

  const res = await fetch(`${RAILS_SERVER_BASE}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ id_token: idToken }),
    cache: "no-store",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 403) {
      return NextResponse.json(
        {
          error: "blocked",
          status: data?.status ?? "blocked",
          reason: data?.reason ?? null,
        },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: "google_failed" }, { status: 401 });
  }

  // Google endpoint returns tokens in body, not headers
  const body = await res.json();
  const tokens: DeviseTokens = {
    accessToken: body["access-token"],
    client: body.client,
    uid: body.uid,
    expiry: String(body.expiry ?? ""),
  };

  const me = await fetchMe(tokens);
  if (me.status !== "ok")
    return NextResponse.json({ error: "me_failed" }, { status: 502 });

  const out = NextResponse.json({ user: me.user });
  writeTokenCookies(out, me.tokens);
  return out;
}
