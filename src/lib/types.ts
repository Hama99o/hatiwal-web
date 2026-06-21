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

export type ListingSort = "newest" | "oldest" | "price_asc" | "price_desc";

export interface SellerSummary {
  id: number;
  name: string;
  city: string | null;
  verified?: boolean;
  avatarUrl?: string | null;
  phone?: string | null;
  responseRatePercent?: number | null;
  responseTimeLabel?: string | null;
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
  thumbnailUrl: string | null;
  /** Unified, non-empty-when-possible list of full-size image urls. */
  images: string[];
  /** {signed-id, url} pairs (detail view only) — needed to remove photos on edit. */
  imageAttachments?: { id: string; url: string }[];
  viewsCount: number;
  conversationsCount?: number;
  isSaved?: boolean;
  isViewed?: boolean;
  expiresAt?: string | null;
  expired?: boolean;
  priceDropPercent?: number | null;
  priceDroppedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  seller: SellerSummary | null;
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
  itemsActiveCount?: number;
  itemsSoldCount?: number;
  savedItemsCount?: number;
  unreadMessageCount?: number;
  deletionScheduledAt?: string | null;
  createdAt: string;
}
