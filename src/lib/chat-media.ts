/**
 * 1.2.1: a chat file's never-expiring link is the API's participant-only route
 * (…/api/v1/conversations/:c/messages/:m/attachment). The browser cannot send the
 * session to Rails, so it asks our own /api/me proxy, which adds the session and
 * answers with a 302 to a fresh signed file. Anything else (an older JSON's signed
 * URL, a blob: preview) is used as it is.
 */
const ROUTE = /\/api\/v1\/(conversations\/\d+\/messages\/\d+\/attachment)$/;

export function viaSession(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = ROUTE.exec(url);
  return m ? `/api/me/${m[1]}` : url;
}
