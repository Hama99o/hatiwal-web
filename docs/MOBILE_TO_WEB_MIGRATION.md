# Hatiwal — Mobile → Web Feature Migration Catalog

> **What this is:** a complete, line-by-line catalog of **every mobile feature** and its status on the
> **web** client (`hatiwal-web/`, Next.js). It is the source of truth for "what still needs porting
> from the app to the web," and the **work queue the software house pulls `web` tasks from**.
>
> **Read alongside:** [`../../docs/MOBILE_WEB_PARITY.md`](../../docs/MOBILE_WEB_PARITY.md) (page-by-page
> parity map) · [`prompts/web.prompt.md`](prompts/web.prompt.md) (how to build web features the house way)
> · `hatiwal-mobile/docs/BACKLOG.md` (mobile feature detail).

## The honest headline

**Web is NOT starting from zero.** As of the 2026‑06‑21 parity audit the web client already reaches
near-full parity with mobile (browse, auth, seller dashboard, maps, real-time chat, offers, reports,
saved searches, account delete/restore, buyer/seller mode). So this is **not "port 100 net-new
features."** It is a **~110-feature catalog** where most core features are ✅ done, ~10 are 📱 mobile-only,
and the **real migration work is ~30 gaps** — mostly features mobile shipped *after* that audit
(delete-message, nearest sort, saved-by-N, message search, price-drop / response-rate badges, archive /
mark-unread, away mode, counter-offer, etc.).

> ⚠️ **Verify-before-build:** the ✅/⬜ status below is derived from the 12-day-old parity audit + the
> mobile inventory, not a fresh line-by-line read of every web route. A `web` task's **first step** is to
> confirm the gap still exists in `hatiwal-web/` before building (some may have landed since the audit).

### Legend

| Mark | Meaning |
|---|---|
| ✅ | Already built on web — parity confirmed by the audit |
| ⬜ | **GAP — needs porting to web** (the migration work; becomes a `web` board task) |
| 📱 | Mobile-only by nature — do **not** port 1:1 (rebuild with a web equivalent only if it matters) |
| ❓ | Uncertain — web dev must verify against current web code first, then build if missing |
| 🌐 | Web already has this natively / for free (e.g. real URLs, SSR) |

---

## 0 — Onboarding & Bootstrap

| ID | Feature | Web | Migration note |
|---|---|---|---|
| A3 | App bootstrap / splash redirect | ✅ | Web hydrates auth on load; native splash is 📱 N/A |
| A4 | Guest browsing + auth gate (`returnTo`) | ✅ | `GUEST_BROWSE_AND_AUTH_REDIRECT.md` |
| W924 | First-run onboarding welcome carousel | ⬜ | Optional web first-visit welcome (dialog/hero), gated by a cookie/localStorage flag. Low priority |

## A — Authentication

| ID | Feature | Web | Migration note |
|---|---|---|---|
| A1 | Login | ✅ | `/login` |
| A2 | Register | ✅ | `/signup` |
| A-FP | Forgot / reset password | ✅ | `/forgot-password`, `/reset-password` |
| A-SO | Sign out | ✅ | profile + header dropdown |
| A-LANG | Language switcher (en/ps/fa) | ✅ | header locale switcher |

## B — Buyer: Browse & Discover

| ID | Feature | Web | Migration note |
|---|---|---|---|
| B1 | Browse (Bazaar) feed + infinite scroll | ✅ | `/bazaar` |
| B3 | Keyword search | ✅ | |
| B3b | Category filter chips + picker | ✅ | |
| B7 | Item-condition filter | ✅ | |
| B-PRICE | Price-range filter | ✅ | |
| B5 | Map location & distance filter | ✅ | Leaflet; ⚠️ GPS uses browser Geolocation, not `expo-location` |
| B-SORT | Sort: newest/oldest/price↑↓ | ✅ | |
| B931 | Sort: **Most viewed** | ⬜ | Add `mostViewed` sort option to `/bazaar` sort control + wire `sort` param |
| D583 | Sort: **Nearest first** | ✅ | Added `nearest` sort option on `/bazaar`; acquires a browser-Geolocation fix (denial/failure → friendly toast + clean fallback to default sort) and sends lat/long with `sort=nearest`. Reuses the existing `GET /listings` (Rails `sort=nearest`). Coords kept ephemeral/client-only (never in the URL) so reload falls back cleanly. 3 locales · RTL · dark |
| B617 | "Active sellers" filter (signed in ≤7d) | ⬜ | Add toggle chip to `/bazaar` filters; param already served |
| C481 | "Filters active (N) · Clear all" pill | ❓ | Verify the redesigned filter sidebar already shows an active-count + clear-all; add if missing |
| B4 | Saved searches / filter history | ✅ | |
| N612 | Saved-search "new matches" badge | ✅ | Badge + mark_seen on the browse saved-searches sidebar |
| B6 | "Seen / already viewed" indicator | ⬜ | Dim card + "Seen" badge from per-user `ListingView`; endpoint exists |
| B-VIEW | Grid / list view-mode toggle | ⬜ | Persisted grid↔list toggle on `/bazaar` |
| B-STATES | Feed states (skeleton/empty/error) | ✅ | |

