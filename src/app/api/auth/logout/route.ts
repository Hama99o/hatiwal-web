import { NextResponse } from "next/server";
import { RAILS_SERVER_BASE } from "@/lib/env";
import { deviseRequestHeaders } from "@/lib/auth/devise";
import { clearTokenCookies, readTokensFromCookies } from "@/lib/auth/cookies";
import { isSameOrigin } from "@/lib/auth/origin";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  }
  const tokens = await readTokensFromCookies();
  if (tokens) {
    // Best-effort revoke on Rails; clear our cookies regardless.
    await fetch(`${RAILS_SERVER_BASE}/auth/sign_out`, {
      method: "DELETE",
      headers: { Accept: "application/json", ...deviseRequestHeaders(tokens) },
      cache: "no-store",
    }).catch(() => undefined);
  }
  const out = NextResponse.json({ ok: true });
  clearTokenCookies(out);
  return out;
}
