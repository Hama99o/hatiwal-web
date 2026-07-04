# Hatiwal Web — Engineering Prompt (read before building any web feature)

This is the **web** engineering rulebook, the counterpart to `hatiwal-mobile/docs/prompts/mobile.prompt.md`.
The web client (`hatiwal-web/`) is a **Next.js browser app** that talks to the **same Rails API** as mobile.
When porting a mobile feature to web, match the mobile screen's behavior and trust cues — but build it the **web way**, never with react-native.

---

## 1) The Stack (do not fight it)

| Concern | What we use |
|---|---|
| Framework | **Next.js 15 App Router** (`src/app/[locale]/…`), React 19, TypeScript |
| Styling | **Tailwind CSS v4** (CSS-first — configured in `src/app/globals.css`, no `tailwind.config.js`) |
| Components | **shadcn-style primitives** in `src/components/ui/` (Radix + `class-variance-authority` + `cn()`) |
| Icons | **lucide-react** |
| Data | **TanStack Query v5** + the isomorphic client in `src/lib/api/` |
| Forms | **react-hook-form + zod** |
| i18n | **next-intl v4** — catalogs in `messages/{en,ps,fa}.json` |
| Theme | **next-themes** (dark mode via the `.dark` class) |
| Toasts | **sonner** |
| Dates/format | **date-fns** + `src/lib/format.ts` |
| Maps | **Leaflet + react-leaflet** (`src/components/map/`) |
| Real-time | **@rails/actioncable** (`src/lib/cable.ts`) |

**NEVER** import `react-native`, `nativewind`, `expo-*`, `react-native-reusables`, or any RN component into `hatiwal-web/`. That is the mobile client. If you catch yourself reaching for `<View>`/`<Text>`/`StyleSheet`, stop — use HTML + Tailwind.

---

## 2) Component rules (strict — same spirit as mobile's RNR rule)

- **All UI from the existing primitives** in `src/components/ui/` (`button`, `card`, `badge`, `input`, `avatar`, `dropdown-menu`, `separator`, `skeleton`, `field`, `confirm-dialog`) and the shared domain components in `src/components/{shared,browse,listing,chat,auth,account,map,layout}/`.
- **Never hand-roll a primitive that already exists.** Need a new primitive? Add it to `src/components/ui/` in the shadcn/cva style so the next feature reuses it — don't inline a one-off.
- Reuse the shared domain components that mirror mobile's shared ones (listing card, price, status badge, user identity, empty state, skeletons). Extend them; don't fork.
- Destructive actions use `confirm-dialog` (the web analog of mobile's `confirmAlert`) — never a bare `window.confirm`.

## 3) Strings & i18n (non-negotiable)

- **Never hardcode user-facing strings.** Use `next-intl` `t('namespace.key')`.
- **Every new key must be added to ALL three catalogs:** `messages/en.json`, `messages/ps.json`, `messages/fa.json`. Mirror the mobile key names where a mobile equivalent exists so the two clients stay legible together.
- Numbers, currency, and dates go through `src/lib/format.ts` / `date-fns` with the active locale.

## 4) RTL (Pashto & Dari)

- `dir` is set on `<html>` per-locale in `src/app/[locale]/layout.tsx` (`ps`, `fa` → `rtl`).
- **Use logical properties** — `ms-*/me-*/ps-*/pe-*`, `start-*/end-*`, `text-start/text-end`. **Never** hardcode `left/right`, `ml-/mr-`, `pl-/pr-` for directional layout.
- Test every new screen visually in `ps` (or `fa`) — the layout must mirror correctly.

## 5) Colors & dark mode

- **Never hardcode hex/rgb.** Use the Tailwind token classes / CSS variables in `src/app/globals.css` — these are ported verbatim from mobile's `useColors()` palette (same brand gold `#E8B23A`, same radii, same light/dark values), so the two clients look like one product.
- Every screen must be correct in **both** light and dark (`.dark` class). No color that only works in one theme.

## 6) Data fetching & auth (the part that's genuinely different from mobile)

- **Isomorphic client:** `src/lib/api/client.ts`. Server components/ISR fetch Rails directly (`RAILS_SERVER_BASE`); the browser fetches the **same-origin proxy** (`/api/proxy` for public, `/api/me` for authed). Auto snake↔camel via `src/lib/api/case.ts`.
- **Wrap reads in TanStack Query** (`useQuery`/`useInfiniteQuery`); wrap writes in `useMutation` + `invalidateQueries`. Never blank a screen behind a spinner when cached data exists. (Same data-freshness philosophy as mobile's React Query standard.)
- **Auth = devise_token_auth tokens in httpOnly cookies** (NOT NextAuth). Authed browser calls go through `src/app/api/me/[...path]/route.ts`, which enforces a same-origin CSRF check, attaches the devise headers from cookies, and re-persists rotated tokens.
- The `/api/me` proxy has an explicit **method + path allow-list**. If your feature calls a Rails endpoint that isn't listed, **add it to the allow-list** — otherwise the call 403s. Never bypass the proxy to call Rails directly from the browser.
- WebSocket auth goes through `src/app/api/auth/cable/route.ts` → `src/lib/cable.ts`.

## 7) Cross-client contract (CRITICAL — you can break mobile from here)

- The Rails JSON is **camelCased identically** on both clients; the shared contracts live in `src/lib/types.ts`. Reuse them.
- **Do not change an API endpoint's shape or field names to suit web** — mobile depends on the same endpoints. If a feature genuinely needs a new/changed endpoint, build it in `hatiwal-api/` following `hatiwal-api/docs/prompts/backend.prompt.md` (render_blue, Pundit, RSpec+RSwag, policy_scope) and verify it doesn't break the mobile contract. Prefer **reusing** an endpoint mobile already uses — that's the usual case for a port.

## 8) Routing

- Routes live under `src/app/[locale]/…` — every user route is locale-segmented.
- Page files are Server Components by default; add `"use client"` only to the interactive leaf that needs it. Keep data fetching in the server component / query hooks, not tangled into presentational components.
- Match the mobile route's information architecture (see the parity map) but use web-native navigation (links, not a tab bar where a header/nav fits better).

## 9) Checklist — porting a mobile feature to web

1. **Find the row** in `docs/MOBILE_TO_WEB_MIGRATION.md` and read the mobile screen it points to, to match behavior + trust cues.
2. **API** — reuse the existing `src/lib/api/<resource>.ts` module (or add a typed function); extend the `/api/me` allow-list if a new authed endpoint is needed.
3. **Page/route** — `src/app/[locale]/<route>/page.tsx` (Server Component; client leaf only where needed).
4. **UI** — shadcn primitives + shared components; add a new primitive to `src/components/ui/` if truly missing.
5. **i18n** — add keys to `messages/en.json`, `ps.json`, `fa.json` (all three).
6. **RTL + dark** — logical properties; token colors; verify in `ps` and dark.
7. **States** — loading skeleton, empty state, error state.
8. **Verify** — `npm run build` / typecheck clean; the page renders and the flow works; mobile contract untouched.

## 10) What NOT to do

- ❌ Import anything react-native / expo / NativeWind.
- ❌ Hardcode strings, colors, or `left/right` directional CSS.
- ❌ Call Rails directly from the browser or bypass the `/api/me` allow-list.
- ❌ Change a shared API field name / response shape (breaks mobile).
- ❌ Hand-roll a primitive that exists in `src/components/ui/`.
- ❌ Add a feature in only one locale, or that only works in light mode.
