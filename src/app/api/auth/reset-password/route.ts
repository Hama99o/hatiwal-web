import { NextResponse } from "next/server";
import { RAILS_SERVER_BASE, RAILS_CLIENT_HEADERS } from "@/lib/env";
import { railsFetch } from "@/lib/auth/upstream";
import { isSameOrigin } from "@/lib/auth/origin";

export async function POST(req: Request) {
  if (!isSameOrigin(req))
    return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const { token, password, passwordConfirmation } = await req
    .json()
    .catch(() => ({}));
  if (!token || !password)
    return NextResponse.json({ error: "missing_params" }, { status: 400 });

  const { res, failure } = await railsFetch(`${RAILS_SERVER_BASE}/auth/password`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...RAILS_CLIENT_HEADERS },
    body: JSON.stringify({
      reset_password_token: token,
      password,
      password_confirmation: passwordConfirmation,
    }),
    cache: "no-store",
  });
  if (failure) return failure;

  if (!res.ok)
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });

  return NextResponse.json({ ok: true });
}
