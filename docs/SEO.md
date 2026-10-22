# SEO — hatiwal.com

Written 2026-10-12, branch `seo-1.1.7`. Starting point: about 2 months live,
Search Console showed 427 pages indexed, 219 not indexed, 0 clicks, and a
search for "hatiwal" did not show the site. Bing answered "hatiwal" with
"Hatwal" (a surname): search engines read the brand as a misspelling.

## What changed in the code, and why

| Change | Why |
|---|---|
| Home `<title>` names the brand in each script: `Hatiwal — Buy and sell locally in Afghanistan`, `هټیوال (Hatiwal) — …`, `هتیوال (Hatiwal) — …`. og:title, twitter:title, og:url and og:locale match. | All three were a bare `Hatiwal`. Nothing on the page tied the name to the Pashto/Dari spelling or to what the site is. New key `home.brandName` in all 4 locale files. |
| Home JSON-LD: `Organization` (name Hatiwal, alternateName `هټیوال`, `هتیوال`, logo, sameAs = Google Play + App Store) and `WebSite` with a `SearchAction` to `/<locale>/bazaar?q=…`. | Brand signals for the knowledge panel. No social profiles listed because there are none yet; add them to `homeJsonLd` in `src/lib/seo.ts` once they exist. Google stopped showing the sitelinks search box in 2024, so the SearchAction is valid markup with no visible effect. |
| Layout no longer sets a canonical. | Every page without its own canonical inherited `https://hatiwal.com/en`: /login, /signup, /saved, /profile, /conversations, /listings/new… all told Google "I am a copy of the home page" (measured on production). |
| Sign-in and account pages are `noindex, follow` (one small `layout.tsx` per segment). | Nothing there for a searcher; they were counted as duplicates. |
| Empty categories are `noindex` and left out of the sitemap. Subcategories with stock are added to it. | A page that says "nothing here" is a soft 404. On 2026-10-12, 5 top-level categories (sports, bags, kids, gemstones, jobs) were empty in all 3 languages. |
| Sitemap entries carry their hreflang set (en/ps/fa + x-default). /privacy added. | Same set the pages declare. Urdu is hidden, so it appears nowhere. |
| `/ur/*` → `/en/*` is now a 301 (was 307). Separate commit, can be cherry-picked onto 1.1.6. | Google keeps a URL that redirects temporarily in its index. /ur/categories/mens-clothing still had impressions. |
| `/users/:id` and `/browse` redirect with 308 (was 307). | Old aliases. A permanent redirect hands their signals to the real page. |
| Listing `Product` JSON-LD: only on listings that have a photo and a price; adds `url`, `offers.url`, `itemCondition`, the shop as `seller`; `<` escaped. | See "Merchant listings" below. The escaping stops a listing title containing `</script>` from breaking out of the tag. |

## Merchant listings: 7 valid / 31 invalid

Measured on production: 41 of 54 listings have **no photo** (many are test
listings, e.g. "Car test"). Google requires `image` for a merchant listing,
so each of those is an **error** ("Missing field image"). This is what makes
them invalid. Price, currency (AFN/PKR/USD) and availability were present on
all of them.

Fix: a listing without a photo now emits no Product markup. A placeholder
picture would not show the real item. Those listings drop out of the report;
the ones with photos stay valid.

Shipping and returns (1.1.7) are declared as what they are, not left out:

- `shippingDetails`: `OfferShippingDetails` with `doesNotShip: true` and the
  sale country (`AF`, or `PK` for a PKR listing). Buyers meet the seller.
  Google's merchant-listing page lists only `shippingRate` + `shippingDestination`
  for offer-level shipping; `doesNotShip` is documented on its shipping-policy
  page (`ShippingConditions`), where `shippingRate` is dropped when it is true.
  So this warning may not clear in every validator: check it in the Rich
  Results Test once deployed.
- `hasMerchantReturnPolicy`: `MerchantReturnPolicy` with
  `returnPolicyCategory: MerchantReturnNotPermitted` and `applicableCountry`
  (both required by Google; no `merchantReturnDays` needed for this category).

