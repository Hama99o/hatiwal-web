# Buyer ↔ Seller mode and shop context — design note (web UI/UX QA, 2026-10-15)

Owner: *"I want the same system as mobile, like the switch system to separate things well, and for
shops also."*

## How mobile does it (mobile release-1.1.7, read-only study)
- **Mode** — `useModeStore` (`src/stores/mode.store.ts`), persisted on the server as
  `users.seller_mode` (`PUT /users/me`). Switched from Me (`Profile.tsx` mode toggle); with no shop
  but pending invitations, the invitations open first.
- **Navigation follows the mode** (`app/(main)/(tabs)/_layout.tsx`): Buyer = Bazaar · Categories ·
  Saved · Chats · Me; Seller = **My listings** (or **My shop** when selling as a shop) · Chats · Me.
  Categories and Saved are hidden while selling.
- **Seller accent** — emerald `colors.seller` (`hsl(160 84% 39%)` / dark `hsl(160 70% 45%)`) on the
  tab bar and the mode toggle.
- **Shop context** — `users.active_shop_id` on the server (`PATCH /users/me/selling_as`), checked
  on every read (`User#selling_shop`, `User#sell_as!`: the shop must be active and the user a member).
  `SellingAsPill` on My listings and Chats; roles owner / manager / staff
  (`lib/shopPermissions.ts`, server `ShopPolicy`).

## What the web had
The shop context layer already existed (`use-selling-identity.ts`, `SellingAsPill`, "Replying as",
team page, the same permission matrix). What was missing was the **separation**:
no seller accent; the header showed Bazaar + Categories in both modes; the seller links were
`sm+` only (phones had them only inside the avatar menu); the mode could only be switched on
`/profile`; and the avatar menu mixed buying and selling items (Saved next to My listings).

## References (Mobbin, web)
- **Etsy — Shop Manager** — https://mobbin.com/screens/dfbf0a4b-301c-4360-8388-e34926aaad50
  Selling has its own navigation, separate from shopping; the shops ("sales channels") are listed
  for switching.
- **Airbnb — header with "Become a host"** — https://mobbin.com/screens/c14249fe-5d03-40b3-9cb7-edbeaacaafca
  The switch to the selling side is one click from the header / account menu, on every page.
- **Slack — workspace list** — https://mobbin.com/screens/e7908004-fe36-4773-9b2f-a61122692bb0
  Identities you can act as, each with its own row and avatar; the current one is marked.

## Decisions (implemented)
1. **`--seller` token** (`globals.css`, = mobile's `colors.seller`). Used as an accent only — a 3px
   bar on the header while selling, the active "My listings" link, the Seller icon in the menu —
   never as small text on white (contrast).
2. **Mode-aware header** (`layout/mode-nav.tsx`):
   - Buyer / guest: Bazaar · Categories (unchanged).
   - Seller: **My listings / My shop** · the shop's own page (when selling as a shop, lg+) ·
     **+ New Listing**. The Bazaar link is gone while selling, as on mobile.
   - Phones: the header's second row is the search in Buyer mode and the **selling shortcuts**
     (My listings / My shop, + New Listing) in Seller mode.
3. **Account menu** (`layout/auth-nav.tsx`): a *Buyer / Seller mode* section (✓ on the current one)
   at the top — the same `useModeSwitch` hook as the Profile toggle (persist, land on the matching
   home, invitations first), so the two can never drift. In Seller mode with an active shop, a
   **Sell as** list: Me + every **active** shop with the user's **role** (Owner / Manager / Staff),
   ✓ on the current identity. Picking one calls `PATCH users/me/selling_as`; the server decides
   (a refusal shows `shops.removedNotice` and refreshes `me`). Buyer mode shows no shop list (owner
   rule 2026-10-05: buying is always personal). Items follow the mode: Buyer — Saved; Seller — My
   listings, New Listing, and **Team** for the current shop (every member may see it,
   `ShopPolicy#team?`).
4. The "Selling as" pill is **not** repeated in the header: My listings and Chats keep their own
   (where mobile has it), and the menu has the list on every page.
5. No new API: everything uses `seller_mode`, `selling_as_shop`, `shops[].role/status` and the two
   existing endpoints.

## Gaps found, not built (reported)
- The header chat badge reads `user.unreadMessageCount` (all identities); mobile scopes the Chats
  badge per identity (`unreadFor` / `unreadBuying`). Worth a follow-up.
