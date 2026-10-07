import { meRequest } from "./me";
import type { ShopCard } from "../types";

/**
 * A seller's numbers for ONE identity — Me (`shopId` null) or one shop they
 * are on (owner, 2026-10-12; item 2; hatiwal-mobile docs/design/SELLER_ANALYTICS.md).
 * Never global. Mirrors mobile's src/api/analytics.ts.
 */
export interface SellerAnalytics {
  /** The shop these numbers are for; null = Me. */
  shop: ShopCard | null;
  total: number;
  active: number;
  expired: number;
  sold: number;
  draft: number;
  sales: number;
  unitsSold: number;
  views: number;
  chats: number;
}

export const sellerAnalyticsKey = (shopId: number | null) => ["seller-analytics", shopId ?? "me"] as const;

export async function getSellerAnalytics(shopId: number | null): Promise<SellerAnalytics> {
  const q = shopId != null ? `?shop_id=${shopId}` : "";
  return (await meRequest<{ analytics: SellerAnalytics }>(`my/analytics${q}`)).analytics;
}

/** "Relaunch all": renew every expired listing of this identity (+90 days, no bump). */
export async function relaunchExpired(shopId: number | null): Promise<{ renewed: number; failed: number }> {
  return meRequest(`my/listings/relaunch_expired`, { method: "POST", json: { shopId } });
}
