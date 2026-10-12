import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { HIDDEN_LOCALES, routing } from "./i18n/routing";

const intl = createMiddleware(routing);

/** The one canonical host. www.hatiwal.com is served by the same container. */
const APEX = "hatiwal.com";

export default function middleware(req: NextRequest) {
  // www → apex, permanently, path and query kept. Android App Links (and the
  // AASA) are declared for hatiwal.com only, and one address keeps search
  // results and shared links consistent. kamal-proxy routes both hosts here
  // and cannot redirect by host itself, so it happens in the app. (A tapped
  // www link is still opened by the browser: Android decides on the host it
  // was given; the app's own share links all use the apex.)
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  if (host === `www.${APEX}`) {
    return NextResponse.redirect(`https://${APEX}${req.nextUrl.pathname}${req.nextUrl.search}`, 301);
  }

  // A hidden locale (Urdu, for now) keeps old links alive: /ur/x → /en/x.
  // 301, not 307: Google keeps a temporarily-redirected URL in its index, and
  // /ur/categories/mens-clothing was still drawing impressions a week after
  // Urdu was hidden (Search Console, 2026-10-12). A permanent redirect drops
  // the /ur URL and hands its signals to /en. Un-hiding Urdu (routing.ts)
  // removes this branch; a browser that cached the 301 sends that visitor to
  // /en once more, and the language switcher brings them back.
  const [, first, ...rest] = req.nextUrl.pathname.split("/");
  if ((HIDDEN_LOCALES as readonly string[]).includes(first)) {
    const url = req.nextUrl.clone();
    url.pathname = `/${routing.defaultLocale}${rest.length ? `/${rest.join("/")}` : ""}`;
    return NextResponse.redirect(url, 301);
  }
  return intl(req);
}

export const config = {
  // Run on everything EXCEPT: /api/* (proxy + route handlers), Next internals,
  // and files with an extension (images, etc.).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
