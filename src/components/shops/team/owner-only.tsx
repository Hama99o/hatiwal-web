"use client";

import { useTranslations } from "next-intl";
import { ShieldX } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { EmptyState } from "@/components/shared/empty-state";
import { shopCan, type ShopAction } from "@/lib/shop-permissions";

/**
 * SHOP-3: a page only some roles may use (the Owner / Manager / Staff matrix,
 * api 76ca115): editing the shop is owner + manager, applying for its badge
 * is the owner's own ID. A member without the right who opens the page by URL
 * is told so up front, instead of filling the whole form for a 403.
 * Non-members fall through to the page's own handling.
 */
export function OwnerOnly({ shopId, action, children }: { shopId: number; action: ShopAction; children: React.ReactNode }) {
  const t = useTranslations("shops");
  const { user } = useAuth();
  const membership = user?.shops?.find((s) => s.id === shopId);
  if (membership && !shopCan(membership.role, action)) {
    return (
      <div className="mx-auto max-w-md px-4 py-16" data-testid="owner-only">
        <EmptyState icon={ShieldX} title={t("team.errors.forbidden")} action={{ label: t("team.join.openShop"), href: `/shops/${shopId}` }} />
      </div>
    );
  }
  return <>{children}</>;
}
