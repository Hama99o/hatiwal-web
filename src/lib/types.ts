/**
 * Domain types — field names mirror the mobile app exactly (camelCase, post
 * snake→camel conversion of the Rails JSON). Keep these in sync with
 * hatiwal-mobile/src/api/* so web and mobile never diverge.
 */

export type ListingStatus = "draft" | "active" | "reserved" | "sold";
export const LISTING_STATUSES: ListingStatus[] = [
  "draft",
  "active",
  "reserved",
  "sold",
];

export type ListingCondition = "brand_new" | "like_new" | "good" | "fair";
export const LISTING_CONDITIONS: ListingCondition[] = [
  "brand_new",
  "like_new",
  "good",
  "fair",
];

// "nearest" orders by proximity to the buyer's coordinates — it additionally
// requires latitude/longitude (the browser Geolocation fix). Rails falls back
// to the default order if coordinates are absent. Matches mobile's ListingSort.
export type ListingSort =
  | "newest"
  | "oldest"
  | "price_asc"
  | "price_desc"
  | "most_viewed"
  | "nearest";

export interface SellerSummary {
  id: number;
  name: string;
  city: string | null;
  verified?: boolean;
  avatarUrl?: string | null;
  phone?: string | null;
  responseRatePercent?: number | null;
  responseTimeLabel?: string | null;
  lastActiveLabel?: "today" | "this_week" | "this_month" | null;
  /**
   * Away mode (mobile W628/W713). Present on the listing `:detailed` view seller
   * sub-object, and only when the seller is CURRENTLY away (a future datetime).
   * Both are absent/nil otherwise — never a stale past date.
   */
  sellerIsAway?: boolean;
  sellerAwayUntil?: string | null;
  /**
   * Combined double-blind rating (REV2/REV3). Emitted by the Rails
   * `UserSerializer` `:public` view. `avgRating` is null until the seller has
   * at least one revealed review (`reviewCount` 0).
   */
  avgRating?: number | null;
  reviewCount?: number;
}

/** A user's role in the sale being reviewed (mirrors the mobile contract). */
export type ReviewRole = "of_seller" | "of_buyer";

/** A single review — mirror of the Rails `ReviewSerializer` (no field renames). */
export interface Review {
  id: number;
  rating: number;
  comment: string | null;
  role: ReviewRole;
  visible: boolean;
  revealedAt: string | null;
  createdAt: string;
  transactionId: number;
  revieweeId: number;
  reviewer: { id: number; name: string; avatarUrl: string | null };
}

/** A sold/reserved sale — mirror of the Rails `TransactionSerializer`. Drives the
 *  pending-reviews nudge (each is a deal the caller still owes a review on). */
export interface Transaction {
  id: number;
  status: "reserved" | "sold";
  /**
   * PER UNIT on a multi-unit sale, not the deal total — the seller enters it in a
   * field placeholder-seeded with the listing's own per-unit price and captioned
   * "the price for one item". Multiply by `quantity` for a total.
   */
  finalPrice: number;
  currency: string;
  /**
   * How many units this deal covered (docs/SPIKE_LISTING_QUANTITY.md §0b). 1 on
   * a single-item listing — the column default.
   */
  quantity?: number;
  completedAt: string | null;
  createdAt: string;
  /** The caller's side of this sale — the counterparty is the other one. */
  role?: "buyer" | "seller" | null;
  listing: {
    id: number;
    title: string;
    thumbnailUrl: string | null;
    price: number;
    currency: string;
    status?: string;
    /** So a sales row can render "14,000 each" instead of a bare figure. */
    multiUnit?: boolean;
    availableUnits?: number;
  };
  /**
   * NULL for a sale recorded to "someone not on Hatiwal" (SF-B3 —
   * `clear_buyer: true`, stored as `buyer_id: nil`). That is a real, ledgered
   * sale with no counterparty account: the row must still render its quantity,
   * price and date, with a "buyer not on Hatiwal" label in place of an identity.
   *
   * Anything that reviews a counterparty must GUARD on this, not assume it —
   * `GET /my/reviews/pending` filters buyer-less rows out server-side
   * (`with_counterparty`), but the mark-sold lifecycle response does NOT: since
   * SF-B3 it returns a transaction for the outside-buyer path too.
   */
  buyer: { id: number; name: string; avatarUrl: string | null } | null;
  seller: { id: number; name: string; avatarUrl: string | null };
}

export interface CategoryRef {
  id: number;
  nameEn: string;
  namePs: string;
  nameFa: string;
  slug: string;
}

export interface Category extends CategoryRef {
  icon?: string;
  position?: number;
  parentId?: number | null;
  subcategories?: Category[];
  /**
   * Browsable (active, unexpired, not removed) listings in this category,
   * including everything filed under its subcategories — the same set
   * `?category_id=` returns. Present on top-level categories *and* on each
   * nested subcategory when fetched with `?with_counts=true`. Same field and
   * semantics as mobile's `Category.activeListingsCount`.
   */
  activeListingsCount?: number;
}

