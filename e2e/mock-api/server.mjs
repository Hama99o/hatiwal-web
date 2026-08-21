/**
 * Deterministic mock of the Hatiwal Rails API for web E2E.
 *
 * The Next server (SSR) and the same-origin proxies both fetch RAILS_SERVER_BASE
 * (driven by API_URL). Pointing API_URL at this server gives the web app stable,
 * snake_case responses shaped exactly like the real Rails serializers, so the
 * browser-driven E2E specs run without a database or the Ruby backend.
 *
 * Two authenticated personas (selected by the `access-token` request header,
 * which the /api/me proxy attaches from the session cookies):
 *   - buyer@hatiwal.test  → token "mock-access-token"        → FULL data
 *   - empty@hatiwal.test  → token "mock-access-token-empty"  → EMPTY everywhere
 * This lets specs exercise both populated and empty states deterministically by
 * choosing which storageState (which logged-in persona) they run as.
 *
 * The mock is STATELESS: mutations return a computed success response but persist
 * nothing, so parallel workers never interfere. Specs assert on the immediate
 * response / optimistic UI / toast / redirect, not on cross-request persistence.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_API_PORT || 4010);

const TOKEN_FULL = "mock-access-token";
const TOKEN_EMPTY = "mock-access-token-empty";

// ── Fixtures (snake_case, like Rails) ────────────────────────────────────────

// Rails only emits `seller_away_until` while the date is in the FUTURE
// (`u.away?`), so the fixture computes one instead of hardcoding a date that
// would quietly stop rendering the banner a month from now.
const AWAY_UNTIL = new Date(Date.now() + 7 * 864e5).toISOString();

const SELLERS = {
  // Seller 1 is also the signed-in buyer persona, so this one away date covers
  // both sides of the away banner's owner gate: a guest on listing 1 sees
  // "Seller is away", its owner must not be told that about themselves.
  1: { id: 1, name: "Ahmad Karimi", city: "Kabul", verified: true, avatar_url: null,
       seller_away_until: AWAY_UNTIL,
       response_rate_percent: 90, response_time_label: "within_one_hour" },
  2: { id: 2, name: "Sara Ahmadi", city: "Herat", verified: false, avatar_url: null,
       response_rate_percent: null, response_time_label: null },
  3: { id: 3, name: "Najib Rahimi", city: "Kabul", verified: true, avatar_url: null,
       response_rate_percent: 75, response_time_label: "within_a_day" },
};

// Revealed (double-blind) reviews for seller #1, as a seller.
const REVIEWS_OF_SELLER_1 = [
  { id: 101, rating: 5, comment: "Item exactly as described, met on time.", role: "of_seller",
    visible: true, revealed_at: "2026-07-01T10:00:00Z", created_at: "2026-06-30T09:00:00Z",
    transaction_id: 501, reviewee_id: 1,
    reviewer: { id: 2, name: "Sara Ahmadi", avatar_url: null } },
  { id: 102, rating: 4, comment: "Good deal, friendly seller.", role: "of_seller",
    visible: true, revealed_at: "2026-06-20T10:00:00Z", created_at: "2026-06-19T09:00:00Z",
    transaction_id: 502, reviewee_id: 1,
    reviewer: { id: 3, name: "Najib Rahimi", avatar_url: null } },
  { id: 103, rating: 5, comment: null, role: "of_seller",
    visible: true, revealed_at: "2026-06-10T10:00:00Z", created_at: "2026-06-09T09:00:00Z",
    transaction_id: 503, reviewee_id: 1,
    reviewer: { id: 2, name: "Sara Ahmadi", avatar_url: null } },
];

// Category tree. Deliberately covers every branch the hub renders:
//   1 electronics → direct stock + two stocked children + one EMPTY child
//                   (drives the "+N more" overflow and the empty-tone chip)
//   2 vehicles / 3 clothes → leaf categories with stock
//   4 home-garden → NO browsable stock anywhere, with children that are ALSO
//                   all empty. This is the real production shape (sellers file
//                   on the top-level category, so every subcategory sits at 0)
//                   and it is the case an earlier "chips only for stocked
//                   children" rule silently swallowed — the whole drill-down
//                   rendered nothing live while this fixture, where the only
//                   parent with children happened to have stocked ones, stayed
//                   green. Keep at least one all-empty parent here.
const CATEGORIES = [
  { id: 1, slug: "electronics", icon: "📱", position: 1,
    name_en: "Electronics", name_ps: "برقي وسایل", name_fa: "وسایل برقی",
    subcategories: [
      { id: 101, slug: "phones", icon: "📱", position: 1, name_en: "Phones & Tablets", name_ps: "موبایلونه", name_fa: "گوشی و تبلت", subcategories: [] },
      { id: 102, slug: "laptops", icon: "💻", position: 2, name_en: "Computers & Laptops", name_ps: "کمپیوترونه", name_fa: "کامپیوتر و لپ‌تاپ", subcategories: [] },
      { id: 103, slug: "cameras", icon: "📷", position: 3, name_en: "Cameras", name_ps: "کمرې", name_fa: "دوربین‌ها", subcategories: [] },
    ] },
  { id: 2, slug: "vehicles", icon: "🚗", position: 2, name_en: "Vehicles", name_ps: "موټرونه", name_fa: "وسایل نقلیه", subcategories: [] },
  { id: 3, slug: "clothes", icon: "👗", position: 3, name_en: "Clothes & Fashion", name_ps: "کالي او فیشن", name_fa: "لباس و مد", subcategories: [] },
  { id: 4, slug: "home-garden", icon: "🏡", position: 4,
    name_en: "Home & Garden", name_ps: "کور او باغ", name_fa: "خانه و باغ",
    subcategories: [
      { id: 401, slug: "furniture", icon: "🛋️", position: 1, name_en: "Furniture", name_ps: "فرنیچر", name_fa: "مبلمان", subcategories: [] },
      { id: 402, slug: "garden", icon: "🌱", position: 2, name_en: "Garden", name_ps: "باغ", name_fa: "باغ", subcategories: [] },
      { id: 403, slug: "kitchen", icon: "🍽️", position: 3, name_en: "Kitchen", name_ps: "پخلنځی", name_fa: "آشپزخانه", subcategories: [] },
      { id: 404, slug: "decor", icon: "🖼️", position: 4, name_en: "Decor", name_ps: "ډیکور", name_fa: "دکور", subcategories: [] },
      // Fifth child: pushes this all-empty parent past MAX_VISIBLE_SUBCATEGORIES
      // so the "+N more" overflow is covered here rather than depending on which
      // children happen to hold stock.
      { id: 405, slug: "lighting", icon: "💡", position: 5, name_en: "Lighting", name_ps: "روښانه", name_fa: "روشنایی", subcategories: [] },
    ] },
];

// id → category, derived from the tree so a new fixture row can never drift.
const CAT = Object.fromEntries(
  CATEGORIES.flatMap((c) => [[c.id, c], ...c.subcategories.map((s) => [s.id, s])]),
);

/**
 * The `field(:category)` sub-object on every listing view — Rails renders it
 * through `CategorySerializer.render_as_hash(l.category)`, i.e. that
 * serializer's DEFAULT view: `fields :id, :slug, :icon, :position` plus the
 * three localized names. `icon`/`position` are unread by the web today (its
 * `CategoryRef` type is the other five), but they are on the wire, so they are
 * here too — see e2e/mock-api/serializer-view-keys.ts.
 */
function catRef(id) {
  const c = CAT[id] || CAT[1];
  return {
    id: c.id, slug: c.slug, icon: c.icon, position: c.position,
    name_en: c.name_en, name_ps: c.name_ps, name_fa: c.name_fa,
  };
}

