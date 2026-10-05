"use client";

import { VerifyFlow } from "@/components/verify/verify-flow";

/**
 * SHOP-1 "Get the Verified shop badge" on the web (docs/SHOPS.md,
 * docs/VERIFICATION.md): exactly the person's VerifyFlow (the owner's
 * e-Tazkira front + back, a selfie holding it, name + number) plus ONE extra
 * step, the proof of business (owner, 2026-10-05). testids: shop-verify-*.
 */
export function ShopVerifyFlow({ shopId }: { shopId: number }) {
  return <VerifyFlow shopId={shopId} />;
}
