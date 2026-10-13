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
