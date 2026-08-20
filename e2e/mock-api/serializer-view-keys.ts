/**
 * THE SNAPSHOT — the exact key set each `ListingSerializer` view puts on the
 * wire, transcribed by hand from
 * `hatiwal-api/app/serializers/listing_serializer.rb` (as of API commit
 * `30ac06f`, TASK-BE-SAVEDLIST).
 *
 * WHY IT EXISTS (TASK-WEB-MOCKSHAPE / FlowApp #256). `e2e/mock-api/server.mjs`
 * used ONE function to serve both `view :list` and `view :seller_list`, so every
 * feed row in the fixture carried `conversations_count` / `expired` /
 * `expires_at` — none of which `:list` has — while missing `negotiable`, which
 * it does. It had also, at one point, invented `is_saved` on `:list`, and a
 * Playwright spec was written against it: TASK-WEB-FEED250 shipped
 * reported-complete with an acceptance criterion the real API could not meet,
 * because the fixture proved it. A mock that drifts from the serializer is not
 * an oracle, it is a second source of truth.
 *
 * So the shapes are pinned: `e2e/mock-shape.spec.ts` asserts, browser-free and
 * over the wire, that every mock surface emits EXACTLY the set below for the
 * view it claims to render — no extras, nothing missing.
 *
 * HOW TO CHANGE IT. Only ever in this order:
 *   1. add/remove the field in `ListingSerializer` (with its own RSpec);
 *   2. update the constant here (the arrays are snake_case, i.e. pre-camel);
 *   3. update the matching function in `e2e/mock-api/server.mjs`.
 * Doing 3 without 1 is the defect this file exists to prevent. Nothing here can
 * read the Ruby — the two repos are separate and CI runs them apart — so this
 * transcription is the contract, and a serializer change that skips step 2 is
 * caught in review by the fact that this file was not touched.
 *
 * SCOPE. `ListingSerializer` only. The mock's other payloads (UserSerializer's
 * `:public` view behind /users/:id/public_profile, ConversationSerializer,
 * ReviewSerializer, TransactionSerializer) are NOT pinned yet; extending the
 * same guard to them is a follow-up, not a rewrite of this one.
 */

/** `fields :id, :title, … :created_at` — declared outside any view, so
 *  Blueprinter includes them in every named view below. */
const BASE_KEYS = [
  "id",
  "title",
  "price",
  "currency",
  "status",
  "location",
  "address",
  "condition",
  "created_at",
] as const;

/**
 * `view :list` — the browse feed (`GET /listings`), the similar rail, the Saved
 * screen, the hidden ("Not interested") list and a seller's public Sold tab.
 *
 * `is_saved` is here as of TASK-BE-SAVEDLIST; the price-at-save trio is always
 * on the wire too, and is null/false on every surface except /my/saved_listings
 * (the one caller that passes `saved_by_listing_id:`).
 */
export const LIST_VIEW_KEYS = [
  ...BASE_KEYS,
  "category_id",
  "views_count",
  "negotiable",
  "thumbnail_url",
  "image_urls",
  "is_viewed",
  "is_saved",
  "seller",
  "category",
  "price_drop_percent",
  "price_dropped_at",
  "price_at_save",
  "price_dropped",
  "price_drop_amount",
] as const;

/**
 * `view :seller_list` — `GET /my/listings` (My Shop) and nothing else.
 * Deliberately has NO `is_saved` / `is_viewed` / `seller`, and is the only list
 * view carrying the lifecycle timestamps, the expiry pair, the chat count and
 * the owner-only `sale` block.
 */
export const SELLER_LIST_VIEW_KEYS = [
  ...BASE_KEYS,
  "category_id",
  "views_count",
  "published_at",
  "reserved_at",
  "sold_at",
  "expires_at",
  "negotiable",
  "thumbnail_url",
  "image_urls",
  "conversations_count",
  "expired",
  "category",
  "price_drop_percent",
  "price_dropped_at",
  "sale",
] as const;

/** `view :detailed` — the public `GET /listings/:id`. */
export const DETAILED_VIEW_KEYS = [
  ...BASE_KEYS,
  "description",
  "category_id",
  "latitude",
  "longitude",
  "views_count",
  "published_at",
  "reserved_at",
  "sold_at",
  "updated_at",
  "expires_at",
  "negotiable",
  "images",
  "image_attachments",
  "thumbnail_url",
  "expired",
  "conversations_count",
  "saves_count",
  "is_saved",
  "is_viewed",
  "seller",
  "category",
  "price_dropped_at",
  "price_drop_percent",
  "share_url",
] as const;

/** `view :owner_detailed` — `include_view :detailed` + the owner-only `sale`.
 *  Everything under /my/listings/:id: show, create, update, lifecycle. */
export const OWNER_DETAILED_VIEW_KEYS = [
  ...DETAILED_VIEW_KEYS,
  "sale",
] as const;

/** `field(:seller)` inside `view :list` — public identity only. */
export const LIST_SELLER_KEYS = [
  "id",
  "name",
  "city",
  "verified",
  "avatar_url",
] as const;

/** `field(:seller)` inside `view :detailed` — identity plus the trust block
 *  (rating, response rate, recency, away mode) and the owner-gated phone. */
export const DETAILED_SELLER_KEYS = [
  "id",
  "name",
  "city",
  "phone",
  "verified",
  "avatar_url",
  "avg_rating",
  "review_count",
  "response_rate_percent",
  "response_time_label",
  "last_active_label",
  "seller_is_away",
  "seller_away_until",
] as const;

/** `field(:category)` on every view — `CategorySerializer`'s DEFAULT view, i.e.
 *  `fields :id, :slug, :icon, :position` plus the three localized names. */
export const CATEGORY_REF_KEYS = [
  "id",
  "slug",
  "icon",
  "position",
  "name_en",
  "name_ps",
  "name_fa",
] as const;
