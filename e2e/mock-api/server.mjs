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

function catRef(id) {
  const c = CAT[id] || CAT[1];
  return { id: c.id, name_en: c.name_en, name_ps: c.name_ps, name_fa: c.name_fa, slug: c.slug };
}

// Master listings table. /listings exposes only active (like Listing.browsable);
// /listings/:id returns any (detail shows a status notice for reserved/sold).
// Seller 1 (the logged-in buyer persona) owns a listing in every lifecycle state,
// so the seller dashboard's status tabs are all populated.
const LISTINGS = [
  { id: 1, title: "iPhone 13 Pro", price: 45000, currency: "AFN", status: "active", location: "Kabul", address: "Shar-e-Naw", condition: "good", category_id: 101, seller_id: 1, views_count: 120, created_at: "2026-06-20T10:00:00Z", price_drop_percent: 12, price_dropped_at: "2026-06-19T10:00:00Z", description: "Barely used iPhone 13 Pro, 256GB." },
  { id: 2, title: "Samsung 4K TV", price: 30000, currency: "AFN", status: "active", location: "Kabul", address: null, condition: "like_new", category_id: 1, seller_id: 2, views_count: 80, created_at: "2026-06-18T10:00:00Z", price_drop_percent: null, price_dropped_at: null, description: "55 inch 4K smart TV." },
  { id: 3, title: "Toyota Corolla 2015", price: 600000, currency: "AFN", status: "active", location: "Herat", address: null, condition: "fair", category_id: 2, seller_id: 1, views_count: 300, created_at: "2026-06-15T10:00:00Z", price_drop_percent: null, price_dropped_at: null, description: "Clean title, well maintained." },
  { id: 4, title: "Winter Jacket", price: 1200, currency: "AFN", status: "active", location: "Mazar-i-Sharif", address: null, condition: "like_new", category_id: 3, seller_id: 2, views_count: 25, created_at: "2026-06-21T10:00:00Z", price_drop_percent: null, price_dropped_at: null, description: "Warm winter jacket, size L." },
  // The one listing NOBODY has messaged about (conversations_count 0, which Rails
  // always emits): drives the "count badge hides at zero" case that the majority
  // of owner views actually are.
  { id: 5, title: "MacBook Pro M2", price: 90000, currency: "AFN", status: "active", location: "Kabul", address: null, condition: "good", category_id: 102, seller_id: 1, views_count: 210, conversations_count: 0, created_at: "2026-06-17T10:00:00Z", price_drop_percent: null, price_dropped_at: null, description: "16GB RAM, 512GB SSD." },
  // Not in the public feed; reachable by id for detail edge cases.
  { id: 6, title: "Mountain Bike (Reserved)", price: 5000, currency: "AFN", status: "reserved", location: "Kabul", address: null, condition: "good", category_id: 2, seller_id: 2, views_count: 40, created_at: "2026-06-10T10:00:00Z", price_drop_percent: null, price_dropped_at: null, description: "Reserved for a buyer." },
  { id: 7, title: "Leather Sofa (Sold)", price: 8000, currency: "AFN", status: "sold", location: "Herat", address: null, condition: "fair", category_id: 3, seller_id: 1, views_count: 95, created_at: "2026-06-05T10:00:00Z", price_drop_percent: null, price_dropped_at: null, description: "Already sold." },
  // Seller 1's draft + reserved, so My Shop has all statuses.
  { id: 8, title: "Antique Carpet", price: 15000, currency: "AFN", status: "draft", location: "Kabul", address: null, condition: "good", category_id: 3, seller_id: 1, views_count: 0, created_at: "2026-06-22T08:00:00Z", price_drop_percent: null, price_dropped_at: null, description: "Hand-woven, not yet published." },
  { id: 9, title: "Gaming PC", price: 70000, currency: "AFN", status: "reserved", location: "Kabul", address: null, condition: "like_new", category_id: 102, seller_id: 1, views_count: 60, created_at: "2026-06-12T08:00:00Z", price_drop_percent: null, price_dropped_at: null, description: "RTX 3070, reserved for a buyer." },
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

function findListing(id) {
  return [...LISTINGS, EXPIRED_MINE, EXPIRING_SOON_MINE].find(
    (l) => String(l.id) === String(id),
  );
}

function listView(l) {
  return {
    id: l.id, title: l.title, price: l.price, currency: l.currency, status: l.status,
    location: l.location, address: l.address, condition: l.condition, created_at: l.created_at,
    category_id: l.category_id, views_count: l.views_count,
    // Rails emits this for every listing, 0 included — per-fixture override so a
    // listing with no chats can be asserted on.
    conversations_count: l.conversations_count ?? 2, thumbnail_url: null, image_urls: [],
    expired: l.expired ?? false, expires_at: l.expires_at ?? null,
    is_viewed: false, is_saved: false, seller: SELLERS[l.seller_id], category: catRef(l.category_id),
    price_drop_percent: l.price_drop_percent, price_dropped_at: l.price_dropped_at,
  };
}

function detailView(l) {
  return {
    ...listView(l),
    description: l.description, latitude: 34.55, longitude: 69.2,
    published_at: l.created_at, reserved_at: null, sold_at: null, updated_at: l.created_at,
    expires_at: l.expires_at ?? null,
    images: [], image_attachments: [], expired: l.expired ?? false,
    conversations_count: l.conversations_count ?? 2,
    is_saved: false,
    seller: { ...SELLERS[l.seller_id], phone: null },
    category: catRef(l.category_id),
  };
}

/** A listing owned by user 1 by id — falls back to a synthesized draft so a
 * freshly-created listing (POST → redirect → detail) always renders. */
function myListingView(id) {
  const found = findListing(id);
  if (found) return detailView(found);
  return detailView({
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
const CONVERSATIONS = [
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
];

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

// My Shop: seller 1's listings across all statuses (newest first).
function myListings() {
  return [...LISTINGS.filter((l) => l.seller_id === 1), EXPIRED_MINE]
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(listView);
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

  if (method === "GET" && path === "/listings") {
    const items = filterListings(q);
    const { slice, pagination } = paginate(items, q.get("page[number]"), q.get("page[size]"));
    return send(res, 200, { listings: slice.map(listView), meta: { pagination } });
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
    return send(res, 200, { listings: items.map(listView) });
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
    return send(res, 200, { listings: slice.map(listView), meta: { pagination } });
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
  const who = persona(req);
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
    const listings = empty ? [] : [listView(findListing(2)), listView(findListing(4))];
    return send(res, 200, { listings });
  }
  const saveMatch = path.match(/^\/listings\/(\d+)\/(save|unsave)$/);
  if (saveMatch) {
    if (!requireAuth()) return;
    return send(res, 200, { ok: true });
  }

  // Hidden ("not interested") listings
  if (path === "/my/hidden_listings" && method === "GET") {
    if (!requireAuth()) return;
    const listings = empty ? [] : [listView(findListing(2))];
    return send(res, 200, {
      listings,
      meta: {
        pagination: {
          current_page: 1,
          next_page: null,
          prev_page: null,
          total_count: listings.length,
          total_pages: 1,
        },
      },
    });
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
    return send(res, 200, { listings: empty ? [] : myListings() });
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
    let convs = empty ? [] : CONVERSATIONS;
    const lid = q.get("listing_id");
    if (lid) convs = convs.filter((c) => String(c.listing.id) === lid);
    return send(res, 200, { conversations: convs });
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
    const conv = CONVERSATIONS.find((c) => String(c.id) === convMatch[1]);
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