export interface Listing {
  id: number;
  title: string;
  description: string | null;
  /** Always a number here (Rails sends a string like "50.0" — normalized on ingest). */
  price: number;
  currency: string;
  condition: ListingCondition | null;
  status: ListingStatus;
  categoryId: number | null;
  category: CategoryRef | null;
  location: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  /**
   * SAFETY-1 — how precise the coordinates above are. `"approximate"` on every
   * PUBLIC view (the server snaps the point to a ~500m grid, because publishing
   * a private seller's exact home coordinate unauthenticated is a real safety
   * exposure); `"exact"` only on the owner's own view, so the edit form
   * round-trips the true point.
   *
   * A client seeing `"approximate"` must draw an AREA, never a pin. Absent on
   * older payloads — treat a missing value as approximate, the safe reading.
   * Mirrors mobile's `locationPrecision`/`locationRadiusM`.
   */
  locationPrecision?: "approximate" | "exact" | null;
  /** Radius in METRES to draw for an approximate point. */
  locationRadiusM?: number | null;
  thumbnailUrl: string | null;
  /** Unified, non-empty-when-possible list of full-size image urls. */
  images: string[];
  /** {signed-id, url} pairs (detail view only) — needed to remove photos on edit. */
  imageAttachments?: { id: string; url: string }[];
  viewsCount: number;
  /** How many people have saved this listing (detail view — from saves_count). */
  savesCount?: number;
  conversationsCount?: number;
  /**
   * On `:detailed` and — since TASK-BE-SAVEDLIST — on `:list` too, so every feed
   * row carries it. Still not the whole truth: an ANONYMOUS fetch (ISR pages, the
   * Bazaar's SSR seed, the anonymous fallback) reports `false` for a listing the
   * viewer has saved, and `:seller_list` omits the field entirely. So treat only
   * `true` as authoritative, never `false`/absent as "not saved" — see
   * components/shared/save-button.tsx.
   */
  isSaved?: boolean;
  /** Feed rows too, but only on a payload fetched WITH a bearer (`:list` +
   *  `viewed_ids:`) — an anonymous fetch always reports false. */
  isViewed?: boolean;
  expiresAt?: string | null;
  expired?: boolean;
  priceDropPercent?: number | null;
  priceDroppedAt?: string | null;
  /**
   * Whether the seller is open to offers. `false` = firm price (mirrors mobile
   * N071): show the "Firm price" badge and hide the make-offer affordance.
   * Undefined/true = negotiable (the default when the flag is absent).
   */
  negotiable?: boolean;
  /**
   * Multi-quantity (docs/SPIKE_LISTING_QUANTITY.md). All three arrive on EVERY
   * listing view — they are base fields on ListingSerializer, not view-scoped —
   * so a feed row and a detail page always agree.
   *
   * `quantity` is what the seller has in total; `availableUnits` is what is LEFT
   * (never show `quantity` to a buyer as availability — a stale count is the
   * feature's top risk); `multiUnit` is the flag every client gates its quantity
   * UI on, so mobile and web can never disagree about the same listing.
   */
  quantity?: number;
  availableUnits?: number;
  multiUnit?: boolean;
  /**
   * SF-B2 — units currently HELD for one buyer, as a plain count. A base field
   * on every serializer view (feed row, detail, seller list), so the stock pill
   * reads the same number wherever it renders.
   *
   * PUBLIC-SAFE: a count, never an identity. The held buyer's NAME is
   * owner-only and arrives on `sale` below — never read it from here.
   *
   * NOTE the trap this field exists to close: a multi-unit batch deliberately
   * stays `status: "active"` while units are held, so `status === "reserved"`
   * does NOT mean "has a hold". Ask `heldUnitsOf()` / `sale`, never the status.
   */
  heldUnits?: number;
  /**
   * SF-B5 — how many SOLD rows this listing's ledger holds. `sale` below is only
   * the LATEST one; this is the number that says there are others, and it gates
   * the "View sales" entry into the ledger.
   */
  salesCount?: number;
  /**
   * OWNER-ONLY (`:seller_list` / `:owner_detailed` views only — absent on the
   * public feed and detail payloads, by design: the counterparty's identity is
   * owner-scoped). The listing's current open hold, or its latest sale once
   * sold. Null when there is neither.
   */
  sale?: ListingSale | null;
  createdAt: string;
  updatedAt?: string;
  seller: SellerSummary | null;
}

/**
 * The owner-only `sale` block on a listing (Rails `ListingSerializer::SALE_FIELD`).
 *
 * `status: "reserved"` is THE test for "this listing has a hold" — correct for a
 * single-item hold (whose listing status also flips to `reserved`) AND for a
 * multi-unit hold (whose listing stays `active`). It is the one check that
 * covers both item counts, which is exactly why the release-hold affordance is
 * gated on it rather than on `listing.status`.
 */
