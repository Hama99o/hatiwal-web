/**
 * Stateless CSRF defense for the cookie-auth API routes: reject browser requests
 * whose Origin isn't our own. A missing Origin (server-to-server, curl, some
 * top-level navigations) is allowed — the cookie's SameSite=Lax flag covers those.
 *
 * Compares Origin against the request's **Host header** — i.e. the host the
 * browser actually addressed. This is the standard CSRF check and is robust
 * behind Docker port-mapping / reverse proxies, where `req.url` can reflect the
 * server's bind address (e.g. 0.0.0.0:8500) rather than what the client typed.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("host");
  if (!host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