Google will still show these as **warnings**, which do not make a page invalid:

- `brand`, `gtin`, `aggregateRating`: we don't have this data.

Making those up would be false structured data, which Google can penalise.

## "Why pages aren't indexed": what each reason means here

| Reason (count) | Harmless? | What it is / what we did |
|---|---|---|
| Page with redirect (94) | **Mostly harmless.** | URLs that redirect elsewhere: `/` → `/en`, `http://` → `https://`, `www.` → apex, share links `/l/<id>` → `/listings/<id>` → `/en/listings/<id>`, `/ur/*`, `/browse`, `/users/<id>`. Google lists every redirecting URL it finds; the target is what gets indexed. The sitemap holds no redirecting URLs (all 225 answered 200). Made `/ur`, `/browse`, `/users` permanent. |
| Alternate page with proper canonical tag (70) | **Harmless, and expected.** | ps/fa versions linked by hreflang, and `/bazaar?q=…` / `?category=…` / `?page=…`, which point to `/bazaar`. Some of it was the account pages pointing at the home page; those are noindex now. |
| Duplicate without user-selected canonical (33) | **Worth fixing; part of it was ours.** | Pages that Google saw as duplicates with no canonical of their own. The URL list in Search Console shows which ones. Likely causes: account pages (now noindex), legacy-host/www copies from before the www redirect (6 Oct), and listing pages that are the same in all 3 languages because the seller wrote in one. *Inferred, not measured.* |
| Duplicate, Google chose different canonical than user (11) | **Mostly harmless.** | Likely ps/fa listing pages whose text is the same as /en (seller's own words). Google can pick /en; hreflang still serves the right language. Account pages that said "canonical = home" are fixed. |
| Crawled – currently not indexed (8) | **Normal for a new site.** | Thin pages (photo-less test listings, empty pages). Real listings with photos and text get indexed over time. |
| Soft 404 (2) | **Was ours.** | Empty category pages. Now noindex and left out of the sitemap. |
| Not found (404) (1) | **Harmless.** | A deleted listing. |

The old host `hatiwal.multimagics.com` still ranks for "hatiwal" in Google.
**The owner decided on 2026-10-12 to leave the old host dead; its results
drop out of Google over time.** No redirect and no DNS record for it.

## Owner checklist (things only you can do)

After this branch is deployed:

1. **Search Console → URL inspection** → paste `https://hatiwal.com/en` →
   **Request indexing**. Do the same for `/ps` and `/fa`.
2. **Search Console → Sitemaps** → resubmit `https://hatiwal.com/sitemap.xml`.
3. **Performance → Search results**: turn on Impressions and look at **Queries**
   that contain "hatiwal" or "هټیوال". Impressions come before clicks: if
   "hatiwal" shows impressions, the site is ranking and needs more brand signals.
4. **Pages → "Why pages aren't indexed"**: open each reason and look at the
   example URLs. Send us any URL that should be indexed but isn't.
5. **Shopping → Merchant listings**: click **Validate fix** once deployed.
6. **Delete the test listings** in production ("Car test" and others without
   photos). They are thin pages that weaken the site.

Off-site brand signals (these matter most for a new name):

7. **Google Play Console → Store settings → Website**: `https://hatiwal.com`.
   **App Store Connect → App information → Marketing URL**: `https://hatiwal.com`.
8. Create the social profiles (Facebook, TikTok, Instagram, YouTube) with
   the name "Hatiwal — هټیوال" and a link to `https://hatiwal.com`. Tell us
   the URLs so we can add them to `sameAs` in the Organization JSON-LD.
9. Optional: a **Google Business Profile**, if Hatiwal has a real office
   address people can visit. Do not create one without an address.
10. Link to hatiwal.com wherever you talk about Hatiwal (WhatsApp channels,
    TikTok bio, partner sites).

Be patient: a new brand name usually takes **several weeks** to rank, even
after everything above is done. Check Performance once a week.

---

# seo-1 (2026-10-22, branch `seo-1`, off `release-1.1.8`)

Starting point (Search Console, 2026-10-16): **383 indexed, 308 not indexed**.
Page with redirect 113 · Alternate page with proper canonical 69 · Duplicate
without user-selected canonical 34 · Discovered, not indexed 42 · Not found
(404) 18 · Google chose different canonical 17 · Crawled, not indexed 9 ·
Excluded by noindex 4 · Soft 404 2.

## What production looked like (measured 2026-10-22, read-only GETs)

| Check | Result |
|---|---|
| The 135 sitemap URLs | All **200**, all self-canonical, none noindex. Nothing to fix in the sitemap itself. |
| `/` | **307** → `/en` (next-intl's default). `/bazaar`, `/listings/1` (locale-less) also 307. `/ps/` → `/ps` was already 308. |
| `/en/bazaar?q=…`, `?category=…`, `?province=…`, `?sort=…`, `?page=2` | All 200, all canonical → `/en/bazaar`, all indexable. The `?q=` / `?category=` / zone URLs render DIFFERENT results (SSR applies the filters), so a canonical to `/bazaar` is a claim Google can reject: this is the likely source of "Google chose different canonical" (17). |
| `/en/categories/electronics?sort=…&page=2` | Canonical → clean URL. Correct: the category page ignores its params (same HTML). |
| Listing ids 1–260 | 229 → **404** (deleted: a real 404, correct), 20 live, **11 sold → 200, indexable**, still "for sale" pages for an item nobody can buy (soft-404 / crawled-not-indexed material). |
| Seller ids 1–80 | 58 profiles → 200, **all indexable**, most with no listings and no reviews: a name and a join date. Unknown ids → 404. |
| Shop ids 1–80 | 3 shops → 200; the rest → 404. |
| Unknown listing / seller / shop / category / path | Already a real **404** (no 200 "not found" anywhere). |
| The noindex pages | Login, signup, forgot/reset password, email-confirmed, saved, conversations, my-listings, analytics, settings, profile/*, recently-viewed, shop edit/new/verify, join/<token>, empty categories. All intentional (account pages, or "nothing here"). `/delete-account`, `/privacy`, `/prohibited-items` are public and indexable on purpose (the stores require them). No public page was noindex by mistake. |
| Internal links on home, Bazaar, categories, a listing | No query-string links in the SSR HTML: the duplicate query URLs come from the client-side filter chips and from shared links, not from crawlable `<a href>`s. |

The 18 "Not found (404)" are mostly deleted listings and are **correct**:
Google drops them by itself. The 113 "Page with redirect" are, as before,
`/` → `/en`, http → https, www → apex, `/l/<id>` share links, `/ur/*`.

## What changed

| Change | Google-recommended because |
|---|---|
| `/` and every locale-less path now answer **308** (was 307) to the reader's locale, with `Cache-Control: no-store` and `Vary: Accept-Language, Cookie` (`src/middleware.ts`). | A permanent redirect passes signals and drops the source URL; `no-store` keeps locale detection live for people (a 308 is otherwise cached forever by browsers, so a reader who switches language would be stuck). Googlebot sends no Accept-Language/cookie, so it always gets `/` → `/en`, which is the `x-default`. |
| **Bazaar search and filter URLs** (`q`, `category`, `condition`, `min`, `max`, `lat`/`lng`/`radius`, `active_sellers`, `shops`, `guests`, `amenities`) are `noindex, follow` with **no canonical and no hreflang**. `sort`, `page` and tracking params keep the canonical to the clean `/bazaar` and stay indexable (`isFacetedSearch`, `src/lib/seo.ts`). | Google's guidance for internal search results and faceted navigation: keep them out of the index; `follow` keeps the listings they link to discoverable. noindex plus a canonical to another URL are conflicting signals, so the canonical is dropped there. The landing pages for searchers are the category and city pages, which are clean URLs. |
| **Sold or expired listings**: still **200** (the buyer's chat, the review and the seller's share link open them, and they show similar items), but `noindex, follow`. Removed / unknown listings stay a real **404**. | A page for an item that can no longer be bought is what Google files as a soft 404. noindex takes it out cleanly without breaking the page for the people who still need it. See "Owner decisions" for the 410 alternative. |
| **Seller profiles with no listings and no reviews** are `noindex, follow`; they are indexed again as soon as they have a listing or a review. | Thin page, and it put private people's names in search results for no buyer's benefit. |
| Every 404 page (listing, seller, shop, any unknown path, unknown city) links to the **Bazaar and the categories**. The generic 404's button went to `/` (a redirect); it now goes to `/bazaar`. | A real 404 with a way on, as Google recommends for removed content. |
| **MobileApplication JSON-LD** on `/` (beside Organization + WebSite) and `/download`: name + both native spellings, `operatingSystem: "Android, iOS"`, `applicationCategory: ShoppingApplication`, free `Offer`, both store URLs as `downloadUrl`/`installUrl`, `inLanguage: en, ps, fa`, icon as `image`, publisher = the Organization. | **No `aggregateRating`**: we have no real rating data in hand, and invented ratings are a manual-action risk. Google shows the software-app rich result only with a rating, so this is valid markup that earns no stars until real ratings are added. No `screenshot`: store screenshots are not in this repo. |
| **New pages**, en/ps/fa, each self-canonical with the full hreflang set, its own title + description, in the sitemap and linked from the footer of every page: `/how-to-sell`, `/buy-safely`, `/cities/kabul`, `/cities/herat`, `/cities/kandahar`, `/cities/mazar-i-sharif`, `/cities/jalalabad`. | Content a searcher actually types ("how to sell in Kabul", "buy and sell Herat", "هټیوال"). Each claim is one the product makes: the numbers on the sell guide come from the constants the product enforces (`MAX_LISTING_PHOTOS` = 8 = `Listing::MAX_IMAGES`, `MAX_VIDEO_DURATION_S` = 60, `MAX_SHOP_PHOTOS` = 5); the buy guide's meeting checklist is the app's own `safety.tips`. |

City pages: each city is its province's capital, at the coordinates in
`src/lib/provinces.ts` (Mazar-i-Sharif = Balkh, Jalalabad = Nangarhar). The page
shows the 12 newest listings within 25 km (`CITY_RADIUS_KM`), links to
`/bazaar?lat=…&lng=…&radius=25` (noindex by the rule above, on purpose: the city
page is the indexable one), the most stocked categories site-wide (the API has
no per-city counts), the sell guide and the other cities. An unknown city is a
404. To add a city, add it to `CITY_PROVINCES` in `src/lib/cities.ts` and to
`cities.names` in all four message files.

Urdu: the new strings are translated in `ur.json` too (the message-coverage
spec requires it), but Urdu stays hidden, so no Urdu URL exists.

`src/i18n/locales.ts` now holds the locale constants without importing
next-intl, so the Playwright unit specs can load `src/lib/seo.ts`
(`routing.ts` re-exports them; nothing else changed for callers).

## Tests

- `e2e/seo-unit.spec.ts` (no server): `isFacetedSearch` against the filter URL
  vocabulary of `filters.ts`, the MobileApplication shape (required fields, no
  rating, absolute URLs), the city map.
- `e2e/seo-1.spec.ts` (HTTP + browser): 308s and locale detection, canonical /
  noindex per Bazaar URL kind, real 404s with their links, sold listing and
  empty profile noindex, JSON-LD on `/en`, `/ps`, `/fa/download`, the 7 new
  pages × 3 locales (status, canonical, hreflang, `lang`/`dir`, title,
  description, brand spelling ps ټ / fa ت), sitemap and footer links, phone
  width with no sideways scroll, RTL.
- `e2e/seo.spec.ts`: the old "bazaar?q=phone is indexable" assertion now uses
  `?sort=&page=` (a search URL is noindex by design).

## Owner decisions

1. **Sold listings: 200 + noindex (what this branch does) or 410 Gone?** A 410
   removes them from Google a little faster, but the page would then show
   "no longer available" to the buyer and seller who open it from their chat,
   their review or a shared link, and lose the "similar items" it offers. I
   recommend keeping noindex.
2. **Short share links** (`/l/<id>`, `/u/<id>`, `/s/<id>`) are still 307 →
   `/listings/<id>` etc. They are not in the sitemap and are listed only under
   "Page with redirect" (harmless). Making them permanent is one line in
   `next.config.ts`, but a browser then caches them forever, which closes the
   door on ever making them smarter (e.g. open the app). Left temporary.
3. **More cities?** Kunduz, Ghazni, Khost and the Pakistani cities (Peshawar,
   Quetta) are one line each. Worth it only where there are listings: a city
   page with nothing near it is thin.
4. **Ratings in the app JSON-LD**: once the store ratings are real and stable,
   adding `aggregateRating` (ratingValue + ratingCount from the store) unlocks
   the star snippet. Never before.

## Owner checklist after deploying seo-1 (things only you can do)

1. **Search Console → Sitemaps**: resubmit `https://hatiwal.com/sitemap.xml`
   (it now has 21 more URLs: 7 pages × 3 languages).
2. **URL inspection → Request indexing** for: `/en/how-to-sell`,
   `/ps/how-to-sell`, `/fa/how-to-sell`, `/en/buy-safely`, `/en/cities/kabul`,
   `/ps/cities/kabul`, `/fa/cities/herat`, `/ps/cities/jalalabad`,
   `/fa/cities/mazar-i-sharif`. (Search Console caps manual requests per day;
   the sitemap covers the rest.)
3. **Pages → "Why pages aren't indexed"**: on "Google chose different canonical"
   and "Duplicate without user-selected canonical", click **Validate fix**. Expect
   "Excluded by noindex" to GROW (search URLs, sold listings, empty profiles):
   that is the point, those pages are now excluded on purpose.
4. **Enhancements**: a "Software apps" entry may appear with the
   MobileApplication markup. It will say the item has no rating: expected (see
   decision 4). Test it once in the Rich Results Test
   (`https://search.google.com/test/rich-results?url=https://hatiwal.com/en/download`).
5. **Store marketing URLs**: Play Console → Store settings → Website =
   `https://hatiwal.com`; App Store Connect → App information → Marketing URL =
   `https://hatiwal.com` (if not done after seo-1.1.7). Put
   `https://hatiwal.com/ps/how-to-sell` in the store description's last line.
6. **Bios**: TikTok, Facebook, Instagram, YouTube, WhatsApp channel: "Hatiwal —
   هټیوال" + `https://hatiwal.com`. Send us the profile URLs to add to
   `sameAs` (Organization JSON-LD).
7. **Google Business Profile**: only with a real address people can visit (an
   office or a shop). Without one, skip it: a fake or virtual address gets the
   profile suspended.
8. **Bing Webmaster Tools** (`https://www.bing.com/webmasters`): sign in →
   "Import from Google Search Console" (one click, verifies the site and imports
   the sitemap). Bing results also feed DuckDuckGo.
9. Share the guides: `/ps/how-to-sell` and `/fa/buy-safely` are good links for
   WhatsApp groups and TikTok captions; real links from real people are what
   ranks a new site.

## How to re-check Search Console (once a week)

- **Pages**: indexed count should rise; "Google chose different canonical" and
  "Duplicate without user-selected canonical" should fall over 2–4 weeks;
  "Excluded by noindex" rises (on purpose); "Not found (404)" stays roughly the
  number of deleted listings (fine).
- **Performance → Search results → Pages**: filter by URL containing
  `how-to-sell`, `buy-safely` or `cities`: impressions first, clicks later.
- **Queries**: "hatiwal", "هټیوال", "هتیوال", "kabul buy sell", "په کابل کې
  پلور"…: note the position each week.
- **URL inspection** on one sold listing: should say "Excluded by 'noindex' tag".
- Re-run the measurement in this doc: `curl -s -o /dev/null -w '%{http_code}
  %{redirect_url}\n' https://hatiwal.com/` must print `308 https://hatiwal.com/en`.
