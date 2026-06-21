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

const SELLERS = {
  1: { id: 1, name: "Ahmad Karimi", city: "Kabul", verified: true, avatar_url: null,
       response_rate_percent: 90, response_time_label: "within_one_hour" },
  2: { id: 2, name: "Sara Ahmadi", city: "Herat", verified: false, avatar_url: null,
       response_rate_percent: null, response_time_label: null },
  3: { id: 3, name: "Najib Rahimi", city: "Kabul", verified: true, avatar_url: null,
       response_rate_percent: 75, response_time_label: "within_a_day" },
};

const CATEGORIES = [
  { id: 1, slug: "electronics", icon: "📱", position: 1,
    name_en: "Electronics", name_ps: "برقي وسایل", name_fa: "وسایل برقی",
    subcategories: [
      { id: 101, slug: "phones", icon: "📱", position: 1, name_en: "Phones & Tablets", name_ps: "موبایلونه", name_fa: "گوشی و تبلت", subcategories: [] },
      { id: 102, slug: "laptops", icon: "💻", position: 2, name_en: "Computers & Laptops", name_ps: "کمپیوترونه", name_fa: "کامپیوتر و لپ‌تاپ", subcategories: [] },
    ] },
  { id: 2, slug: "vehicles", icon: "🚗", position: 2, name_en: "Vehicles", name_ps: "موټرونه", name_fa: "وسایل نقلیه", subcategories: [] },
  { id: 3, slug: "clothes", icon: "👗", position: 3, name_en: "Clothes & Fashion", name_ps: "کالي او فیشن", name_fa: "لباس و مد", subcategories: [] },
];

const CAT = { 1: CATEGORIES[0], 2: CATEGORIES[1], 3: CATEGORIES[2], 101: CATEGORIES[0].subcategories[0], 102: CATEGORIES[0].subcategories[1] };

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
  { id: 5, title: "MacBook Pro M2", price: 90000, currency: "AFN", status: "active", location: "Kabul", address: null, condition: "good", category_id: 102, seller_id: 1, views_count: 210, created_at: "2026-06-17T10:00:00Z", price_drop_percent: null, price_dropped_at: null, description: "16GB RAM, 512GB SSD." },
  // Not in the public feed; reachable by id for detail edge cases.
  { id: 6, title: "Mountain Bike (Reserved)", price: 5000, currency: "AFN", status: "reserved", location: "Kabul", address: null, condition: "good", category_id: 2, seller_id: 2, views_count: 40, created_at: "2026-06-10T10:00:00Z", price_drop_percent: null, price_dropped_at: null, description: "Reserved for a buyer." },
  { id: 7, title: "Leather Sofa (Sold)", price: 8000, currency: "AFN", status: "sold", location: "Herat", address: null, condition: "fair", category_id: 3, seller_id: 1, views_count: 95, created_at: "2026-06-05T10:00:00Z", price_drop_percent: null, price_dropped_at: null, description: "Already sold." },
  // Seller 1's draft + reserved, so My Shop has all statuses.
  { id: 8, title: "Antique Carpet", price: 15000, currency: "AFN", status: "draft", location: "Kabul", address: null, condition: "good", category_id: 3, seller_id: 1, views_count: 0, created_at: "2026-06-22T08:00:00Z", price_drop_percent: null, price_dropped_at: null, description: "Hand-woven, not yet published." },
  { id: 9, title: "Gaming PC", price: 70000, currency: "AFN", status: "reserved", location: "Kabul", address: null, condition: "like_new", category_id: 102, seller_id: 1, views_count: 60, created_at: "2026-06-12T08:00:00Z", price_drop_percent: null, price_dropped_at: null, description: "RTX 3070, reserved for a buyer." },
];

function findListing(id) {
  return LISTINGS.find((l) => String(l.id) === String(id));
}

function listView(l) {
  return {
    id: l.id, title: l.title, price: l.price, currency: l.currency, status: l.status,
    location: l.location, address: l.address, condition: l.condition, created_at: l.created_at,
    category_id: l.category_id, views_count: l.views_count, conversations_count: 2, thumbnail_url: null, image_urls: [],
    is_viewed: false, is_saved: false, seller: SELLERS[l.seller_id], category: catRef(l.category_id),
    price_drop_percent: l.price_drop_percent, price_dropped_at: l.price_dropped_at,
  };
}

