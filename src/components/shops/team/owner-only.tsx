"use client";

import { useTranslations } from "next-intl";
import { ShieldX } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { EmptyState } from "@/components/shared/empty-state";

/**
 * SHOP-3: editing a shop and applying for its badge are the OWNER's. A staff
 * member who opens /shops/<id>/edit or /verify by URL is told so up front,
 * instead of filling the whole form for a 403. Non-members fall through to the
 * page's own handling (the API answers them as before).
 */
export function OwnerOnly({ shopId, children }: { shopId: number; children: React.ReactNode }) {
  const t = useTranslations("shops");
  const { user } = useAuth();
  const membership = user?.shops?.find((s) => s.id === shopId);
  if (membership && membership.role !== "owner") {
    return (
      <div className="mx-auto max-w-md px-4 py-16" data-testid="owner-only">
        <EmptyState icon={ShieldX} title={t("team.errors.forbidden")} action={{ label: t("team.join.openShop"), href: `/shops/${shopId}` }} />
      </div>
    );
  }
  return <>{children}</>;
}