// Master listings table. /listings exposes only active (like Listing.browsable);
// /listings/:id returns any (detail shows a status notice for reserved/sold).
// Seller 1 (the logged-in buyer persona) owns a listing in every lifecycle state,
// so the seller dashboard's status tabs are all populated.
const LISTINGS = [
  { id: 1, title: "iPhone 13 Pro", price: 45000, currency: "AFN", status: "active", location: "Kabul", address: "Shar-e-Naw", condition: "good", category_id: 101, seller_id: 1, views_count: 120, created_at: "2026-06-20T10:00:00Z", price_drop_percent: 12, price_dropped_at: "2026-06-19T10:00:00Z", description: "Barely used iPhone 13 Pro, 256GB." },
  { id: 2, title: "Samsung 4K TV", price: 30000, currency: "AFN", status: "active", location: "Kabul", address: null, condition: "like_new", category_id: 1, seller_id: 2, views_count: 80, created_at: "2026-06-18T10:00:00Z", price_drop_percent: null, price_dropped_at: null, description: "55 inch 4K smart TV." },
  { id: 3, title: "Toyota Corolla 2015", price: 600000, currency: "AFN", status: "active", location: "Herat", address: null, condition: "fair", category_id: 2, seller_id: 1, views_count: 300, created_at: "2026-06-15T10:00:00Z", price_drop_percent: null, price_dropped_at: null, description: "Clean title, well maintained." },
  // The one FIRM-PRICE listing (`negotiable: false`, a real `view :list` field):
  // drives the "Firm price" badge on a feed card and on the detail page, plus the
  // gate that hides the make-an-offer affordance. Every other row is negotiable,
  // which is the column default. Also the only row with a non-zero `saves_count`,
  // so `:detailed`'s "N saves" line is reachable.
  { id: 4, title: "Winter Jacket", price: 1200, currency: "AFN", status: "active", location: "Mazar-i-Sharif", address: null, condition: "like_new", category_id: 3, seller_id: 2, views_count: 25, negotiable: false, saves_count: 3, created_at: "2026-06-21T10:00:00Z", price_drop_percent: null, price_dropped_at: null, description: "Warm winter jacket, size L." },
  // The one MULTI-UNIT listing — a reseller with a batch of identical items, the
  // case docs/SPIKE_LISTING_QUANTITY.md was written for. 15 total, 4
  // already sold, so `available_units` is 11 (derived in baseFields, like the
  // model). Drives the "each" price suffix and the "11 in stock" pill; it is
  // owned by seller 1 (the signed-in persona) so the OWNER phrasing on
  // /my-listings/:id is reachable too. Every other row is single-unit, which is
  // the column default — keep it that way, so a spec asserting "a single-item
  // listing shows no quantity UI at all" has something to assert against.
  //
  // Filed under 101 (phones), NOT 4 (home-garden): 4 is deliberately the
  // all-empty parent that covers the real production drill-down shape, and the
  // fixture header above says to keep it that way.
  { id: 14, title: "Phone Cases Wholesale", price: 400, currency: "AFN", status: "active", location: "Kabul", address: "Mandawi Bazaar", condition: "brand_new", category_id: 101, seller_id: 1, views_count: 64, quantity: 15, sold_units: 4, created_at: "2026-06-22T10:00:00Z", price_drop_percent: null, price_dropped_at: null, description: "Identical silicone cases, bought a box of 15." },
  // The one listing NOBODY has messaged about (conversations_count 0, which Rails
  // always emits): drives the "count badge hides at zero" case that the majority
  // of owner views actually are.
  { id: 5, title: "MacBook Pro M2", price: 90000, currency: "AFN", status: "active", location: "Kabul", address: null, condition: "good", category_id: 102, seller_id: 1, views_count: 210, conversations_count: 0, created_at: "2026-06-17T10:00:00Z", price_drop_percent: null, price_dropped_at: null, description: "16GB RAM, 512GB SSD." },
  // Not in the public feed; reachable by id for detail edge cases.
  { id: 6, title: "Mountain Bike (Reserved)", price: 5000, currency: "AFN", status: "reserved", location: "Kabul", address: null, condition: "good", category_id: 2, seller_id: 2, views_count: 40, created_at: "2026-06-10T10:00:00Z", price_drop_percent: null, price_dropped_at: null, description: "Reserved for a buyer." },
  // Sold WITH a buyer, so it carries the owner-only `sale` block (`SALE_FIELD`)
  // that `:seller_list` and `:owner_detailed` render — the same transaction the
  // /my/reviews/pending fixture below hangs the review nudge off (id 501).
  { id: 7, title: "Leather Sofa (Sold)", price: 8000, currency: "AFN", status: "sold", location: "Herat", address: null, condition: "fair", category_id: 3, seller_id: 1, views_count: 95, created_at: "2026-06-05T10:00:00Z", price_drop_percent: null, price_dropped_at: null, description: "Already sold.",
    sale: { id: 501, status: "sold", final_price: 8000, currency: "AFN", completed_at: "2026-06-25T10:00:00Z", buyer: { id: 2, name: "Sara Ahmadi", avatar_url: null, verified: false }, conversation_id: null } },
  // Seller 1's draft + reserved, so My Shop has all statuses.
  { id: 8, title: "Antique Carpet", price: 15000, currency: "AFN", status: "draft", location: "Kabul", address: null, condition: "good", category_id: 3, seller_id: 1, views_count: 0, created_at: "2026-06-22T08:00:00Z", price_drop_percent: null, price_dropped_at: null, description: "Hand-woven, not yet published." },
  { id: 9, title: "Gaming PC", price: 70000, currency: "AFN", status: "reserved", location: "Kabul", address: null, condition: "like_new", category_id: 102, seller_id: 1, views_count: 60, created_at: "2026-06-12T08:00:00Z", price_drop_percent: null, price_dropped_at: null, description: "RTX 3070, reserved for a buyer.",
    sale: { id: 601, status: "reserved", final_price: 70000, currency: "AFN", completed_at: null, buyer: { id: 3, name: "Najib Rahimi", avatar_url: null, verified: true }, conversation_id: null } },
];

// Seller 1's ACTIVE-but-past-its-30-day-run listing. Kept OUT of LISTINGS on
// purpose: Rails hides expired listings from buyers, so it must not appear in
// the public feed / seller rails (which would shift every browse assertion) —
// it exists only to drive My Shop's Expired tab and the Renew quick-action.
const EXPIRED_MINE = {
  id: 10, title: "Old Bicycle", price: 3000, currency: "AFN", status: "active",
  location: "Kabul", address: null, condition: "fair", category_id: 2, seller_id: 1,
  views_count: 18, created_at: "2026-05-01T08:00:00Z", price_drop_percent: null,
  price_dropped_at: null, description: "Listed a while ago, run has lapsed.",
  expired: true, expires_at: "2026-05-31T08:00:00Z",
};

// Seller 1's ACTIVE listing whose run is nearly up (the amber "Expires in N
// days" state, 1..7 days out). Kept out of LISTINGS *and* out of myListings()
// for the same reason as EXPIRED_MINE — it must not shift the public feed or My
// Shop's tab counts — so it exists only to drive the owner panel's
// expiring-soon case on /listings/11. Computed from `Date.now()` rather than a
// literal: a hardcoded date would silently become "expired" (a different state,
// with a different primary action) once it slipped into the past.
const EXPIRING_SOON_MINE = {
  id: 11, title: "Wooden Desk", price: 4000, currency: "AFN", status: "active",
  location: "Kabul", address: null, condition: "good", category_id: 3, seller_id: 1,
  views_count: 22, created_at: "2026-06-01T08:00:00Z", price_drop_percent: null,
  price_dropped_at: null, description: "Solid wood desk, run nearly up.",
  expired: false, expires_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
};

