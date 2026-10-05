import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { HIDDEN_LOCALES, routing } from "./i18n/routing";

const intl = createMiddleware(routing);

export default function middleware(req: NextRequest) {
  // A hidden locale (Urdu, for now) keeps old links alive: /ur/x → /en/x.
  const [, first, ...rest] = req.nextUrl.pathname.split("/");
  if ((HIDDEN_LOCALES as readonly string[]).includes(first)) {
    const url = req.nextUrl.clone();
    url.pathname = `/${routing.defaultLocale}${rest.length ? `/${rest.join("/")}` : ""}`;
    return NextResponse.redirect(url, 307);
  }
  return intl(req);
}

export const config = {
  // Run on everything EXCEPT: /api/* (proxy + route handlers), Next internals,
  // and files with an extension (images, etc.).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
