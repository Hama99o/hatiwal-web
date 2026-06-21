# hatiwal-web — Deployment

Deployed with **Kamal 2** to the shared OVH VPS (`51.254.130.18`), in its own
isolated Docker network `hatiwal_web-net`, behind the shared `kamal-proxy`.
See the workspace overview: [../../DEPLOYMENT.md](../../DEPLOYMENT.md).

| | value |
|---|---|
| Hostname | `hatiwal.51.254.130.18.nip.io` (auto-TLS) |
| Image | `hama99o/hatiwal_web` |
| Container port | `3000` (Next standalone server) |
| Healthcheck | `GET /api/health` → `200 OK` |
| Backend | Rails API at `https://api.hatiwal.51.254.130.18.nip.io/api/v1` |

## How it's built

- `next.config.ts` sets `output: "standalone"`, so `next build` emits a
  self-contained `.next/standalone/server.js`. The multi-stage `Dockerfile`
  (Node 18 — pinned because Next 15 needs Node <20) copies only
  `standalone/` + `.next/static` + `public/` into a ~280 MB runtime image.
- **`NEXT_PUBLIC_*` are baked at BUILD time** (into the browser bundle), so Kamal
  passes them as `builder.args` (see `config/deploy.yml`). Changing a public URL
  requires a **rebuild**, not just a restart.
- **Server-only runtime vars** (`API_URL`, `PORT`, `HOSTNAME`) come from
  `env.clear` and are read at boot.

## How it reaches the API

`hatiwal_web` and `hatiwal_api` are on **separate** Docker networks, so the web
talks to the API over its **public HTTPS URL** (same as the mobile app):

- **Server-side** (RSC/ISR + the `/api/proxy/[...path]` route) → fetches `API_URL` directly.
- **Browser** → calls the same-origin `/api/proxy/*`, which forwards to `API_URL` (CORS-free).

## Configuration files

| File | Purpose |
|---|---|
| `config/deploy.yml` | Kamal config — host, proxy host, build args, runtime env |
| `Dockerfile` | Multi-stage standalone production build |
| `.kamal/secrets` | Feeds `KAMAL_REGISTRY_PASSWORD` from `.env.production` |
| `.env.production` | Your real deploy values (gitignored) — copy from `.env.production.example` |
| `src/app/api/health/route.ts` | Liveness probe for the proxy healthcheck |

## First deploy

```bash
cp .env.production.example .env.production   # fill KAMAL_REGISTRY_PASSWORD (Docker Hub token)
ssh kamal@51.254.130.18 "docker network create hatiwal_web-net"   # one-time
kamal setup
```

## Day-to-day — `bin/kms`

```bash
bin/kms deploy        # build + push + zero-downtime deploy
bin/kms status        # deployment details
bin/kms logs          # follow logs   (logs:200, logs:proxy, logs:grep <pattern>)
bin/kms sh            # shell into the running container
bin/kms rollback      # revert to the previous release
bin/kms help          # full list
```

`bin/kms` requires the `kamal` gem (`gem install kamal`) on your PATH.

## Verify

```bash
curl -sS https://hatiwal.51.254.130.18.nip.io/api/health   # → OK
open https://hatiwal.51.254.130.18.nip.io/en               # home (en/ps/fa)
```

## Local sanity check (optional)

Build & run the production image exactly as the server will:

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.hatiwal.51.254.130.18.nip.io/api/v1 \
  --build-arg NEXT_PUBLIC_RAILS_ORIGIN=https://api.hatiwal.51.254.130.18.nip.io \
  --build-arg NEXT_PUBLIC_SITE_URL=https://hatiwal.51.254.130.18.nip.io \
  -t hatiwal_web:localtest .
docker run --rm -p 8599:3000 hatiwal_web:localtest
curl -s http://localhost:8599/api/health   # → OK
```

> Local dev is unchanged: `npm run dev` (port 3011) or `docker compose up` (port 8500).