// Two sold listings for the recovery-CTA edge cases. Kept out of LISTINGS for
// the same reason as the two above — they must not shift the public feed, the
// category counts or My Shop — so they exist only to be opened by id.
//
// 12: priced in USD. Rails' price filter (`price_at_least`/`price_at_most`) is
//     currency-blind, so a ±30% band around $900 would ask the AFN feed for
//     630–1,170 and land on junk: the CTA must fall back to category-only.
//     Filed in Computers & Laptops, which HAS active stock (MacBook Pro M2), so
//     the CTA itself still renders and only the band is dropped.
// 13: filed in Furniture — a category with no active stock at all (Home &
//     Garden is the deliberately all-empty parent above), so the "see similar"
//     CTA must not render at all rather than promise an empty Bazaar.
const SOLD_FOREIGN_CURRENCY = {
  id: 12, title: "Dell XPS 13 (Sold, USD)", price: 900, currency: "USD", status: "sold",
  location: "Kabul", address: null, condition: "good", category_id: 102, seller_id: 2,
  views_count: 31, created_at: "2026-06-08T08:00:00Z", price_drop_percent: null,
  price_dropped_at: null, description: "Priced in dollars, already sold.",
};

const SOLD_EMPTY_CATEGORY = {
  id: 13, title: "Oak Wardrobe (Sold)", price: 2500, currency: "AFN", status: "sold",
  location: "Herat", address: null, condition: "fair", category_id: 401, seller_id: 2,
  views_count: 12, created_at: "2026-06-07T08:00:00Z", price_drop_percent: null,
  price_dropped_at: null, description: "Nothing else in this category.",
};

// ── Per-viewer state for the FULL persona ────────────────────────────────────
// Rails personalises GET /listings whenever a bearer is present, in three ways:
// hidden listings are filtered out (`not_hidden_for`), `is_viewed` comes from the
// caller's ListingView rows, and `is_saved` from the pre-computed `saved_ids:`
// Set the controller passes (TASK-BE-SAVEDLIST). The three collections below are
// the single source for BOTH the index and the /my/* lists, so the feed can never
// disagree with the management screens (a hidden listing that still shows in the
// feed is exactly the defect the authed feed fixes).
const HIDDEN_IDS = [2]; // Samsung 4K TV — "Not interested"
const VIEWED_IDS = [1]; // iPhone 13 Pro — already opened → "Seen" pill + dim

// The `{ listing_id => SavedListing }` map GET /my/saved_listings passes as
// `saved_by_listing_id:`. It is the ONLY :list surface that fills the
// price-at-save trio, and the only one that proves `is_saved` without a
// `saved_ids:` Set (every row it renders is a saved row by construction).
// `price_drop_amount` is nil unless the price actually dropped — see
// SavedListing#price_drop_amount.
const SAVED_META = {
  // Samsung 4K TV (also hidden): saved at 35,000, now 30,000 → a real drop.
  2: { price_at_save: 35000, price_dropped: true, price_drop_amount: 5000 },
  // Winter Jacket: saved at today's price → no drop.
  4: { price_at_save: 1200, price_dropped: false, price_drop_amount: null },
};
// Derived so the two can never disagree: whatever is in SAVED_META is saved.
const SAVED_IDS = Object.keys(SAVED_META).map(Number);

function findListing(id) {
  return [
    ...LISTINGS,
    EXPIRED_MINE,
    EXPIRING_SOON_MINE,
    SOLD_FOREIGN_CURRENCY,
    SOLD_EMPTY_CATEGORY,
  ].find((l) => String(l.id) === String(id));
}

// ── Serializer views ─────────────────────────────────────────────────────────
// The four functions below mirror ONE view each of
// hatiwal-api/app/serializers/listing_serializer.rb, FIELD FOR FIELD. Their key
// sets are pinned against the committed snapshot in
// e2e/mock-api/serializer-view-keys.ts by the browser-free e2e/mock-shape.spec.ts,
// because a fixture that invents a field lets a Playwright spec prove behaviour
// the real API cannot produce — which is exactly how TASK-WEB-FEED250 first
// shipped reported-complete against an unmeetable acceptance criterion (an
// invented `is_saved` on `view :list`).
//
// So: never add a key here without adding it to the serializer AND to the
// snapshot. One function per view, never one function for two views — the merged
// `listView` was what let `:seller_list`'s extras leak into every feed row.

/** `fields :id, :title, … :created_at` — declared OUTSIDE any view, so
 *  Blueprinter includes them in every named view below. */
function baseFields(l) {
  const quantity = l.quantity ?? 1;
  const soldUnits = l.sold_units ?? 0;
  return {
    id: l.id, title: l.title, price: l.price, currency: l.currency, status: l.status,
    location: l.location, address: l.address, condition: l.condition,
    created_at: l.created_at,
    // Multi-quantity — BASE on ListingSerializer, so all four views carry it.
    // Derived from the fixture the same way the model does (`available_units` is
    // `quantity - sold_units`, floored at 0; `multi_unit?` is `quantity > 1`) so
    // a fixture can express a partially-sold batch by setting `sold_units`
    // alone, exactly as the DB does.
    quantity,
    available_units: Math.max(0, quantity - soldUnits),
    multi_unit: quantity > 1,
  };
}

/** Lifecycle timestamps. A draft was never published; only a reserved listing
 *  carries reserved_at, only a sold one sold_at (`:seller_list` + `:detailed`). */
function lifecycleFields(l) {
  return {
    published_at: l.status === "draft" ? null : l.created_at,
    reserved_at: l.status === "reserved" ? l.created_at : null,
    sold_at: l.status === "sold" ? l.created_at : null,
  };
}

/** `field(:seller)` inside `view :list` — five public identity keys and no more.
 *  The response-rate / away / rating signals belong to the `:detailed` seller
 *  block (see `detailedSeller`); a feed row has never carried them. */
function listSeller(l) {
  const u = SELLERS[l.seller_id];
  return { id: u.id, name: u.name, city: u.city, verified: u.verified, avatar_url: u.avatar_url };
}

/** The trust summary the `:detailed` seller block adds (UserSerializer-derived
 *  values). Kept out of SELLERS so it cannot leak into the
 *  /users/:id/public_profile fixture, whose shape belongs to a different
 *  serializer (UserSerializer's `:public` view — not covered by this snapshot). */
const SELLER_TRUST = {
  1: { avg_rating: 4.7, review_count: 3, last_active_label: "today" },
  2: { avg_rating: null, review_count: 0, last_active_label: "this_week" },
  3: { avg_rating: null, review_count: 0, last_active_label: null },
};

/** `field(:seller)` inside `view :detailed`. `phone` is exposed only to an
 *  authenticated non-owner, and the detail payload is fetched by an RSC (i.e. as
 *  a guest), so it is always null here. `seller_away_until` is a key on every
 *  seller — null unless they are CURRENTLY away. */
function detailedSeller(l) {
  const u = SELLERS[l.seller_id];
  const trust = SELLER_TRUST[l.seller_id];
  return {
    id: u.id, name: u.name, city: u.city, phone: null, verified: u.verified,
    avatar_url: u.avatar_url,
    avg_rating: trust.avg_rating, review_count: trust.review_count,
    response_rate_percent: u.response_rate_percent,
    response_time_label: u.response_time_label,
    last_active_label: trust.last_active_label,
    seller_is_away: Boolean(u.seller_away_until),
    seller_away_until: u.seller_away_until ?? null,
  };
}

/** `SALE_FIELD` — the owner-only buyer block shared by `:seller_list` and
 *  `:owner_detailed`. null until the listing has a Transaction (every draft and
 *  active listing, plus a buyer-less legacy reserve/sold). */
function saleView(l) {
  return l.sale ?? null;
}

/**
 * `view :list` — GET /listings, GET /listings/:id/similar,
 * GET /my/saved_listings, GET /my/hidden_listings, GET /users/:id/sold_listings.
 *
 * `opts` are the serializer's local_options, and ONLY the controllers that
 * actually pass them get a non-default answer. That asymmetry is deliberate in
 * Rails and documented on the serializer, so it is mirrored here rather than
 * smoothed over:
 *   viewedIds        — `viewed_ids:`          (index + similar only)
 *   savedIds         — `saved_ids:`           (index + similar only)
 *   savedByListingId — `saved_by_listing_id:` (the Saved screen only) → is_saved
 *                      plus the price_at_save / price_dropped / price_drop_amount
 *                      trio, which is null/false on every other :list surface.
 */
