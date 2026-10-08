/**
 * privacy-b (api c178ae9): who is on the other side, and where their face links.
 *
 * A shop's face in API payloads — `listing.seller`, a conversation's `seller` /
 * `otherParticipant`, a `GET /blocks` row — carries `id: null` plus `shopId` and
 * `asShop: true` for anyone who is NOT on that shop's team. The owner's personal
 * id is never sent to buyers, so nothing may build `/sellers/${id}` (it would be
 * `/sellers/null`) or an owner check from `id` alone. These two helpers are the
 * one place that rule lives.
 */

export interface IdentityFace {
  id: number | null;
  shopId?: number | null;
  asShop?: boolean;
}

/** True when this face is a SHOP (not a person) — block/report/link the shop. */
export function isShopFace(p: IdentityFace | null | undefined): boolean {
  return !!p && (p.asShop === true || (p.id == null && p.shopId != null));
}

/**
 * The profile a face links to: the shop page for a shop face, the person's public
 * profile otherwise, and nothing at all when neither id is known (a deleted or
 * anonymised account) — never `/sellers/null`.
 */
export function profileHrefFor(
  p: IdentityFace | null | undefined,
): string | undefined {
  if (!p) return undefined;
  if (isShopFace(p)) return p.shopId != null ? `/shops/${p.shopId}` : undefined;
  return p.id != null ? `/sellers/${p.id}` : undefined;
}
