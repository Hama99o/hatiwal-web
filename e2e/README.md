# Hatiwal Web — End-to-End Tests

Browser E2E for the Next.js web client, written with **Playwright**. Same spirit as
the mobile **Maestro** flows: every feature flow is exercised against a running app —
happy path, edge cases, and empty/error states — but here through a real Chromium
browser driving the rendered pages.

## Run them

```bash
npm run test:e2e          # headless, all specs
npm run test:e2e:ui       # interactive Playwright UI
npm run test:e2e:report   # open the HTML report from the last run
```

You don't need a database or the Ruby backend running — the harness boots its own
deterministic mock API and its own Next server. Just run the command.

## How the harness works

`playwright.config.ts` starts **two** servers before the tests (and tears them down
after):

1. **Mock API** — `e2e/mock-api/server.mjs`, a tiny Node `http` server on
   **:4010** that returns Rails-shaped, snake_case fixtures (categories, listings,
   sellers, auth). It mirrors the real serializers and supports the same query params
   the app sends (`category_id`, `search`, `sort`, `page[number]`, `user_id`, …).
2. **Next app** — `npx next dev` on **:3210**, pointed at the mock via
   `API_URL` / `NEXT_PUBLIC_API_URL=http://localhost:4010/api/v1`, building into an
   isolated `.next-e2e` dist dir (`NEXT_DIST_DIR`) so an E2E run never collides with a
   local `npm run dev` (port 3011, `.next`).

The web app fetches Rails in two places — Server Components fetch it directly, and the
browser fetches the same-origin proxy (`/api/proxy/[...path]`). Both point at
`API_URL`, so aiming `API_URL` at the mock makes the **entire** stack deterministic.

```
Chromium ──► Next (:3210) ──► proxy /api/proxy ──┐
             └─ Server Components ────────────────┴──► Mock API (:4010)
```

Dedicated ports (3210/4010) + `reuseExistingServer: !CI` keep local and CI runs from
clashing with anything already listening on the normal dev ports.

## Authentication

Gated screens (profile, seller dashboard, chat, saved, settings) sit behind
`RequireAuth`, driven by a cookie session. `auth.setup.ts` logs in **once per
persona** through the real UI and saves the resulting session (httpOnly token
cookies) to a `storageState` file; authed specs reuse it via
`test.use({ storageState })` (paths in `auth-paths.ts`) so they start signed in.

Two personas back populated-vs-empty coverage — the mock returns data keyed on
the persona's `access-token` (attached by the `/api/me` proxy):

| Persona | Login | storageState | Data |
|---|---|---|---|
| Buyer | `buyer@hatiwal.test` | `e2e/.auth/buyer.json` | Full: listings (all statuses), 2 conversations, saved, 1 blocked user |
| Empty | `empty@hatiwal.test` | `e2e/.auth/empty.json` | Empty everywhere (drives every empty-state spec) |

The `setup` project runs first (the `chromium` project `dependencies: ["setup"]`).
The mock is **stateless**: mutations return a computed success response but persist
nothing, so parallel workers never interfere. Authed specs assert on the immediate
response / optimistic UI / toast / redirect — not cross-request persistence.

## What's covered

**Public / read-only**

| Spec | Flow |
|---|---|
| `home.spec.ts` | Hero, categories, recent listings, price-drop badge, CTA → feed, footer nav |
| `bazaar.spec.ts` | Active-only feed, category filter, search, **empty state**, sort, chip/search wiring |
| `bazaar-filters.spec.ts` | Condition filter, price-range filter, condition-chip wiring, reset filters |
| `listing-detail.spec.ts` | Full detail, gated actions (Message Seller / Report), **404**, reserved viewable by id |
| `categories.spec.ts` | Category index, per-category page, navigation |
| `seller.spec.ts` | Public seller profile, count, that seller's listings only |
| `auth.spec.ts` | Login form, **invalid creds error**, guest→login redirect, valid login leaves /login |
| `auth-signup.spec.ts` | Register form, password-mismatch + taken-email errors, valid signup |
| `static-pages.spec.ts` | Privacy + delete-account pages in **en / ps / fa** (store-compliance), footer link |
| `i18n-theme.spec.ts` | en LTR, ps/fa **RTL**, language switcher, dark-mode toggle |
| `navigation.spec.ts` | Header links, footer legal links, logo → home, unknown route 404 |
| `redirects.spec.ts` | `/browse` → `/bazaar`, `/users/[id]` → `/sellers/[id]` |
| `auth-guard.spec.ts` | Every gated route bounces a guest to `/login` |

**Authenticated** (buyer + empty personas)

| Spec | Flow |
|---|---|
| `profile.spec.ts` | Identity, stats, Edit/Sign-out actions; guest redirect |
| `profile-edit.spec.ts` | Prefilled form, required-field validation, save → /profile |
| `my-listings.spec.ts` | Dashboard across statuses, tab filters, New Listing; **empty**; guest redirect |
| `manage-listing.spec.ts` | Detail + analytics, mark-sold (confirm→toast), delete (confirm→redirect), edit link |
| `message-seller.spec.ts` | Message Seller (compose→thread) and Make-an-Offer flows |
| `report.spec.ts` | Report dialog: reason required → submit → success |
| `create-listing.spec.ts` | Full form, **empty-submit validation**, save draft → new listing |
| `edit-listing.spec.ts` | Prefilled values, save → manage screen |
| `conversations.spec.ts` | Inbox list, open thread; **empty**; guest redirect |
| `conversation-thread.spec.ts` | History, send message, closed-conversation banner, **load error** |
| `saved.spec.ts` | Favorited listings; **empty**; guest redirect |
| `blocked-users.spec.ts` | List + unblock toast; **empty** |

## Conventions

- **Filtering is URL-driven.** The bazaar filter state is `state ⇄ querystring ⇄ Rails
  query`, so filter outcomes are asserted by navigating directly
  (`/en/bazaar?category=vehicles`) — deterministic SSR, no hydration race — while the
  interactive controls (chip click, typing) are asserted by the URL they produce,
  wrapped in `expect(...).toPass()` to ride out dev-mode hydration latency.
- **Edit fixtures** in `e2e/mock-api/server.mjs`. Keep them snake_case and shaped like
  the real serializer views (`:list` / `:detailed`).
- Demo login: `buyer@hatiwal.test` / `Password123!`.

## Notes / gotchas

- **Node 18 + Playwright 1.49.1 (pinned exact).** Playwright 1.6x needs Node ≥20.19;
  this repo targets Node 18.18 (same as Next 15). Don't bump `@playwright/test` without
  bumping Node first.
- **Save/unsave is intentionally uncovered**: `toggleSaved` exists in `lib/api/me.ts`
  but no web component renders a save/heart control (v1 web *displays* saved items;
  saving happens in the mobile app). There's no UI flow to test — only the `/saved`
  list display, which is covered.
- `.next-e2e`, `test-results/`, and `playwright-report/` are gitignored.
- CI: `.github/workflows/e2e.yml` runs the whole suite on push/PR.