function listView(l, { viewedIds = null, savedIds = null, savedByListingId = null } = {}) {
  const save = savedByListingId?.[l.id] ?? null;
  return {
    ...baseFields(l),
    category_id: l.category_id,
    views_count: l.views_count,
    negotiable: l.negotiable ?? true,
    thumbnail_url: null,
    image_urls: [],
    is_viewed: viewedIds?.includes(l.id) ?? false,
    is_saved: save !== null || (savedIds?.includes(l.id) ?? false),
    seller: listSeller(l),
    category: catRef(l.category_id),
    price_drop_percent: l.price_drop_percent,
    price_dropped_at: l.price_dropped_at,
    price_at_save: save?.price_at_save ?? null,
    price_dropped: save?.price_dropped ?? false,
    price_drop_amount: save?.price_drop_amount ?? null,
  };
}

/**
 * The `viewed_ids:` + `saved_ids:` Sets that ListingsController#index and
 * #similar (and ONLY those two) pass to `view :list`. Both are empty for a guest
 * — `return Set.new if current_user.nil?` — and for a persona with no rows.
 */
function viewerSets(who) {
  return who === "full" ? { viewedIds: VIEWED_IDS, savedIds: SAVED_IDS } : {};
}

/**
 * `view :seller_list` — GET /my/listings (My Shop) and nothing else.
 *
 * The extras a feed row must NOT have live here: the lifecycle timestamps, the
 * expiry pair the Expired tab and the Renew action read, `conversations_count`,
 * and the owner-only `sale`. There is deliberately no `is_saved`/`is_viewed`/
 * `seller` — whether the owner bookmarked or opened their own listing is not a
 * product concept, and the seller of every row is the caller.
 */
function sellerListView(l) {
  return {
    ...baseFields(l),
    category_id: l.category_id,
    views_count: l.views_count,
    ...lifecycleFields(l),
    expires_at: l.expires_at ?? null,
    negotiable: l.negotiable ?? true,
    thumbnail_url: null,
    image_urls: [],
    // Rails emits this for every listing, 0 included — per-fixture override so a
    // listing with no chats can be asserted on.
    conversations_count: l.conversations_count ?? 2,
    expired: l.expired ?? false,
    category: catRef(l.category_id),
    price_drop_percent: l.price_drop_percent,
    price_dropped_at: l.price_dropped_at,
    sale: saleView(l),
  };
}

/** `view :detailed` — the public GET /listings/:id. */
function detailView(l) {
  return {
    ...baseFields(l),
    description: l.description,
    category_id: l.category_id,
    latitude: 34.55,
    longitude: 69.2,
    views_count: l.views_count,
    ...lifecycleFields(l),
    updated_at: l.created_at,
    expires_at: l.expires_at ?? null,
    negotiable: l.negotiable ?? true,
    images: [],
    image_attachments: [],
    thumbnail_url: null,
    expired: l.expired ?? false,
    conversations_count: l.conversations_count ?? 2,
    saves_count: l.saves_count ?? 0,
    // Both are computed from the caller's own rows in Rails. Hardcoded false
    // because the detail page's payload is fetched by an RSC, i.e. as a guest —
    // never claim a save/view this fixture cannot attribute to anyone.
    is_saved: false,
    is_viewed: false,
    seller: detailedSeller(l),
    category: catRef(l.category_id),
    price_dropped_at: l.price_dropped_at,
    price_drop_percent: l.price_drop_percent,
    // `Listing.share_url_for` is nil unless PUBLIC_SHARE_BASE_URL is set.
    share_url: null,
  };
}

/** `view :owner_detailed` — `include_view :detailed` plus the owner-only sale.
 *  Everything under /my/listings/:id (show, create, update, lifecycle). */
function ownerDetailView(l) {
  return { ...detailView(l), sale: saleView(l) };
}

/** A listing owned by user 1 by id — falls back to a synthesized draft so a
 * freshly-created listing (POST → redirect → detail) always renders. */
function myListingView(id) {
  const found = findListing(id);
  if (found) return ownerDetailView(found);
  return ownerDetailView({
    id: Number(id), title: "New Listing", price: 1000, currency: "AFN", status: "draft",
    location: "Kabul", address: null, condition: "good", category_id: 101, seller_id: 1,
    views_count: 0, created_at: "2026-06-22T09:00:00Z", price_drop_percent: null,
    price_dropped_at: null, description: "A newly created listing.",
  });
}

function userMe(persona) {
  if (persona === "empty") {
    return { id: 99, email: "empty@hatiwal.test", firstname: "Sahar", lastname: "Noor", full_name: "Sahar Noor", city: null, province: null, phone: null, bio: null, latitude: null, longitude: null, preferred_language: "en", preferred_theme: "system", seller_mode: false, status: "active", verified: false, avatar_url: null, items_active_count: 0, items_sold_count: 0, saved_items_count: 0, unread_message_count: 0, avg_rating: null, review_count: 0, deletion_scheduled_at: null, created_at: "2026-02-01T00:00:00Z" };
  }
  return { id: 1, email: "buyer@hatiwal.test", firstname: "Ahmad", lastname: "Karimi", full_name: "Ahmad Karimi", city: "Kabul", province: "Kabul", phone: "+93 700 000 000", bio: "Trusted local seller.", latitude: 34.55, longitude: 69.2, preferred_language: "en", preferred_theme: "system", seller_mode: true, status: "active", verified: true, avatar_url: null, items_active_count: 3, items_sold_count: 1, saved_items_count: 2, unread_message_count: 2, avg_rating: 4.7, review_count: 3, deletion_scheduled_at: null, created_at: "2026-01-01T00:00:00Z" };
}

// Chat fixtures (buyer persona). Conversation/Message use snake_case keys.
// `buyer`/`seller` mirror Rails' :detailed conversation view — the thread uses
// them to tell which side the viewer is on (the seller gets the counter-offer
// action and the reserve/mark-sold header button). Both listings here belong to
// seller 1, who is the signed-in persona, so the seller side is exercised.
const HERO_CONVERSATIONS = [
  { id: 1, status: "open", last_message_at: "2026-06-21T15:00:00Z", created_at: "2026-06-20T10:00:00Z",
    listing: { id: 1, title: "iPhone 13 Pro", thumbnail_url: null, status: "active", price: 45000, currency: "AFN", location: "Kabul" },
    other_participant: { id: 2, name: "Sara Ahmadi", city: "Herat", verified: false, avatar_url: null },
    buyer: { id: 2, name: "Sara Ahmadi", city: "Herat", avatar_url: null },
    seller: { id: 1, name: "Ahmad Karimi", city: "Kabul", avatar_url: null },
    unread_count: 2, last_message_body: "Is this still available?", last_message_kind: "text", blocked_with_participant: false },
  { id: 2, status: "closed", last_message_at: "2026-06-19T12:00:00Z", created_at: "2026-06-18T10:00:00Z",
    listing: { id: 3, title: "Toyota Corolla 2015", thumbnail_url: null, status: "active", price: 600000, currency: "AFN", location: "Herat" },
    other_participant: { id: 3, name: "Najib Rahimi", city: "Kabul", verified: true, avatar_url: null },
    buyer: { id: 3, name: "Najib Rahimi", city: "Kabul", avatar_url: null },
    seller: { id: 1, name: "Ahmad Karimi", city: "Kabul", avatar_url: null },
    unread_count: 0, last_message_body: "Thanks!", last_message_kind: "text", blocked_with_participant: false },
  // A thread on the MULTI-UNIT listing (14, Phone Cases Wholesale — 15 total, 4 sold), so the
  // buyer picker has a real buyer to pick when the seller marks part of a batch
  // as sold. Without it the quantity field is unreachable in E2E: the field only
  // renders once a real buyer is selected (a sale to "someone not on Hatiwal"
  // records no transaction for a quantity to attach to).
  { id: 4, status: "open", last_message_at: "2026-06-22T11:00:00Z", created_at: "2026-06-22T09:00:00Z",
    listing: { id: 14, title: "Phone Cases Wholesale", thumbnail_url: null, status: "active", price: 400, currency: "AFN", location: "Kabul", multi_unit: true, available_units: 11 },
    // Its OWN participant, not one of the other threads' — the inbox specs
    // locate rows by name, and a reused name makes `getByText` ambiguous.
    other_participant: { id: 5, name: "Bilal Nazari", city: "Kabul", verified: true, avatar_url: null },
    buyer: { id: 5, name: "Bilal Nazari", city: "Kabul", avatar_url: null },
    seller: { id: 1, name: "Ahmad Karimi", city: "Kabul", avatar_url: null },
    unread_count: 0, last_message_body: "I need 3 of these.", last_message_kind: "text", blocked_with_participant: false },
  // An OFFER thread: its preview is not the raw body but a locale-formatted
  // price ("Offer: AFN 75,000" / "؋ ۷۵٬۰۰۰"), which is what the inbox search has
  // to match against in either numeral system.
  { id: 3, status: "open", last_message_at: "2026-06-19T09:00:00Z", created_at: "2026-06-17T10:00:00Z",
    listing: { id: 5, title: "MacBook Pro M2", thumbnail_url: null, status: "active", price: 90000, currency: "AFN", location: "Kabul" },
    other_participant: { id: 4, name: "Zohra Amini", city: "Kabul", verified: false, avatar_url: null },
    buyer: { id: 4, name: "Zohra Amini", city: "Kabul", avatar_url: null },
    seller: { id: 1, name: "Ahmad Karimi", city: "Kabul", avatar_url: null },
    unread_count: 0, last_message_body: "75000|AFN|90000", last_message_kind: "offer", blocked_with_participant: false },
];

