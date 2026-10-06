import { apiGet, ApiError } from "./client";
import { meRequest } from "./me";
import type { ShopCard, User } from "@/lib/types";

/**
 * SHOP-3 — the shop's team (hatiwal-mobile docs/SHOPS.md "Phase 3 — the team",
 * as built: api `shop-3-api` 29d86e3). Two roles: owner and staff. Every error
 * body is `{ error, code }`; `teamErrorKey` maps the code to a sentence in 4
 * locales (same keys as mobile), an unknown code falls back to the server text.
 */
export type ShopRole = "owner" | "staff";
export type InviteStatus = "pending" | "accepted" | "declined" | "cancelled" | "expired";

export interface ShopMember {
  user: { id: number; name: string; avatarUrl: string | null };
  role: ShopRole;
  joinedAt: string;
}

export interface ShopInvite {
  id: number;
  email: string | null;
  role: ShopRole;
  status: InviteStatus;
  url: string;
  expiresAt: string;
  createdAt: string;
}

export interface PublicInvite {
  shop: ShopCard;
  inviterName: string;
  role: ShopRole;
  status: InviteStatus;
  expiresAt: string;
}

/** A token as the API mints it (also what we accept from a URL). */
export const isInviteToken = (t: string | null | undefined): t is string => !!t && /^[A-Za-z0-9_-]{1,128}$/.test(t);

export async function getShopMembers(shopId: number): Promise<ShopMember[]> {
  return (await meRequest<{ shopMembers: ShopMember[] }>(`shops/${shopId}/members`)).shopMembers;
}

export async function removeShopMember(shopId: number, userId: number): Promise<void> {
  await meRequest(`shops/${shopId}/members/${userId}`, { method: "DELETE" });
}

export async function leaveShop(shopId: number): Promise<void> {
  await meRequest(`shops/${shopId}/membership`, { method: "DELETE" });
}

export async function getShopInvites(shopId: number): Promise<ShopInvite[]> {
  return (await meRequest<{ shopInvites: ShopInvite[] }>(`shops/${shopId}/invites`)).shopInvites;
}

/** No email = a plain link the owner shares. An email only notifies an existing confirmed account. */
export async function createShopInvite(shopId: number, email?: string): Promise<ShopInvite> {
  return (
    await meRequest<{ shopInvite: ShopInvite }>(`shops/${shopId}/invites`, {
      method: "POST",
      json: email ? { email: email.trim() } : {},
    })
  ).shopInvite;
}

export async function cancelShopInvite(shopId: number, inviteId: number): Promise<void> {
  await meRequest(`shops/${shopId}/invites/${inviteId}`, { method: "DELETE" });
}

/** Public: works for a guest (no proxy). */
export async function getPublicInvite(token: string): Promise<PublicInvite> {
  return (await apiGet<{ shopInvite: PublicInvite }>(`shop_invites/${encodeURIComponent(token)}`)).shopInvite;
}

export async function acceptShopInvite(token: string): Promise<{ me: User }> {
  return meRequest<{ me: User }>(`shop_invites/${encodeURIComponent(token)}/accept`, { method: "POST", json: {} });
}

export async function declineShopInvite(token: string): Promise<void> {
  await meRequest(`shop_invites/${encodeURIComponent(token)}/decline`, { method: "POST", json: {} });
}

export const TEAM_ERROR_CODES = [
  "invite_expired",
  "invite_used",
  "invite_cancelled",
  "invite_wrong_account",
  "not_a_member",
  "forbidden",
  "already_member",
  "cannot_invite_self",
  "shop_unavailable",
  "owner_cannot_leave",
  "team_full",
  "too_many_invites",
] as const;
export type TeamErrorCode = (typeof TEAM_ERROR_CODES)[number];

/** The 410s and the join refusals get a full page (T6); the rest are toasts. */
export const JOIN_PAGE_CODES: TeamErrorCode[] = [
  "invite_expired",
  "invite_used",
  "invite_cancelled",
  "invite_wrong_account",
  "already_member",
  "shop_unavailable",
];

export function teamErrorCode(err: unknown): TeamErrorCode | null {
  const code = err instanceof ApiError ? err.code : undefined;
  return code && (TEAM_ERROR_CODES as readonly string[]).includes(code) ? (code as TeamErrorCode) : null;
}

/** `team.errors.<code>` under the "shops" namespace, or null. */
export function teamErrorKey(err: unknown): string | null {
  const code = teamErrorCode(err);
  return code ? `team.errors.${code}` : null;
}
