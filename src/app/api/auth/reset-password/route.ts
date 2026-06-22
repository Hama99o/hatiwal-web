import { NextResponse } from "next/server";
import { RAILS_SERVER_BASE } from "@/lib/env";
import { isSameOrigin } from "@/lib/auth/origin";

export async function POST(req: Request) {
  if (!isSameOrigin(req))
    return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const { token, password, passwordConfirmation } = await req
    .json()
    .catch(() => ({}));
  if (!token || !password)
    return NextResponse.json({ error: "missing_params" }, { status: 400 });

  const res = await fetch(`${RAILS_SERVER_BASE}/auth/password`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      reset_password_token: token,
      password,
      password_confirmation: passwordConfirmation,
    }),
    cache: "no-store",
  });

  if (!res.ok)
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });

  return NextResponse.json({ ok: true });
}