// ── Long-tail threads (TASK-WEB-INBOX20) ────────────────────────────────────
// Rails renders GET /conversations through paginate_blue — 20 rows per page —
// so the fixture inbox is deliberately 25 threads: page 1 fills, page 2 holds
// the rest, and the web list must page to reach them instead of silently
// truncating. The archived partition (22) and listing 3's filtered view
// (1 hero + 22 filler = 23) are over one page for the same reason.
// Names/bodies are generated so the block stays readable and never collides
// with the hero personas above.
const FILLER_FIRST_NAMES = ["Waheed", "Farhad", "Zahra", "Omid", "Laila", "Karim", "Nasrin", "Jamal", "Hakim", "Roya", "Sohail"];
const FILLER_LAST_NAMES = ["Sultani", "Barakzai"];
const FILLER_COUNT = FILLER_FIRST_NAMES.length * FILLER_LAST_NAMES.length; // 22

function fillerThread(i, { startId, listing, body, unreadLast = false }) {
  const name = `${FILLER_FIRST_NAMES[i % FILLER_FIRST_NAMES.length]} ${
    FILLER_LAST_NAMES[Math.floor(i / FILLER_FIRST_NAMES.length)]
  }`;
  const participant = { id: 500 + startId + i, name, city: "Kabul", verified: false, avatar_url: null };
  // Strictly decreasing, like Rails' `ordered` (last_message_at DESC).
  const at = new Date(Date.UTC(2026, 5, 18, 12, 0, 0) - i * 3_600_000).toISOString();
  return {
    id: startId + i, status: "open", last_message_at: at, created_at: at,
    listing,
    other_participant: participant,
    buyer: participant,
    seller: { id: 1, name: "Ahmad Karimi", city: "Kabul", avatar_url: null },
    // The LAST filler is unread so the read/unread flip can be asserted against
    // a row that only exists after a Load-more.
    unread_count: unreadLast && i === FILLER_COUNT - 1 ? 1 : 0,
    last_message_body: body, last_message_kind: "text", blocked_with_participant: false,
  };
}

const CONVERSATIONS = [
  ...HERO_CONVERSATIONS,
  ...Array.from({ length: FILLER_COUNT }, (_, i) =>
    fillerThread(i, {
      startId: 100,
      listing: { id: 3, title: "Toyota Corolla 2015", thumbnail_url: null, status: "active", price: 600000, currency: "AFN", location: "Herat" },
      body: "Can you deliver it to Kabul?",
      unreadLast: true,
    }),
  ),
];

const ARCHIVED_CONVERSATIONS = Array.from({ length: FILLER_COUNT }, (_, i) =>
  fillerThread(i, {
    startId: 200,
    listing: { id: 2, title: "Samsung 4K TV", thumbnail_url: null, status: "active", price: 30000, currency: "AFN", location: "Kabul" },
    body: "Deal closed, thank you.",
  }),
);

const ALL_CONVERSATIONS = [...CONVERSATIONS, ...ARCHIVED_CONVERSATIONS];

const MESSAGES = {
  // Returned newest-first (Rails order); chat.ts reverses for display.
  // Conversation 1 spans TWO local days (id 1 on 06-20, the rest on 06-21) so the
  // day-separator logic has something to group, and covers every bubble kind:
  //   - mine + read_at set        → double tick (seen)
  //   - mine + read_at null       → single tick (sent, not seen)
  //   - incoming                  → no tick
  //   - offer / meetup / document → structured bubbles, meta row still shown
  //   - system / declined pill / tombstone → NO meta row
  1: [
    { id: 12, body: "Offer declined", kind: "offer_declined", read_at: null, created_at: "2026-06-21T15:55:00Z", responds_to_id: 9, sender: { id: 1, name: "Ahmad Karimi", avatar_url: null }, attachment_url: null },
    { id: 11, body: "", kind: "text", deleted: true, deleted_at: "2026-06-21T15:52:00Z", read_at: null, created_at: "2026-06-21T15:50:00Z", responds_to_id: null, sender: { id: 1, name: "Ahmad Karimi", avatar_url: null }, attachment_url: null },
    { id: 10, body: "This listing was marked as reserved.", kind: "system", read_at: null, created_at: "2026-06-21T15:45:00Z", responds_to_id: null, sender: { id: 2, name: "Sara Ahmadi", avatar_url: null }, attachment_url: null },
    { id: 9, body: "40000|AFN|45000", kind: "offer", offer_amount: 40000, offer_currency: "AFN", read_at: null, created_at: "2026-06-21T15:35:00Z", responds_to_id: null, sender: { id: 2, name: "Sara Ahmadi", avatar_url: null }, attachment_url: null },
    { id: 8, body: "receipt.pdf", kind: "document", read_at: null, created_at: "2026-06-21T15:30:00Z", responds_to_id: null, sender: { id: 1, name: "Ahmad Karimi", avatar_url: null }, attachment_url: "https://example.test/receipt.pdf" },
    { id: 7, body: "Kabul City Center | Tomorrow at 4pm", kind: "meetup_proposal", read_at: "2026-06-21T15:28:00Z", created_at: "2026-06-21T15:25:00Z", responds_to_id: null, sender: { id: 1, name: "Ahmad Karimi", avatar_url: null }, attachment_url: null },
    { id: 6, body: "I can bring it to Shar-e-Naw.", kind: "text", read_at: null, created_at: "2026-06-21T15:10:00Z", responds_to_id: null, sender: { id: 1, name: "Ahmad Karimi", avatar_url: null }, attachment_url: null },
    { id: 3, body: "Is this still available?", kind: "text", read_at: null, created_at: "2026-06-21T15:00:00Z", responds_to_id: null, sender: { id: 2, name: "Sara Ahmadi", avatar_url: null }, attachment_url: null },
    { id: 2, body: "Yes, it is still available.", kind: "text", read_at: "2026-06-21T14:00:00Z", created_at: "2026-06-21T14:00:00Z", responds_to_id: null, sender: { id: 1, name: "Ahmad Karimi", avatar_url: null }, attachment_url: null },
    { id: 1, body: "Hello, I'm interested in the iPhone.", kind: "text", read_at: "2026-06-21T13:00:00Z", created_at: "2026-06-20T10:00:00Z", responds_to_id: null, sender: { id: 2, name: "Sara Ahmadi", avatar_url: null }, attachment_url: null },
  ],
  2: [
    { id: 5, body: "Thanks!", kind: "text", read_at: "2026-06-19T12:00:00Z", created_at: "2026-06-19T12:00:00Z", responds_to_id: null, sender: { id: 3, name: "Najib Rahimi", avatar_url: null }, attachment_url: null },
    { id: 4, body: "Deal done, see you tomorrow.", kind: "text", read_at: "2026-06-19T11:00:00Z", created_at: "2026-06-19T11:00:00Z", responds_to_id: null, sender: { id: 1, name: "Ahmad Karimi", avatar_url: null }, attachment_url: null },
  ],
};