## Categories

| ID | Feature | Web | Migration note |
|---|---|---|---|
| C736 | Categories hub (grid + live counts) | ✅ | `/categories` (also SEO landing pages) |
| S417 | Subcategory drill-down | ⬜ | Expand subcategories in the hub + a Bazaar subcategory filter |

## B2 — Listing Detail (buyer view)

| ID | Feature | Web | Migration note |
|---|---|---|---|
| B2 | Listing detail (increments views) | ✅ | `/listings/[id]` |
| B2-GAL | Image gallery carousel | ✅ | |
| B2-SELLER | Seller card → public profile | ✅ | |
| B2-PHONE | Seller phone reveal | ✅ | ⚠️ web = reveal + `tel:`/copy link, no native dialer |
| B2-MSG | "Message seller" CTA → first message | ✅ | |
| B2-OFFER | Make an offer (quick-amount chips) | ✅ | |
| B2-SAVE | Save-heart (optimistic) | ✅ | |
| G274 | Listing map snippet | ✅ | Leaflet |
| B173 | Similar-listings rail | ✅ | `/listings/:id/similar` |
| B7b | Condition badge | ✅ | |
| N804 | **Price-drop badge** (% drop ≤14d) | ✅ | Shared `price-drop-badge.tsx` (detail + card variants, success tone + TrendingDown). Shown on `/listings/[id]` and every `ListingCard` when `priceDropPercent` is present. Reuses `priceDropPercent`/`priceDroppedAt` (both nil outside the Rails 14-day `PRICE_DROP_WINDOW`) — no contract change; 3 locales; RTL + dark |
| N805 | **Seller response-rate badge** | ✅ | "Usually responds within…" trust row on listing detail seller card + `/sellers/[id]`. Shared `response-rate-badge.tsx`; reuses `:detailed` seller fields (seller page enriched via one listing detail fetch — kept off the `:list` view to avoid browse-feed N+1) |
| V259 | **Saved-by-N social proof** | ✅ | "Saved by N people" meta on `/listings/[id]`, shown only when N>0, HEART icon, styled like the views count. Uses `savesCount` already on the `:detailed` response (serializer `saves_count`, eager-loaded on `#show`) — no contract change. `savesCount` plural keys in en/ps/fa mirror the mobile wording; RTL + dark |
| N071 | Firm / negotiable badge (gates offer) | ✅ | Shared `firm-price-badge.tsx` (muted Badge + Lock, `listing.firmPrice`); shown on `/listings/[id]` beside the price and on every `ListingCard` when `negotiable === false`. `StartConversationButton` hides the Make-offer CTA + offer dialog when firm (`negotiable !== false` = negotiable default, mirrors mobile). Reuses the existing `negotiable` field (served on list/detailed views) — no contract change; 3 locales; RTL + dark |
| C3b | Expiry badge (owner detail) | ⬜ | 30-day countdown on owner's own listing detail |
| W628 | Seller "away" banner | ✅ | Shared `away-banner.tsx` ("Seller is away until [date]", `PlaneTakeoff`, primary/info tone). Shown on `/listings/[id]` (buyer, `seller.sellerAwayUntil`), `/sellers/[id]` (public profile, enriched from listing detail), and the seller's own `/profile` (`profile.away.youAreAway`). Guards past dates client-side; reuses `is_away`/`away_until` from the serializer — no contract change. 3 locales; RTL + dark |
| L824 | Shareable listing link | ✅ | Shared `share-button.tsx` (Share2 + `common.share`) in the `/listings/[id]` badge row, all statuses. Web Share API when available (localized `listing.share.body` "{title} — {price}" + page URL); otherwise copies `window.location.href` + `common.linkCopied` sonner toast (label flips to `common.copyLink` on desktop). No contract change; 3 locales; RTL + dark |
| B2-STATE | Detail states (skeleton/not-found/sold) | ✅ | |