function detailView(l) {
  return {
    ...listView(l),
    description: l.description, latitude: 34.55, longitude: 69.2,
    published_at: l.created_at, reserved_at: null, sold_at: null, updated_at: l.created_at, expires_at: null,
    images: [], image_attachments: [], expired: false, conversations_count: 2,
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
    return { id: 99, email: "empty@hatiwal.test", firstname: "Sahar", lastname: "Noor", full_name: "Sahar Noor", city: null, province: null, phone: null, bio: null, latitude: null, longitude: null, preferred_language: "en", preferred_theme: "system", seller_mode: false, status: "active", verified: false, avatar_url: null, items_active_count: 0, items_sold_count: 0, saved_items_count: 0, unread_message_count: 0, deletion_scheduled_at: null, created_at: "2026-02-01T00:00:00Z" };
  }
  return { id: 1, email: "buyer@hatiwal.test", firstname: "Ahmad", lastname: "Karimi", full_name: "Ahmad Karimi", city: "Kabul", province: "Kabul", phone: "+93 700 000 000", bio: "Trusted local seller.", latitude: 34.55, longitude: 69.2, preferred_language: "en", preferred_theme: "system", seller_mode: true, status: "active", verified: true, avatar_url: null, items_active_count: 3, items_sold_count: 1, saved_items_count: 2, unread_message_count: 2, deletion_scheduled_at: null, created_at: "2026-01-01T00:00:00Z" };
}

// Chat fixtures (buyer persona). Conversation/Message use snake_case keys.
const CONVERSATIONS = [
  { id: 1, status: "open", last_message_at: "2026-06-21T15:00:00Z", created_at: "2026-06-20T10:00:00Z",
    listing: { id: 1, title: "iPhone 13 Pro", thumbnail_url: null, status: "active", price: 45000, currency: "AFN", location: "Kabul" },
    other_participant: { id: 2, name: "Sara Ahmadi", city: "Herat", verified: false, avatar_url: null },
    unread_count: 2, last_message_body: "Is this still available?", last_message_kind: "text", blocked_with_participant: false },
  { id: 2, status: "closed", last_message_at: "2026-06-19T12:00:00Z", created_at: "2026-06-18T10:00:00Z",
    listing: { id: 3, title: "Toyota Corolla 2015", thumbnail_url: null, status: "active", price: 600000, currency: "AFN", location: "Herat" },
    other_participant: { id: 3, name: "Najib Rahimi", city: "Kabul", verified: true, avatar_url: null },
    unread_count: 0, last_message_body: "Thanks!", last_message_kind: "text", blocked_with_participant: false },
];

const MESSAGES = {
  // Returned newest-first (Rails order); chat.ts reverses for display.
  1: [
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

function filterListings(q) {
  let items = LISTINGS.filter((l) => l.status === "active");
  if (q.get("status")) items = LISTINGS.filter((l) => l.status === q.get("status"));
  if (q.get("category_id")) items = items.filter((l) => String(l.category_id) === q.get("category_id"));
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
  return LISTINGS.filter((l) => l.seller_id === 1)
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
  if (method === "GET" && path === "/categories") return send(res, 200, { categories: CATEGORIES });

  if (method === "GET" && path === "/listings") {
    const items = filterListings(q);
    const { slice, pagination } = paginate(items, q.get("page[number]"), q.get("page[size]"));
    return send(res, 200, { listings: slice.map(listView), meta: { pagination } });
  }

  // Public profile mirrors Rails: guest-forbidden.
  if (method === "GET" && /^\/users\/\d+\/public_profile$/.test(path)) {
    return send(res, 401, { errors: ["You need to sign in or sign up before continuing."] });
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
    const v = myListingView(lifecycleMatch[1]);
    return send(res, 200, { listing: { ...v, status: statusByAction[lifecycleMatch[2]] } });
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