const BLOCKED_USERS = [
  { id: 3, name: "Najib Rahimi", city: "Kabul", verified: true, avatar_url: null },
];

const SAVED_SEARCHES = [
  { id: 1, name: "Cheap phones in Kabul", query: { search: "phone", category_id: 101, location: "Kabul" }, created_at: "2026-06-10T10:00:00Z" },
];

function analytics() {
  const days = ["2026-06-16", "2026-06-17", "2026-06-18", "2026-06-19", "2026-06-20", "2026-06-21", "2026-06-22"];
  const counts = [5, 12, 8, 20, 15, 30, 25];
  return days.map((date, i) => ({ date, count: counts[i] }));
}

// ── Query helpers ────────────────────────────────────────────────────────────

function paginate(items, pageNum, pageSize) {
  const size = Number(pageSize) || 20;
  const page = Number(pageNum) || 1;
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const start = (page - 1) * size;
  const slice = items.slice(start, start + size);
  return {
    slice,
    pagination: {
      current_page: page,
      next_page: page < totalPages ? page + 1 : null,
      prev_page: page > 1 ? page - 1 : null,
      total_count: total,
      total_pages: totalPages,
    },
  };
}

/** A category id plus its children — mirrors Rails' Category.self_and_children. */
function selfAndChildIds(id) {
  const c = CAT[Number(id)];
  return c ? [c.id, ...(c.subcategories ?? []).map((s) => s.id)] : [Number(id)];
}

/** Browsable (= what /listings exposes) count for one category, direct only. */
function directBrowsableCount(categoryId) {
  return LISTINGS.filter((l) => l.status === "active" && l.category_id === categoryId).length;
}

/**
 * The `?with_counts=true` payload, computed exactly as Rails does it: a parent's
 * `active_listings_count` ROLLS ITS SUBCATEGORIES UP, because filtering by the
 * parent returns those listings too (Listing.by_category → self_and_children).
 * Counting direct children only is the bug this fixture exists to catch.
 */
function categoriesWithCounts() {
  return CATEGORIES.map((c) => {
    const subcategories = (c.subcategories ?? []).map((s) => ({
      ...s,
      active_listings_count: directBrowsableCount(s.id),
    }));
    return {
      ...c,
      subcategories,
      active_listings_count:
        directBrowsableCount(c.id) +
        subcategories.reduce((n, s) => n + s.active_listings_count, 0),
    };
  });
}

function filterListings(q) {
  let items = LISTINGS.filter((l) => l.status === "active");
  if (q.get("status")) items = LISTINGS.filter((l) => l.status === q.get("status"));
  if (q.get("category_id")) {
    // Same expansion as Rails: a parent category also yields its children's
    // listings, so the grid always agrees with the hub's rolled-up count.
    const ids = selfAndChildIds(q.get("category_id"));
    items = items.filter((l) => ids.includes(l.category_id));
  }
  if (q.get("user_id")) items = items.filter((l) => String(l.seller_id) === q.get("user_id"));
  if (q.get("condition")) items = items.filter((l) => l.condition === q.get("condition"));
  if (q.get("price_min")) items = items.filter((l) => l.price >= Number(q.get("price_min")));
  if (q.get("price_max")) items = items.filter((l) => l.price <= Number(q.get("price_max")));
  const search = q.get("search");
  if (search) items = items.filter((l) => l.title.toLowerCase().includes(search.toLowerCase()));
  const sort = q.get("sort");
  const byDate = (a, b) => new Date(b.created_at) - new Date(a.created_at);
  if (sort === "oldest") items = [...items].sort((a, b) => -byDate(a, b));
  else if (sort === "price_asc") items = [...items].sort((a, b) => a.price - b.price);
  else if (sort === "price_desc") items = [...items].sort((a, b) => b.price - a.price);
  else items = [...items].sort(byDate);
  return items;
}

// My Shop: seller 1's listings across all statuses (newest first). The ONE
// `:seller_list` surface.
function myListings() {
  return [...LISTINGS.filter((l) => l.seller_id === 1), EXPIRED_MINE]
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(sellerListView);
}

/** The single-page `meta.pagination` envelope Rails' paginate_blue always sends. */
function onePage(items) {
  return {
    pagination: {
      current_page: 1,
      next_page: null,
      prev_page: null,
      total_count: items.length,
      total_pages: 1,
    },
  };
}

// ── Server ───────────────────────────────────────────────────────────────────

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

function tokenHeaders(persona) {
  return {
    "content-type": "application/json",
    "access-token": persona === "empty" ? TOKEN_EMPTY : TOKEN_FULL,
    client: "mock-client",
    uid: persona === "empty" ? "empty@hatiwal.test" : "buyer@hatiwal.test",
    "token-type": "Bearer",
  };
}

/** Which authenticated persona (if any) this request is for. */
function persona(req) {
  const t = req.headers["access-token"];
  if (t === TOKEN_FULL) return "full";
  if (t === TOKEN_EMPTY) return "empty";
  return null;
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname.replace(/^\/api\/v1/, "");
  const q = url.searchParams;
  const method = req.method;

  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }
    route(req, res, method, path, q, body);
  });
});

