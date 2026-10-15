# Search results (`/[locale]/bazaar?q=…`) — design note (web UI/UX QA, 2026-10-15)

## Problem (before)
- A search did not name itself: the term sat only inside the search box, so "samsung" results read
  exactly like the plain feed.
- No results was a dead end: "No listings found — Try changing your search or filter." with no
  action and nothing to browse.

## References (Mobbin, web)
- **Dribbble — "Results for card"** — https://mobbin.com/screens/d762742e-e14e-4207-92df-7fa868424f21
  A visible results heading with the query, above the filter row.
- **Etsy — search results** — https://mobbin.com/screens/72bcca52-c3f3-47f5-a7fa-183224b7d319
  The query stays visible; filters and sort in one bar.
- **GetYourGuide — zero results** — https://mobbin.com/screens/4ebadf67-c73b-4200-88f8-ca3948e3e9e7
  "No results" is followed by somewhere to go ("Go beyond Paris") instead of ending the page.

## Decisions
1. **"Results for “samsung”"** heading above the toolbar whenever `q` is set
   (`browse.resultsFor`, en/ps/fa/ur). The page's sr-only `<h1>` (Bazaar) is unchanged.
2. **Empty results lead somewhere:** the empty state gets **Clear all** (the existing reset, which
   also clears the term) when a search or filter is active, and the **category pill row** below it
   — the same shared `CategoryPills` as the home page (no second copy of that markup).
3. Same component as the Bazaar, so the one-row phone toolbar (docs/design/bazaar.md) applies.
