# Bazaar feed + filters (`/[locale]/bazaar`) — design note (web UI/UX QA, 2026-10-15)

## Problem (before)
On a 390px phone the feed spent ~240px on controls before the first photo, in **three rows**:
`Filters` alone; then count + sort + grid/list; then "Showing items near Kabul · Change".

## References (Mobbin, web)
- **Etsy — search results** — https://mobbin.com/screens/72bcca52-c3f3-47f5-a7fa-183224b7d319
  Filters button, chips and sort share one bar above the grid.
- **Shop — results** — https://mobbin.com/screens/76e1e24b-9efd-472e-a506-e0611e3d54c6
  A single control row (filter icon + chips + "Sort by") and the grid immediately below.
- **Nextdoor — For Sale & Free** — https://mobbin.com/screens/d127f4e3-0672-49a8-a118-4f56c99f34de
  One filter row, then photos; context (distance, place) lives on the cards and one line.
- **GetYourGuide — filtered results** — https://mobbin.com/screens/4ebadf67-c73b-4200-88f8-ca3948e3e9e7
  Active filters shown as a count on the Filters control.

## Decisions
1. **One control row on phones:** `Filters (n)` at the start, sort + grid/list at the end. The
   Filters button moved out of its own row into the results toolbar (`lg:hidden`); the panel still
   opens in the same place.
2. The sort `<select>` is **capped at 8rem below `sm`** — measured: in fa the row was 359px in a
   358px box and wrapped. The open option list is unaffected. 320px still has no sideways scroll.
3. The **result count is desktop-only** (it keeps `data-testid="results-count"`). On phones the
   place line ("near Kabul · Change") carries the context — putting the count beside it truncated
   the place name, which matters more.
4. Desktop is unchanged (sidebar filters + its own wide search, as documented in the component).
Result: three control rows → two on phones; the first photo row moves up by ~52px.
