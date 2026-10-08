import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RequireAuth } from "@/components/auth/require-auth";
import { OwnerOnly } from "@/components/shops/team/owner-only";
import { ShopVerifyFlow } from "@/components/shops/shop-verify-flow";
import { VerificationGate } from "@/components/verify/verification-gate";
import { EmailConfirmGate } from "@/components/account/email-confirm-gate";

// SHOP-1: apply for "Verified shop". Signed in (the owner or a manager) only, not indexed.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "verify" });
  return { title: t("shop.cardTitle"), robots: { index: false, follow: false } };
}

export default async function ShopVerifyPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return (
    <RequireAuth>
      {/* Staff have no access at all: straight back to the shop (owner, 2026-10-08). */}
      <OwnerOnly shopId={Number(id)} action="applyVerified" redirect>
        <EmailConfirmGate reason="verify">
        {/* A pending or granted badge shows its status, no form (owner, 2026-10-08). */}
        <VerificationGate shopId={Number(id)}>
          <ShopVerifyFlow shopId={Number(id)} />
        </VerificationGate>
      </EmailConfirmGate>
      </OwnerOnly>
    </RequireAuth>
  );
}
