# Shop page + seller profile — design note (web UI/UX QA, 2026-10-15)

## Problem (before)
- **Shop, phones:** the actions wrapped as `Message shop` + `Directions`, then `Share this shop` alone
  on a second row — and for a buyer, Share was a second solid-blue primary competing with Message.
- **Seller profile, phones:** the "Joined" stat broke into two lines ("October" / "2026") beside the
  one-line listings count.

## References (Mobbin, web)
- **Etsy — shop header** — https://mobbin.com/screens/fa81f8d2-e8c2-4c5d-99db-6cc44fcd1e92
  Logo, name, verified mark, location, one stats line; ONE primary action (Contact), the others quiet.
- **Etsy — shop with items** — https://mobbin.com/screens/fcf42f3a-197e-4941-9e4c-02cb7961266a
  Items / Reviews / About tabs under the identity row; the grid follows.
- **Depop — seller card** — https://mobbin.com/screens/77ad128d-c483-4d18-a7ea-f7ba88c2e1d7
  Stats on single lines (rating, sold, last active).

## Decisions
1. **One primary per viewer.** Buyer: `Message shop` (primary, full width on phones), `Directions` /
   `Call` / `Share` outline and paired underneath. Member: no Message (it's their shop) and Share stays
   primary — sharing is their main action here. Share remains a labelled button (owner, 2026-10-08:
   no icon-only share).
2. Phones: `grid grid-cols-2` with Message spanning both columns; `sm+`: one row, as before.
3. Seller "Joined" value is `whitespace-nowrap`.
Not changed: the cover/logo/tabs structure (mobile parity), the "Verified shop" line (trust signal).
