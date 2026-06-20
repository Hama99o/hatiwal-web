import { type NextRequest, NextResponse } from "next/server";
import { RAILS_SERVER_BASE } from "@/lib/env";

/**
 * Thin same-origin proxy: /api/proxy/<path>?<query> → <RAILS>/<path>?<query>.
 * Lets the browser fetch Rails data without CORS and without exposing the Rails
 * URL. Read-only (GET) — all writes happen in the mobile app for v1.
 */

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  const target = `${RAILS_SERVER_BASE}/${path.join("/")}${req.nextUrl.search}`;

  try {
    const upstream = await fetch(target, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return NextResponse.json(
      { errors: ["Upstream request failed"] },
      { status: 502 },
    );
  }
}