function route(req, res, method, path, q, body) {
  // Which persona (if any) this request authenticated as. Resolved up front
  // because /listings is a PUBLIC endpoint that Rails nonetheless personalises
  // when a bearer happens to be attached — the same request, two payloads.
  const who = persona(req);

  // ── Auth (unauthenticated) ──────────────────────────────────────────────
  if (method === "POST" && path === "/auth/sign_in") {
    const { email, password } = body;
    if (password === "Password123!" && (email === "buyer@hatiwal.test" || email === "empty@hatiwal.test")) {
      const p = email === "empty@hatiwal.test" ? "empty" : "full";
      res.writeHead(200, tokenHeaders(p === "empty" ? "empty" : "full"));
      res.end(JSON.stringify({ data: userMe(p === "empty" ? "empty" : "full") }));
      return;
    }
    return send(res, 401, { errors: ["Invalid login credentials. Please try again."] });
  }

  if (method === "POST" && path === "/auth") {
    // Registration. A taken email surfaces devise field errors.
    const { email, firstname, lastname } = body;
    if (!email || !firstname || !lastname) return send(res, 422, { errors: { full_messages: ["Missing required fields"] } });
    if (email === "taken@hatiwal.test") {
      return send(res, 422, { errors: { email: ["has already been taken"], full_messages: ["Email has already been taken"] } });
    }
    res.writeHead(200, tokenHeaders("full"));
    res.end(JSON.stringify({ data: userMe("full") }));
    return;
  }

  if (method === "DELETE" && path === "/auth") return send(res, 200, { status: "success" }); // schedule deletion
  if (method === "DELETE" && path === "/auth/sign_out") return send(res, 200, { success: true });

  // ── Public (no auth required) ───────────────────────────────────────────
  // `?with_counts` (any value, like Rails' params[:with_counts].present?) adds
  // active_listings_count to parents *and* subcategories; without it the plain
  // tree is returned, so both call sites stay covered.
  if (method === "GET" && path === "/categories") {
    return send(res, 200, {
      categories: q.get("with_counts") ? categoriesWithCounts() : CATEGORIES,
    });
  }

  // The feed. Public, but PERSONALISED when devise headers are attached (i.e.
  // when the browser fetched it through /api/me instead of /api/proxy): the
  // caller's hidden listings drop out and the payload carries their is_viewed and
  // is_saved flags — the two Sets ListingsController#index pre-computes. A guest
  // passes neither, so every flag is false, and their response is byte-identical
  // to what it always was.
  if (method === "GET" && path === "/listings") {
    let items = filterListings(q);
    if (who === "full") items = items.filter((l) => !HIDDEN_IDS.includes(l.id));
    const { slice, pagination } = paginate(items, q.get("page[number]"), q.get("page[size]"));
    return send(res, 200, {
      listings: slice.map((l) => listView(l, viewerSets(who))),
      meta: { pagination },
    });
  }

  // The dedicated similarity endpoint (Listing.similar_to): browsable stock in
  // the same category AND its children, source listing excluded, newest first,
  // capped at 8, and NO pagination envelope. Public, like /listings.
  // Declared before /listings/:id so the plain show route can't swallow it.
  const similarMatch = path.match(/^\/listings\/(\d+)\/similar$/);
  if (method === "GET" && similarMatch) {
    const source = findListing(similarMatch[1]);
    if (!source) return send(res, 404, { error: "Listing not found" });
    const ids = selfAndChildIds(source.category_id);
    const items = LISTINGS
      .filter((l) => l.status === "active" && ids.includes(l.category_id) && l.id !== source.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8);
    // #similar passes the same two Sets #index does, so a signed-in buyer's
    // cross-sell rail is flagged like their feed. (The web fetches this rail from
    // an RSC, i.e. always as a guest — mirrored anyway, not special-cased.)
    return send(res, 200, { listings: items.map((l) => listView(l, viewerSets(who))) });
  }

  // Public profile — guest-readable (mirrors Rails: skip_before_action
  // :authenticate_user!). Emits the :public view incl. the REV3 rating summary.
  const publicProfileMatch = path.match(/^\/users\/(\d+)\/public_profile$/);
  if (method === "GET" && publicProfileMatch) {
    const s = SELLERS[Number(publicProfileMatch[1])];
    if (!s) return send(res, 404, { error: "Not found" });
    return send(res, 200, {
      user: {
        ...s,
        avg_rating: s.id === 1 ? 4.7 : null,
        review_count: s.id === 1 ? 3 : 0,
      },
    });
  }

  // A seller's SOLD listings — guest-readable, the public profile's Sold tab
  // (`seller/seller-listings-tabs.tsx`, lazy-loaded when the tab is opened).
  // Rails' :list view, same envelope as /listings. Declared before /users/:id/…
  // authed routes for the same reason as the other public ones.
  const soldListingsMatch = path.match(/^\/users\/(\d+)\/sold_listings$/);
  if (method === "GET" && soldListingsMatch) {
    const uid = Number(soldListingsMatch[1]);
    const items = LISTINGS.filter(
      (l) => l.status === "sold" && l.seller_id === uid,
    );
    const { slice, pagination } = paginate(items, q.get("page[number]"), q.get("page[size]"));
    // No `viewed_ids:`/`saved_ids:` here — Users::SoldListingsController passes
    // neither, so every row reports is_viewed/is_saved false. Deliberate and
    // documented on that controller, not an oversight.
    return send(res, 200, { listings: slice.map((l) => listView(l)), meta: { pagination } });
  }

  // Reviews of a user — guest-readable (public trust surface, VISIBLE only).
  const reviewsMatch = path.match(/^\/users\/(\d+)\/reviews$/);
  if (method === "GET" && reviewsMatch) {
    const uid = Number(reviewsMatch[1]);
    const role = q.get("role");
    const items = uid === 1 && role === "of_seller" ? REVIEWS_OF_SELLER_1 : [];
    const { slice, pagination } = paginate(items, q.get("page[number]"), q.get("page[size]"));
    return send(res, 200, { reviews: slice, meta: { pagination } });
  }

  // ── Authenticated ─────────────────────────────────────────────────────────
  const requireAuth = () => {
    if (!who) { send(res, 401, { errors: ["You need to sign in or sign up before continuing."] }); return false; }
    return true;
  };
  const empty = who === "empty";

  // /users/me
  if (path === "/users/me") {
    if (!requireAuth()) return;
    if (method === "GET") return send(res, 200, { user: userMe(empty ? "empty" : "full") });
    if (method === "PUT" || method === "PATCH") {
      const patch = body && body.user ? body.user : {};
      return send(res, 200, { user: { ...userMe(empty ? "empty" : "full"), ...patch } });
    }
  }
  if (path === "/users/me/restore" && method === "POST") {
    if (!requireAuth()) return;
    return send(res, 200, { user: { ...userMe(empty ? "empty" : "full"), deletion_scheduled_at: null } });
  }

  // Saved listings
  if (path === "/my/saved_listings" && method === "GET") {
    if (!requireAuth()) return;
    // The `saved_by_listing_id:` surface: every row is a saved row by
    // construction, so is_saved is true from the map alone and the price-at-save
    // trio is filled here and nowhere else. This list is also the source EVERY
    // heart in the app can read (feed, detail, sticky bar) — see save-button.tsx.
    const listings = empty
      ? []
      : SAVED_IDS.map((id) => listView(findListing(id), { savedByListingId: SAVED_META }));
    return send(res, 200, { listings, meta: onePage(listings) });
  }
  const saveMatch = path.match(/^\/listings\/(\d+)\/(save|unsave)$/);
  if (saveMatch) {
    if (!requireAuth()) return;
    return send(res, 200, { ok: true });
  }

  // Hidden ("not interested") listings
  if (path === "/my/hidden_listings" && method === "GET") {
    if (!requireAuth()) return;
    // Derived from HIDDEN_IDS, the same array the feed filters on — so "hidden"
    // means one thing across both surfaces. My::HiddenListingsController passes
    // no viewer Sets, so is_viewed/is_saved are false even though listing 2 is in
    // fact saved: a dismissal list is not a buyer-intent surface (documented on
    // that controller).
    const listings = empty ? [] : HIDDEN_IDS.map((id) => listView(findListing(id)));
    return send(res, 200, { listings, meta: onePage(listings) });
  }
  const hideMatch = path.match(/^\/listings\/(\d+)\/(hide|unhide)$/);
  if (hideMatch) {
    if (!requireAuth()) return;
    if (hideMatch[2] === "unhide") return send(res, 204);
    return send(res, 200, { ok: true });
  }

  // Pending reviews — sold sales the caller still owes a review on (REV2).
  if (path === "/my/reviews/pending" && method === "GET") {
    if (!requireAuth()) return;
    const transactions = empty
      ? []
      : [
          {
            id: 501,
            status: "sold",
            final_price: 8000,
            currency: "AFN",
            completed_at: "2026-06-25T10:00:00Z",
            created_at: "2026-06-25T10:00:00Z",
            role: "seller", // caller is the seller → they review the buyer
            listing: { id: 7, title: "Leather Sofa (Sold)", thumbnail_url: null, price: 8000, currency: "AFN", status: "sold" },
            buyer: { id: 2, name: "Sara Ahmadi", avatar_url: null },
            seller: { id: 1, name: "Ahmad Karimi", avatar_url: null },
          },
        ];
    return send(res, 200, {
      transactions,
      meta: { pagination: { current_page: 1, next_page: null, prev_page: null, total_count: transactions.length, total_pages: 1 } },
    });
  }
  const createReviewMatch = path.match(/^\/transactions\/(\d+)\/reviews$/);
  if (createReviewMatch && method === "POST") {
    if (!requireAuth()) return;
    return send(res, 201, {
      review: {
        id: 900, rating: 5, comment: null, role: "of_buyer", visible: false,
        revealed_at: null, created_at: "2026-06-26T10:00:00Z",
        transaction_id: Number(createReviewMatch[1]), reviewee_id: 2,
        reviewer: { id: 1, name: "Ahmad Karimi", avatar_url: null },
      },
    });
  }

  // Seller dashboard
  if (path === "/my/listings" && method === "GET") {
    if (!requireAuth()) return;
    const listings = empty ? [] : myListings();
    return send(res, 200, { listings, meta: onePage(listings) });
  }
  if (path === "/my/listings" && method === "POST") {
    if (!requireAuth()) return;
    return send(res, 200, { listing: myListingView(1001) }); // created draft
  }
  const analyticsMatch = path.match(/^\/my\/listings\/(\d+)\/analytics$/);
  if (analyticsMatch && method === "GET") {
    if (!requireAuth()) return;
    return send(res, 200, { analytics: analytics() });
  }
  const lifecycleMatch = path.match(/^\/my\/listings\/(\d+)\/(publish|unpublish|reserve|activate|sold|renew)$/);
  if (lifecycleMatch && method === "PUT") {
    if (!requireAuth()) return;
    const statusByAction = { publish: "active", unpublish: "draft", reserve: "reserved", activate: "active", sold: "sold", renew: "active" };
    const action = lifecycleMatch[2];
    const v = myListingView(lifecycleMatch[1]);
    const payload = { listing: { ...v, status: statusByAction[action] } };
    // Like Rails: the `transaction` key exists ONLY when a real buyer was
    // identified (reserve/sold with buyer_id) — that is what a review hangs off.
    // A sale to "someone not on Hatiwal" sends no buyer and gets no transaction.
    if ((action === "sold" || action === "reserve") && body && body.buyer_id) {
      payload.transaction = {
        id: 601,
        status: action === "sold" ? "sold" : "reserved",
        final_price: body.final_price ? Number(body.final_price) : v.price,
        currency: v.currency,
        completed_at: action === "sold" ? new Date().toISOString() : null,
        created_at: new Date().toISOString(),
        role: null, // serialized without a current_user, like Rails
        listing: { id: v.id, title: v.title, thumbnail_url: null, price: v.price, currency: v.currency, status: statusByAction[action] },
        buyer: { id: Number(body.buyer_id), name: SELLERS[body.buyer_id]?.name ?? "Sara Ahmadi", avatar_url: null },
        seller: { id: 1, name: "Ahmad Karimi", avatar_url: null },
      };
    }
    return send(res, 200, payload);
  }
  const myShowMatch = path.match(/^\/my\/listings\/(\d+)$/);
  if (myShowMatch) {
    if (!requireAuth()) return;
    if (method === "GET") return send(res, 200, { listing: myListingView(myShowMatch[1]) });
    if (method === "PUT" || method === "PATCH") return send(res, 200, { listing: myListingView(myShowMatch[1]) });
    if (method === "DELETE") return send(res, 204);
  }

  // Chat
  if (path === "/conversations" && method === "GET") {
    if (!requireAuth()) return;
    const showArchived = q.get("archived") === "true";
    let convs = empty ? [] : showArchived ? ARCHIVED_CONVERSATIONS : CONVERSATIONS;
    const lid = q.get("listing_id");
    if (lid) convs = convs.filter((c) => String(c.listing.id) === lid);
    // Rails paginates this index (paginate_blue, 20/page) and the web client
    // pages through meta.pagination.next_page.
    const { slice, pagination } = paginate(convs, q.get("page[number]"), q.get("page[size]"));
    return send(res, 200, { conversations: slice, meta: { pagination } });
  }
  const startConvMatch = path.match(/^\/listings\/(\d+)\/conversations$/);
  if (startConvMatch && method === "POST") {
    if (!requireAuth()) return;
    return send(res, 200, { conversation: CONVERSATIONS[0] });
  }
  const msgMarkRead = path.match(/^\/conversations\/(\d+)\/messages\/mark_read$/);
  if (msgMarkRead && method === "PUT") {
    if (!requireAuth()) return;
    return send(res, 200, { ok: true });
  }
  // List-level thread mutations (kebab menu on /conversations). The mock holds
  // no state, so these only acknowledge: a spec that needs the SETTLED result
  // (e.g. an archived row staying gone after the refetch) models persistence in
  // the browser with page.route.
  const convAction = path.match(
    /^\/conversations\/(\d+)\/(archive|unarchive|mark_read|mark_unread)$/,
  );
  if (convAction && method === "PUT") {
    if (!requireAuth()) return;
    return send(res, 200, { ok: true });
  }
  const msgMatch = path.match(/^\/conversations\/(\d+)\/messages$/);
  if (msgMatch) {
    if (!requireAuth()) return;
    const cid = Number(msgMatch[1]);
    if (method === "GET") return send(res, 200, { messages: MESSAGES[cid] ?? [], meta: { pagination: { current_page: 1, next_page: null, prev_page: null, total_count: (MESSAGES[cid] ?? []).length, total_pages: 1 } } });
    if (method === "POST") {
      const text = body && body.body ? body.body : "photo.jpg";
      const kind = body && body.kind ? body.kind : "text";
      return send(res, 200, { message: { id: 9999, body: text, kind, read_at: null, created_at: "2026-06-22T16:00:00Z", responds_to_id: null, sender: { id: 1, name: "Ahmad Karimi", avatar_url: null }, attachment_url: null } });
    }
  }
  const convMatch = path.match(/^\/conversations\/(\d+)$/);
  if (convMatch) {
    if (!requireAuth()) return;
    // Archived threads are still openable, so resolve against both partitions.
    const conv = ALL_CONVERSATIONS.find((c) => String(c.id) === convMatch[1]);
    if (method === "GET") return conv ? send(res, 200, { conversation: conv }) : send(res, 404, { error: "Conversation not found" });
    if (method === "DELETE") return send(res, 204);
  }

  // Blocks
  if (path === "/blocks" && method === "GET") {
    if (!requireAuth()) return;
    return send(res, 200, { users: empty ? [] : BLOCKED_USERS });
  }
  const blockMatch = path.match(/^\/users\/(\d+)\/block$/);
  if (blockMatch && (method === "POST" || method === "DELETE")) {
    if (!requireAuth()) return;
    return send(res, 200, { ok: true });
  }

  // Reports
  if (path === "/reports" && method === "POST") {
    if (!requireAuth()) return;
    return send(res, 201, { report: { id: 1, status: "pending" } });
  }

  // Saved searches
  if (path === "/users/saved_searches") {
    if (!requireAuth()) return;
    if (method === "GET") return send(res, 200, { saved_searches: empty ? [] : SAVED_SEARCHES });
    if (method === "POST") return send(res, 201, { saved_search: SAVED_SEARCHES[0] });
  }
  const ssDelete = path.match(/^\/users\/saved_searches\/(\d+)$/);
  if (ssDelete && method === "DELETE") {
    if (!requireAuth()) return;
    return send(res, 204);
  }

  // Warnings
  if (path === "/users/warnings" && method === "GET") {
    if (!requireAuth()) return;
    return send(res, 200, { warnings: [], meta: { active_count: 0, threshold: 3 } });
  }
  if (path === "/users/warnings/mark_seen" && method === "PUT") {
    if (!requireAuth()) return;
    return send(res, 200, { ok: true });
  }

  // Public listing detail (after authed routes so /my/listings/:id wins).
  const showMatch = path.match(/^\/listings\/(\d+)$/);
  if (showMatch && method === "GET") {
    const l = findListing(showMatch[1]);
    return l ? send(res, 200, { listing: detailView(l) }) : send(res, 404, { error: "Listing not found" });
  }

  return send(res, 404, { error: "not found", path, method });
}

server.listen(PORT, () => {
  console.log(`[mock-api] listening on http://localhost:${PORT}/api/v1`);
});