export interface ListingSale {
  id: number;
  status: "reserved" | "sold";
  /** PER UNIT on a multi-unit deal, not the deal total. */
  finalPrice: number | null;
  currency: string | null;
  /** How many units this buyer took/holds. */
  quantity?: number;
  completedAt: string | null;
  /**
   * NULL for a sale to "someone not on Hatiwal" (SF-B3). The sale is real and
   * must still render — only the counterparty is absent.
   */
  buyer: { id: number; name: string; avatarUrl: string | null; verified?: boolean } | null;
  /** The thread with this buyer, when there is one. Null for an outside buyer. */
  conversationId?: number | null;
}

export interface Pagination {
  currentPage: number;
  nextPage: number | null;
  prevPage: number | null;
  totalCount: number;
  totalPages: number;
}

export interface ListingsResult {
  items: Listing[];
  pagination: Pagination;
}

// ── Chat (Phase 4) ──────────────────────────────────────────────────────────

export type MessageKind =
  | "text"
  | "meetup_proposal"
  | "meetup_accepted"
  | "meetup_declined"
  | "offer"
  | "offer_counter"
  | "offer_accepted"
  | "offer_declined"
  | "system"
  | "document"
  | "image_message";

export interface Message {
  id: number;
  body: string;
  kind: MessageKind;
  readAt: string | null;
  createdAt: string;
  respondsToId: number | null;
  sender: { id: number; name: string; avatarUrl?: string | null };
  attachmentUrl?: string | null;
  /**
   * For `offer` and `offer_counter` kinds, the server pre-parses the pipe-encoded
   * body ("amount|currency|listedPrice") into these fields. Absent on other kinds.
   */
  offerAmount?: number | null;
  offerCurrency?: string | null;
  /**
   * SF-B11 — how many units the offer is for. A real column (not parsed out of
   * the pipe-encoded body, which every client already reads and which must not
   * grow a 4th segment), returned on every message.
   *
   * `null` means UNSPECIFIED, **not one**: it is null for every non-offer, every
   * offer on a single-item listing, and every offer sent before this field
   * existed. Treat null as one unit for arithmetic, but render no
   * agreed-quantity UI for it — that is what keeps a single-item listing
   * byte-identical to before the field existed.
   */
  offerQuantity?: number | null;
  /** Soft-delete tombstone: when true, body/attachment are suppressed server-side. */
  deleted?: boolean;
  deletedAt?: string | null;
}

export interface ConversationParticipant {
  id: number;
  name: string;
  city?: string | null;
  verified?: boolean;
  avatarUrl?: string | null;
}

export interface Conversation {
  id: number;
  status: "open" | "closed";
  lastMessageAt: string | null;
  createdAt: string;
  listing: {
    id: number;
    title: string;
    thumbnailUrl: string | null;
    status: string;
    price?: number;
    currency?: string;
    /**
     * Multi-quantity (docs/SPIKE_LISTING_QUANTITY.md). On BOTH the inbox
     * (`:list`) and the thread (`:detailed`) — ConversationSerializer
     * hand-rolls its own listing hash, so these had to be added to it
     * explicitly. `multiUnit` gates the "each" price suffix; `availableUnits`
     * lets the thread's own sold flow ask "how many did you sell?".
     */
    multiUnit?: boolean;
    availableUnits?: number;
    location?: string | null;
  };
  otherParticipant?: ConversationParticipant;
  buyer?: ConversationParticipant;
  seller?: ConversationParticipant;
  lastMessageBody?: string | null;
  lastMessageKind?: MessageKind | null;
  unreadCount?: number;
  blockedWithParticipant?: boolean;
}

/** The signed-in user (camelCase of the Rails `/users/me` `:me` serializer view). */
export interface User {
  id: number;
  email: string;
  firstname: string;
  lastname: string;
  fullName: string;
  city: string | null;
  province: string | null;
  phone: string | null;
  bio: string | null;
  latitude: number | null;
  longitude: number | null;
  avatarUrl: string | null;
  preferredLanguage: "en" | "ps" | "fa";
  preferredTheme: "light" | "dark" | "system";
  sellerMode: boolean;
  status: string;
  verified: boolean;
  /**
   * Whether this account's email address has been confirmed.
   *
   * A boolean from the API, not the timestamp — this only decides whether to show
   * the "confirm your email" prompt. Optional because an older API build does not
   * send it, and that case is treated as CONFIRMED so the prompt never appears for
   * someone who cannot act on it.
   */
  emailConfirmed?: boolean;
  itemsActiveCount?: number;
  itemsSoldCount?: number;
  savedItemsCount?: number;
  unreadMessageCount?: number;
  deletionScheduledAt?: string | null;
  /**
   * Away mode (mobile W713). `isAway` is the computed flag (true only when
   * `awayUntil` is a future datetime); `awayUntil` is the ISO end datetime, or
   * null when not away. Set via `PUT /users/me { user: { awayUntil } }`.
   */
  isAway?: boolean;
  awayUntil?: string | null;
  /**
   * Own double-blind rating (REV2/REV3) — the `:me` view emits the same
   * `avg_rating`/`review_count` pair as the `:public` view, so a seller can see
   * their own reputation. `avgRating` is null until a first review is revealed.
   */
  avgRating?: number | null;
  reviewCount?: number;
  createdAt: string;
}
