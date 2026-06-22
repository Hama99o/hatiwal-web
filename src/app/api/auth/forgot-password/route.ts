import { NextResponse } from "next/server";
import { RAILS_SERVER_BASE } from "@/lib/env";
import { isSameOrigin } from "@/lib/auth/origin";

export async function POST(req: Request) {
  if (!isSameOrigin(req))
    return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const { email } = await req.json().catch(() => ({}));
  if (!email)
    return NextResponse.json({ error: "missing_email" }, { status: 400 });

  // Fire and forget — always return 200 to avoid leaking whether the email exists
  await fetch(`${RAILS_SERVER_BASE}/auth/password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email }),
    cache: "no-store",
  }).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
