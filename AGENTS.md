# Hatiwal Web — Agent Instructions

The Hatiwal **web** client: a Next.js front-end that is a *second client* of the same Rails API the
mobile app uses. It is **not** a backend and **not** a marketing site — it adapts the mobile screens
for the browser and adds SSR/SEO. Plan: `../docs/WEB_FRONTEND_PLAN.md`. Page checklist:
`../docs/WEB_BACKLOG.md`. Sprint: `../docs/WEB_SPRINT.md`.

## Stack (pinned)
- **Next.js 15.5.x (App Router)** — pinned to 15 on purpose: this machine runs **Node 18.18**, and
  Next 16 requires Node ≥20.9. Do not upgrade Next without upgrading Node first.
- React 19 · TypeScript · **Tailwind CSS v4** (CSS-first, no tailwind.config.js) · shadcn-style UI in
  `src/components/ui` · **next-intl v4** · TanStack Query v5 · lucide-react · sonner · next-themes.
- Run **locally**: `npm run dev` → **port 3011**. Rails API expected on `:3007` (see `.env.example`).
- Run in **Docker**: `docker compose up web` → **port 8500** (override with `WEB_PORT=8600 docker compose up web`).
  The container reaches the host's Rails via `host.docker.internal:3007`; the browser only talks to the
  web container (all data is proxied), so one host port suffices. See `docker-compose.yml` + `Dockerfile.dev`.

## Non-negotiable rules
1. **No duplication.** Every repeated piece of UI lives in `src/components/shared/` and is reused —
   `ListingCard`, `PriceTag`, `StatusBadge`, `ConditionBadge`, `UserIdentity`, `UserAvatar`,
   `CategoryBadge`, `EmptyState`, `ListingGrid`, `OpenInAppCTA`. Extend these, never fork or re-implement.
   Shared logic (e.g. browse filter ⇄ URL ⇄ query mapping) lives in one module imported by both server
   and client (`src/components/browse/filters.ts`).
2. **Reuse mobile contracts.** API field names (`src/lib/types.ts`) and i18n keys (`messages/*.json`)
   mirror the mobile app exactly. When the concept matches mobile, reuse the same key.
3. **No hardcoded strings** — `t('...')` via next-intl, in all 3 locales (`en`, `ps`, `fa`).
   `ps`/`fa` are RTL (`dir` is set per-locale on `<html>`).
4. **No hardcoded colors** — Tailwind tokens only (`bg-card`, `text-foreground`, `bg-success/10`…).
   Dark mode flips via the `.dark` class (next-themes) + CSS variables in `globals.css` (ported from the
   mobile `useColors()` palette). Never inline a hex.
5. **Rails is the only backend.** All data via `src/lib/api/*`. Server Components fetch Rails directly;
   the browser fetches the same-origin proxy `src/app/api/proxy/[...path]` (CORS-free). Never add a Next
   route handler for business data.
6. **Route files render screens only** — data/logic in `src/lib` or client islands.

## Architecture quick map
- `src/app/[locale]/…` — locale-segmented routes. Root `app/layout.tsx` passes through; `[locale]/layout.tsx`
  renders `<html lang dir>`, providers, header/footer.
- Public pages are ISR (`export const revalidate = 60`) for SEO; gated actions render `<OpenInAppCTA>`
  (deep-links `hatiwal://…`) — v1 is read-only, buying/selling happens in the app.
- `src/lib/api/client.ts` — isomorphic fetch (server→Rails, client→proxy) + snake/camel conversion.
- `src/lib/format.ts` — the only place prices/dates are formatted.

## Gotchas
- **Tailwind v4 native binding:** if a build fails with "Cannot find native binding" (`@tailwindcss/oxide`),
  it's the npm optional-deps bug. Fix: `npm i @tailwindcss/oxide-linux-x64-gnu@<oxide-version> --no-save`
  (this machine), or `rm -rf node_modules package-lock.json && npm install` for a clean lockfile.

## Verify your work
- `npx tsc --noEmit` (types) · `npm run build` (lint + RSC + prerender) · `npm run dev` then load `/en`,
  `/ps`, `/fa` and toggle dark mode. Test RTL on `ps`/`fa`. Check loading/empty/error on every data view.
