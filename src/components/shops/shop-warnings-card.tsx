"use client";

import { useQuery } from "@tanstack/react-query";
import { WarningsCard } from "@/components/account/warnings-banner";
import { getMyShop, shopWarnings } from "@/lib/api/shops";

/**
 * The shop's own warnings, for its members (owner + team) only. The shop page
 * is server-rendered from an ANONYMOUS fetch — the public view, which never
 * carries the warning keys — so this island asks the API again as the signed-in
 * member (same ["shop", id] cache as the team and edit pages). Never mounted
 * for a buyer, and renders nothing on an API without the keys.
 */
export function ShopWarningsCard({ shopId }: { shopId: number }) {
  const { data } = useQuery({ queryKey: ["shop", shopId], queryFn: () => getMyShop(shopId) });
  const card = shopWarnings(data);
  if (!card) return null;
  return <WarningsCard scope="shop" {...card} />;
}
