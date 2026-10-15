# Listing detail (`/[locale]/listings/[id]`) — design note (web UI/UX QA, 2026-10-15)

## Problem (before)
- **Desktop:** the right column read price/title → a 190px map → the seller card → *then* Contact
  Seller, at ~y=470 of a 900px screen. The description sat in a full-width row under both columns,
  leaving a tall empty strip under the gallery.
- **Phones:** "Copy link" took a row of its own above the price; the description came last, after
  the map and the seller card.

## References (Mobbin, web)
- **Depop — item page** — https://mobbin.com/screens/a52ff1a4-d55a-48d6-a79d-6ec38439bd52
  Title, price, condition, then ONE primary action; trust lines; description; all in the right
  column next to the photos.
- **Depop — seller card** — https://mobbin.com/screens/77ad128d-c483-4d18-a7ea-f7ba88c2e1d7
  The seller (rating, sold count, "Active today", Visit shop / Ask) comes after the buy box.
- **Etsy — listing with offer** — https://mobbin.com/screens/a8c44b03-27fd-4b67-be52-1adfe01cfe4b
  Price + "Make an offer" sit at the top of the right column; gallery thumbnails on the left.
- **Etsy — shop item page** — https://mobbin.com/screens/84676590-31e7-4341-871f-bb0f3c3383cc
  Price, primary button, share links, then details.

## Decisions
1. **Buy box first.** Right column order: badges → price (+ Share at the row's end) → title → meta →
   owner bar → **Contact / Offer / Save** → safety + "Not interested" → seller card → location.
   Contact Seller on desktop: ~y=470 → ~y=167.
2. **Description under the gallery on desktop** (grid: gallery row 1 / description row 2 in the left
   column; the right column spans both rows). No more empty strip under the photos.
3. **Phones: description before the map.** The right column is `display: contents` below `lg`, so
   its two halves are ordered around the description with `order-*`: gallery → buy box →
   description (+ Report) → seller → location.
4. **Share beside the price**, not on its own row. The badge row is `empty:hidden`, so a listing
   with no badges no longer leaves a gap.
5. Unchanged on purpose: the sticky phone CTA bar (`#listing-actions` / `#listing-price` sentinels
   kept), SAFETY-1 approximate-area map, owner gating, every claim (rating, reply rate) comes from
   the API as before.