## C — Seller: Listings & Lifecycle

| ID | Feature | Web | Migration note |
|---|---|---|---|
| C1 | Create / edit listing (sectioned form) | ✅ | `/listings/new`, `/listings/[id]/edit` |
| C1-PHOTO | Photo upload + reorder | ✅ | ⚠️ web = `<input type=file>`/drag-drop, not native camera |
| C1-CAT | Category picker | ✅ | |
| C1-PROV | Province picker | ✅ | |
| C1-DRAFT | New-listing draft autosave + restore | ⬜ | Persist unsent form to localStorage; restore/discard banner on reopen |
| C2 | My Listings (My Shop) + status tabs | ✅ | `/my-listings` |
| M826 | Per-status tab counts | ❓ | Verify counts on All/Draft/Active/Expired/Reserved/Sold tabs; add if missing |
| C2-* | Lifecycle: publish/reserve/sold/unpublish/delete | ✅ | full lifecycle on `/my-listings/[id]` |
| C3 | Expiry + **Renew** + Expired tab | ❓ | Renew action is ✅ (parity); verify the **Expired tab** + expiry badge exist, add if missing |
| C-DETAIL | Owner listing detail + manage | ✅ | |
| N802 | 7-day views sparkline analytics | ✅ | views chart on `/my-listings/[id]` |
| C-LCONV | Listing conversations (seller) | ✅ | `/conversations?listing=<id>` |
| W713 | Seller "away mode" (set away-until) | ✅ | Away-mode section in the `/profile/edit` shadcn form: checkbox toggle + native date picker (min=today). On save, away-on + date → `awayUntil = <date>T23:59:59Z`; away-off → `awayUntil: null`; away-on w/ no date → omit (mirrors mobile). Reuses `PUT /users/me` (`awayUntil`) via the existing `/api/me` allow-list — no contract change. Drives the W628 banner. 3 locales; RTL + dark |

## D — Chat

