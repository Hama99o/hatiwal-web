import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Run on everything EXCEPT: /api/* (proxy + route handlers), Next internals,
  // and files with an extension (images, etc.).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
