import { type NextRequest, NextResponse } from "next/server";
import { RAILS_SERVER_BASE, rewriteRailsHost } from "@/lib/env";
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
  ["GET", /^my\/viewed_listings$/],
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
  // Chat (Phase 4):
  ["GET", /^conversations$/],
  ["GET", /^conversations\/\d+$/],
  ["DELETE", /^conversations\/\d+$/],
  ["POST", /^listings\/\d+\/conversations$/],
  ["GET", /^conversations\/\d+\/messages$/],
  ["POST", /^conversations\/\d+\/messages$/],
  ["DELETE", /^conversations\/\d+\/messages\/\d+$/],
  ["PUT", /^conversations\/\d+\/messages\/mark_read$/],
  ["PUT", /^conversations\/\d+\/mark_read$/],
  ["PUT", /^conversations\/\d+\/mark_unread$/],
  ["PUT", /^conversations\/\d+\/archive$/],
  ["PUT", /^conversations\/\d+\/unarchive$/],
  ["GET", /^blocks$/],
  ["POST", /^users\/\d+\/block$/],
  ["DELETE", /^users\/\d+\/block$/],
  // Reports (report a listing or user; list your own submitted reports):
  ["POST", /^reports$/],
  ["GET", /^reports$/],
  // Saved searches:
  ["GET", /^users\/saved_searches$/],
  ["POST", /^users\/saved_searches$/],
  ["DELETE", /^users\/saved_searches\/\d+$/],
  ["PUT", /^users\/saved_searches\/\d+\/mark_seen$/],
  // Restore a scheduled-for-deletion account:
  ["POST", /^users\/me\/restore$/],
  // Moderation warnings:
  ["GET", /^users\/warnings$/],
  ["PUT", /^users\/warnings\/mark_seen$/],
  // Reviews (write side): rate a sold transaction, edit while hidden, and the
  // pending "rate your recent deals" list.
  ["POST", /^transactions\/\d+\/reviews$/],
  ["PATCH", /^reviews\/\d+$/],
  ["GET", /^my\/reviews\/pending$/],
  // Authed listing show — fired client-side on the detail page so Rails records
  // a Recently-Viewed entry (the SSR fetch is a guest and never attributes it).
  ["GET", /^listings\/\d+$/],
  // Hidden ("not interested") listings — hide/restore + the management list.
  ["POST", /^listings\/\d+\/hide$/],
  ["DELETE", /^listings\/\d+\/unhide$/],
  ["GET", /^my\/hidden_listings$/],
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
    // Only attach a body when one actually exists: forwarding a zero-length
    // body (e.g. a body-less DELETE / lifecycle PUT) makes undici throw
    // UND_ERR_REQ_CONTENT_LENGTH_MISMATCH → the proxy 502s. Omitting it is
    // correct HTTP and lets those requests through.
    const buf = await req.arrayBuffer();
    if (buf.byteLength > 0) {
      const contentType = req.headers.get("content-type");
      if (contentType) headers["Content-Type"] = contentType;
      init.body = buf;
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return NextResponse.json({ error: "upstream_failed" }, { status: 502 });
  }

  const text = rewriteRailsHost(await upstream.text());
  // 204/empty responses must have a null body (e.g. DELETE) — passing "" throws.
  const out = new NextResponse(text || null, {
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