| ID | Feature | Web | Migration note |
|---|---|---|---|
| D1 | Conversations list (thumb/preview/unread) | ✅ | `/conversations` |
| D1-BADGE | Aggregate unread badge | ✅ | |
| K741 | Mark read/unread from the list | ✅ | Per-row kebab item on `/conversations`: "Mark as read" when unread, "Mark as unread" otherwise. Optimistic flip of the row's `unreadCount` (0/1) + rollback on error; invalidates the conversations list and refreshes the user so the header aggregate unread badge stays in sync. Reuses `PUT /conversations/:id/mark_read`·`/mark_unread` (added to the `/api/me` allow-list). Keys mirror mobile `chat.actions.markRead/markUnread/markReadError`; RTL + dark |
| A618 | Archive / unarchive conversation | ✅ | Inbox/Archived segmented toggle on `/conversations` + per-row kebab (Archive in inbox, Unarchive in archived). Optimistic row-removal + rollback on error; invalidates both partitions so the moved row lands on the other tab. Reuses `PUT /conversations/:id/archive`·`/unarchive` (added to `/api/me` allow-list) and `GET /conversations?archived=true`. 3 locales (keys mirror mobile `chat.tabs`/`chat.archive`); RTL + dark |
| D2 | Conversation thread (bubbles, RTL) | ✅ | `/conversations/[id]` |
| D2-READ | Read receipts (double-tick) | ❓ | Verify read receipts render on web; add from `readAt` if missing |
| D2-CABLE | Real-time updates (ActionCable) | ✅ | ports directly — web already uses `@rails/actioncable` |
| D3-MEET | Meetup propose + accept/decline | ✅ | |
| D3-OFFER | Offer accept/decline | ✅ | |
| O829 | Counter-offer | ✅ | Seller counters a buyer's offer with a new price from the thread. A "Counter" outline button shows on the buyer's original `offer` bubble only to the seller when it's unanswered; opens a shadcn dialog seeded with the buyer's amount. Sends an `offer_counter` message (same kind mobile uses) reusing the pipe-encoded `amount\|currency\|listedPrice` body over the existing `POST /conversations/:id/messages` — no contract change. Counter bubbles render with the ArrowLeftRight icon + `counterLabel`/`counteredAt` on both sides, and support accept/decline like a normal offer. 3 locales · RTL · light/dark |
| G083 | Offer quick-amount chips | ✅ | Make-offer dialog shows 95/90/85% chips (`shared/offer-quick-chips.tsx`, same `computeChipAmount` as mobile); tap fills the amount without sending, matching chip highlighted, hidden when price is 0/null. Reusable for the in-thread counter composer |
| M482 | In-chat photo/file messages | ✅ | web file upload (photo + document) |
| M913 | **Delete / retract message** (tombstone) | ✅ | Own-message delete behind confirm-dialog; optimistic tombstone + rollback; live flip over ActionCable. Reuses `DELETE /conversations/:id/messages/:id` |
| Q374 | Quick-reply presets | ✅ | Localized canned-phrase chips above the composer on `/conversations/[id]` (shared `quick-replies.tsx`). Buyer/seller phrase set chosen by whether the current user is the listing seller; tapping a chip appends the phrase to the draft (space-separated) and focuses the input — no auto-send. Reuses the mobile `chat.quickReplies.*` keys verbatim in en/ps/fa; hidden on a closed conversation; RTL + dark. No API/contract change |
| C739 | Composer draft persistence (per-convo) | ✅ | Unsent composer text on `/conversations/[id]` persists to a per-conversation localStorage key (`hatiwal.chat.draft:<id>`) via `use-composer-draft.ts` (web port of mobile's `useComposerDraft`): hydrates on open/switch, debounced ~400ms write (flushed on navigate-away), key removed on clear/successful send. Disabled for closed conversations; localStorage failures (private mode) degrade to in-memory. No API/i18n change |
| N803 | **Message search within thread** | ✅ | Header search toggle expands an input; filters loaded messages (text, non-deleted, case-insensitive), highlights matches, shows "X of Y" + loaded-only note. Client-side; RTL + dark |
| F084 | Lifecycle actions from chat header | ❓ | Verify seller can Reserve/Mark-sold from the pinned listing header |
| D2-BLOCK | Block / unblock in thread | ✅ | |
| R483 | Report participant from thread | ⬜ | Web has report on detail/profile; add the report affordance inside the thread header |
| D2-CLOSED | Closed-conversation state | ❓ | Verify input is disabled with a notice when a conversation is closed |

## E — Saved / Favorites

| ID | Feature | Web | Migration note |
|---|---|---|---|
| E1 | Saved list (grid + infinite scroll) | ✅ | `/saved` |
| E1-TOGGLE | Save/unsave consistency everywhere | ✅ | |
| V836 | Recently viewed (`my/viewed_listings`) | ⬜ | Re-engagement page of listings the buyer viewed |

## F — Profile & Account

| ID | Feature | Web | Migration note |
|---|---|---|---|
| F1 | My profile (stats, entry points) | ✅ | `/profile` |
| F1-MODE | Buyer / seller mode toggle | ✅ | |
| F1-THEME | Theme toggle (light/dark) | ✅ | |
| F2 | Edit profile (+ avatar upload) | ✅ | `/profile/edit` |
| F2-LOC | Profile map location | ✅ | ⚠️ browser Geolocation for "use my location" |
| F3 | Public seller profile | ✅ | `/sellers/[id]` |
| F742 | Seller **sold-items showcase** tab | ✅ | Active/Sold segmented control on `/sellers/[id]` (`seller-listings-tabs.tsx`). Active grid is server-rendered; Sold grid lazy-loads via TanStack Query on first Sold-tab open, reusing the guest-accessible `GET /users/:id/sold_listings` (same endpoint mobile uses) — no contract change. Sold cards show a dimmed status badge; empty state when none; 3 locales; RTL + dark |
| V613 | **Verified seller badge** | ✅ | Shared `verified-badge.tsx` (BadgeCheck, `common.verified` title, `text-primary` token) reused via `UserIdentity` at all three sites — listing detail seller card (`/listings/[id]`), public seller profile (`/sellers/[id]`), and conversation thread header. Driven by the existing `verified` boolean on the User payload; no contract change. 3 locales · RTL · dark |
| A356 | "Active recently" label | ⬜ | Privacy-safe last-active label on public profile |
| S392 | Shareable seller-profile link | ✅ | Same shared `share-button.tsx` in the `/sellers/[id]` profile header row (beside Report), body `seller.share.body` ("Check out {name} on Hatiwal", mirrors mobile `profile.share.body`). Web Share API → native sheet; fallback copy-link + toast. 3 locales; RTL + dark |
| B047 | Blocked-users management | ✅ | `/settings/blocked-users` |

## G — Safety, Reporting & Moderation

| ID | Feature | Web | Migration note |
|---|---|---|---|
| G1 | Report listing / user (6 reasons) | ✅ | from detail + seller profile |
| R612 | Report → block follow-up | ⬜ | After a report, offer to block the reported user |
| R739 | "My Reports" status screen | ⬜ | See your submitted reports + their outcome |
| G-WARN | Moderation warnings banner | ✅ | profile warnings banner |
| G-BLOCK | Block / unblock user | ✅ | |

## Cross-cutting / Polish

| ID | Feature | Web | Migration note |
|---|---|---|---|
| P1 | Animation system | ❓ | Web transitions differ (CSS/Framer). Match spirit, not RN Reanimated 1:1 |
| D094 | Contextual empty-state illustrations | ⬜ | Port the per-section empty illustrations (Browse/Saved/Chat/My-Shop) |
| T702 | Persistent data cache | ❓ | Web uses TanStack Query; add a persister only if data-loss on reload is a real issue |
| S0 | Shared component library | ✅ | Web has its own shadcn/ui equivalents |

---

## 📱 Mobile-only — do NOT port 1:1

| ID | Feature | Why / web equivalent |
|---|---|---|
| N801 | Push-notification token registration | `expo-notifications` device tokens. Web = Web Push / service workers (separate rebuild, not a port) |
| C1-PHOTO / M482 | Native camera capture | Web uses `<input type=file>` / drag-drop (the *upload* itself is ✅ on web) |
| B5 / F2-LOC | Device GPS permission | Web uses the browser Geolocation API (different permission model) |
| B2-PHONE | Tap-to-call dialing | Web = `tel:` link / copy number |
| P1-haptics | Haptic feedback | No web equivalent (no-op) |
| L824 / S392 | Native share sheet | Web = Web Share API / copy-link |
| A-store | Secure token storage (Keychain) | Web = httpOnly cookies (already implemented) |
| Q3 / Q5 | iOS/Android platform guards + device test matrix | Native-only concern |
| T701 | Maestro Android E2E CI | Web = Playwright/Cypress instead |

---

## Migration work queue (the ⬜ gaps → `web` board tasks)

Prioritized. Each becomes a `type: web` card on `hatiwal-mobile/docs/SPRINT_BOARD.md` for the software
house. **First batch seeded** = the recent post-audit features with the clearest user value:

**P1 — recent features users already have on mobile**
- ~~`WEB-M913` Delete/retract chat message → tombstone~~ ✅ shipped
- ~~`WEB-D583` Nearest-first sort on Bazaar~~ ✅ shipped
- ~~`WEB-V259` Saved-by-N social proof on listing detail~~ ✅ shipped
- ~~`WEB-N803` In-thread message search~~ ✅ shipped
- ~~`WEB-N804` Price-drop badge~~ ✅ shipped
- `WEB-N805` Seller response-rate badge

**P2 — trust & seller tooling**
- ~~`WEB-V613` Verified seller badge~~ ✅ shipped · ~~`WEB-F742` Sold-items showcase~~ ✅ shipped · `WEB-A356` Active-recently label
- ~~`WEB-W713`/`WEB-W628` Seller away mode + banner~~ ✅ shipped · `WEB-N071` Firm/negotiable badge · `WEB-C3b` Expiry badge

**P2 — chat depth**
- ~~`WEB-O829` Counter-offer~~ ✅ shipped · ~~`WEB-K741` Mark read/unread from list~~ ✅ shipped · ~~`WEB-A618` Archive conversation~~ ✅ shipped
- ~~`WEB-Q374` Quick-reply presets~~ ✅ shipped · ~~`WEB-C739` Composer draft~~ ✅ shipped · `WEB-R483` Report from thread

**P3 — discovery & re-engagement**
- `WEB-B931` Most-viewed sort · `WEB-B617` Active-sellers filter · `WEB-B6` Seen indicator
- `WEB-B-VIEW` Grid/list toggle · `WEB-S417` Subcategory drill-down · `WEB-N612` Saved-search new-match badge
- `WEB-V836` Recently viewed · `WEB-C1-DRAFT` New-listing draft autosave · `WEB-D094` Empty illustrations
- `WEB-R612` Report→block follow-up · `WEB-R739` My Reports screen · `WEB-W924` First-visit welcome

**Verify-first (❓ — confirm the gap before building):** `C481`, `M826`, `C3` Expired tab, `D2-READ`,
`G083`, `F084`, `D2-CLOSED`.

> Housekeeping: as each `web` task ships, flip its row above from ⬜ to ✅ and update
> `../../docs/MOBILE_WEB_PARITY.md` so the two docs never drift.
