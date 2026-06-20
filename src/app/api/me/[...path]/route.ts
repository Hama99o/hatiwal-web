import { type NextRequest, NextResponse } from "next/server";
import { RAILS_SERVER_BASE } from "@/lib/env";
import { deviseRequestHeaders, tokensFromResponse } from "@/lib/auth/devise";
import {
  clearTokenCookies,
  readTokensFromCookies,
  writeTokenCookies,
} from "@/lib/auth/cookies";
import { isSameOrigin } from "@/lib/auth/origin";

/**
 * Authenticated proxy: /api/me/<path> → <RAILS>/<path>, attaching the devise
 * tokens from cookies and persisting any rotated token from the response.
 *
 * Explicitly ALLOW-LISTED: this would otherwise be a generic credentialed relay
 * to the whole Rails API. Only the endpoints the web client actually needs are
 * permitted; everything else is 403. Extend this list as new authed calls land.
 */
const ALLOWED: Array<[string, RegExp]> = [
  ["GET", /^my\/saved_listings$/],
  ["PUT", /^users\/me$/],
  ["POST", /^listings\/\d+\/save$/],
  ["DELETE", /^listings\/\d+\/unsave$/],
  // Seller dashboard (Phase 3):
  ["GET", /^my\/listings$/],
  ["POST", /^my\/listings$/],
  ["GET", /^my\/listings\/\d+$/],
  ["PUT", /^my\/listings\/\d+$/],
  ["PATCH", /^my\/listings\/\d+$/],
  ["DELETE", /^my\/listings\/\d+$/],
  ["PUT", /^my\/listings\/\d+\/(publish|unpublish|reserve|activate|sold|renew)$/],
  ["GET", /^my\/listings\/\d+\/analytics$/],
];

async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  // CSRF: reject cross-origin browser calls (SameSite=Lax handles the rest).
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  }

  const tokens = await readTokensFromCookies();
  if (!tokens) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { path } = await ctx.params;
  const joined = path.join("/");
  if (!ALLOWED.some(([m, re]) => m === req.method && re.test(joined))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const target = `${RAILS_SERVER_BASE}/${joined}${req.nextUrl.search}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...deviseRequestHeaders(tokens),
  };
  const init: RequestInit = { method: req.method, headers, cache: "no-store" };

  if (req.method !== "GET" && req.method !== "HEAD") {
    // Forward the original Content-Type (incl. the multipart boundary) and the
    // RAW bytes — reading as text would corrupt binary photo uploads.
    const contentType = req.headers.get("content-type");
    if (contentType) headers["Content-Type"] = contentType;
    init.body = await req.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return NextResponse.json({ error: "upstream_failed" }, { status: 502 });
  }

  const text = await upstream.text();
  const out = new NextResponse(text, {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? "application/json",
    },
  });

  const rotated = tokensFromResponse(upstream);
  if (rotated) writeTokenCookies(out, rotated);
  else if (upstream.status === 401) clearTokenCookies(out);
  return out;
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
