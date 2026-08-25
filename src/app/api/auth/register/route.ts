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
  const {
    email,
    password,
    passwordConfirmation,
    firstname,
    lastname,
    preferredLanguage,
  } = body ?? {};

  if (!email || !password || !firstname || !lastname) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const res = await fetch(`${RAILS_SERVER_BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      email,
      password,
      password_confirmation: passwordConfirmation,
      firstname,
      lastname,
      // Only forward a locale we recognise — never pass request input straight
      // through to the API. Omitted entirely when absent, so the server keeps
      // its own default rather than receiving null.
      ...(["en", "ps", "fa"].includes(preferredLanguage)
        ? { preferred_language: preferredLanguage }
        : {}),
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    // devise_token_auth returns { errors: { firstname: [...], full_messages: [...] } }
    return NextResponse.json(
      { error: "registration_failed", errors: data?.errors ?? null },
      { status: res.status === 422 ? 422 : 400 },
    );
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
