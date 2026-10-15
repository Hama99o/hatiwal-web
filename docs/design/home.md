# Home (`/[locale]`) — design note (web UI/UX QA, 2026-10-15)

## Problem (before)
At 390×844 the first listing photo sat ~1,400px down: a tall hero (title, subtitle, a second search
box duplicating the header's), then **12 category tiles in a 2-column grid (6 rows)**, then listings.
On a marketplace the first screen should already be selling. The subtitle also promised
"thousands of items near you" — production lists a few dozen, so the claim was false.

## References (Mobbin, web)
- **Nextdoor — For Sale & Free feed** — https://mobbin.com/screens/d127f4e3-0672-49a8-a118-4f56c99f34de
  Photos start right under a single filter row; price first, then title, then muted meta.
- **Airtasker — Browse by category** — https://mobbin.com/screens/bb11b816-59a7-4f9f-a5de-af8fc537b0a9
  Categories as compact icon + label pills, not tiles; scrolls sideways when there are many.
- **Shop — home** — https://mobbin.com/screens/b58686eb-e5e0-4f84-89e9-2a91d8f45711
  One horizontal pill row of categories above product rails.
- **Faire — welcome** — https://mobbin.com/screens/f6352ef8-0262-4a31-9a20-c0f2383d7f91
  A short, single-line welcome; the products carry the page.
- **GetYourGuide — home search** — https://mobbin.com/screens/1bed7b75-efa7-4006-858c-52750403d67f
  One search, given the width.

## Decisions
1. **Compact hero.** Smaller type on phones (`text-3xl`), half the padding. One honest sentence
   ("Find a deal, message the seller, and meet in person.") — the "thousands" sentence is removed in
   en/ps/fa/ur rather than re-translated.
2. **No duplicate search on phones.** The header already has a full-width search row below `md`.
   On phones the hero shows two actions instead — **Explore the Bazaar** (primary) and
   **New Listing** (outline; `/listings/new`, which sends a guest to login and back). From `sm` up
   the hero keeps its search form (wide field, Airtasker/GYG style).
3. **Categories → one pill row** (Airtasker/Shop): icon + name, 44px tall, scrolls sideways on phones
   (edge-to-edge, no scrollbar), wraps on desktop. A "View all" link goes to `/categories`.
   All top-level categories are shown, not the first 12.
4. **Listings move up.** With 2 and 3 above, the first listing row is on the first phone screen.
   Section rhythm tightened (`space-y-10`, `py-8`).
5. Brand kept: blue primary for the main action, gold stays in the logo. RTL: the pill row uses
   logical spacing (`ps/pe`) and scrolls from the start edge.
