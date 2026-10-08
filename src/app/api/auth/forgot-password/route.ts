import { NextResponse } from "next/server";
import { RAILS_SERVER_BASE } from "@/lib/env";
import { railsFetch } from "@/lib/auth/upstream";
import { isSameOrigin } from "@/lib/auth/origin";

export async function POST(req: Request) {
  if (!isSameOrigin(req))
    return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const { email } = await req.json().catch(() => ({}));
  if (!email)
    return NextResponse.json({ error: "missing_email" }, { status: 400 });

  // 200 whatever Rails says about the address, so the answer never leaks
  // whether the email exists. Only the answers that say nothing about it are
  // passed on: throttled (429), Rails broken (5xx) or unreachable — "we sent
  // you a link" would be a lie in those three.
  const { failure } = await railsFetch(`${RAILS_SERVER_BASE}/auth/password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email }),
    cache: "no-store",
  });
  if (failure) return failure;

  return NextResponse.json({ ok: true });
}
