import { ApiError, readApiError } from "./client";
import { convertKeysToCamel } from "./case";
import { PROXY_BASE } from "@/lib/env";
import { meRequest } from "./me";
import type { ShopCard, User } from "@/lib/types";

/**
 * SHOP-3 — the shop's team (hatiwal-mobile docs/SHOPS.md "Phase 3 — the team",
 * as built: api `shop-3-api` 29d86e3; Manager, change role, transfer: 76ca115).
 * Three roles: owner, manager, staff. Every error
 * body is `{ error, code }`; `teamErrorKey` maps the code to a sentence in 4
 * locales (same keys as mobile), an unknown code falls back to the server text.
 */
export type ShopRole = "owner" | "manager" | "staff";
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

/** "Replied by": the member who wrote a shop-chat message, sent to members only. */
export interface SentBy {
  id: number;
  name: string;
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

/** Owner only: manager ⇄ staff. */
export async function changeShopMemberRole(shopId: number, userId: number, role: "manager" | "staff"): Promise<ShopMember> {
  return (await meRequest<{ shopMember: ShopMember }>(`shops/${shopId}/members/${userId}`, { method: "PATCH", json: { role } })).shopMember;
}

/**
 * Owner only: the member becomes the owner, the caller a Manager, and a
 * Verified badge is dropped (it vouched for the old owner's ID). Answers the
 * shop (owner view, the caller's new role) and the caller's fresh `me`.
 */
export async function transferShop(shopId: number, userId: number): Promise<{ shop: unknown; me: User }> {
  return meRequest<{ shop: unknown; me: User }>(`shops/${shopId}/transfer`, { method: "POST", json: { userId } });
}

export async function cancelShopInvite(shopId: number, inviteId: number): Promise<void> {
  await meRequest(`shops/${shopId}/invites/${inviteId}`, { method: "DELETE" });
}

/** Email invites only (they are bound to their address); a link invite → 422 link_invite. */
export async function resendShopInvite(shopId: number, inviteId: number): Promise<ShopInvite> {
  return (await meRequest<{ shopInvite: ShopInvite }>(`shops/${shopId}/invites/${inviteId}/resend`, { method: "POST", json: {} })).shopInvite;
}

/**
 * Public: works for a guest (the public GET proxy). Read by hand rather than
 * apiGet, which drops the error body: the Join page must tell "no such
 * invite" (404 → expired) from "couldn't load it" (offline / 5xx / 429 → retry).
 */
export async function getPublicInvite(token: string): Promise<PublicInvite> {
  const res = await fetch(`${PROXY_BASE}/shop_invites/${encodeURIComponent(token)}`, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) {
    const { errors, code, details } = await readApiError(res);
    throw new ApiError(res.status, `GET shop_invites ${res.status}`, errors, code, details);
  }
  return convertKeysToCamel<{ shopInvite: PublicInvite }>(await res.json()).shopInvite;
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
  "invite_email_unconfirmed",
  "link_invite",
  "not_a_member",
  "forbidden",
  "already_member",
  "cannot_invite_self",
  "shop_unavailable",
  "owner_cannot_leave",
  "team_full",
  "too_many_invites",
  "cannot_change_owner",
  "invalid_role",
  "cannot_transfer_to_self",
  "verification_pending",
] as const;
export type TeamErrorCode = (typeof TEAM_ERROR_CODES)[number];

/** The 410s and the join refusals get a full page (T6); the rest are toasts. */
export const JOIN_PAGE_CODES: TeamErrorCode[] = [
  "invite_expired",
  "invite_used",
  "invite_cancelled",
  "invite_wrong_account",
  "invite_email_unconfirmed",
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
