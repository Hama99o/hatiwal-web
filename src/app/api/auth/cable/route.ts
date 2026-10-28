import { NextResponse } from "next/server";
import { RAILS_CLIENT_HEADERS, RAILS_SERVER_BASE } from "@/lib/env";
import { deviseRequestHeaders, tokensFromResponse } from "@/lib/auth/devise";
import { readTokensFromCookies, writeTokenCookies } from "@/lib/auth/cookies";
import { isSameOrigin } from "@/lib/auth/origin";

/**
 * A single-use ticket for the chat's live connection (the ActionCable WebSocket).
 *
 * A browser cannot set headers on a WebSocket, so the socket's URL must carry
 * whatever authenticates it — and URLs end up in proxy access logs. This route
 * used to hand the devise session itself (access-token, client, uid = the email)
 * to page JS for that URL. Now it asks Rails for a ticket (POST /cable_ticket,
 * server-side, with the session from the httpOnly cookies) and returns ONLY the
 * ticket: random, worth one connect within ~60 s (privacy review 2026-10-28).
 * The long-lived token never reaches page JS or a URL. Same-origin only.
 *
 * Cookie write-back follows /api/me: only a real rotation of this same session,
 * and never a clear on a 401 (/api/auth/session owns ending a dead session).
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  }
  const tokens = await readTokensFromCookies();
  if (!tokens) {
    return NextResponse.json({ authed: false }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${RAILS_SERVER_BASE}/cable_ticket`, {
      method: "POST",
      headers: { Accept: "application/json", ...RAILS_CLIENT_HEADERS, ...deviseRequestHeaders(tokens) },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "upstream_failed" }, { status: 502 });
  }

  const body = (await upstream.json().catch(() => null)) as { ticket?: unknown; expires_in?: unknown } | null;
  const ok = upstream.status === 201 && typeof body?.ticket === "string" && body.ticket.length > 0;
  const out = ok
    ? NextResponse.json({ ticket: body!.ticket, expiresIn: body!.expires_in }, { headers: { "Cache-Control": "no-store" } })
    : NextResponse.json({ error: "no_ticket" }, { status: upstream.status === 401 ? 401 : 502 });

  const rotated = tokensFromResponse(upstream);
  if (rotated && rotated.client === tokens.client && rotated.uid === tokens.uid && rotated.accessToken !== tokens.accessToken) {
    writeTokenCookies(out, rotated);
  }
  return out;
}
