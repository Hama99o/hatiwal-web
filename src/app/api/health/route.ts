// Liveness probe for the kamal-proxy healthcheck (config/deploy.yml → proxy.healthcheck.path).
// Lives under /api/* so the next-intl middleware skips it (no locale redirect) and it never
// touches the Rails API — it answers 200 as long as the Next server itself is up.
export const dynamic = "force-dynamic";

export function GET() {
  return new Response("OK", {
    status: 200,
    headers: { "content-type": "text/plain", "cache-control": "no-store" },
  });
}
