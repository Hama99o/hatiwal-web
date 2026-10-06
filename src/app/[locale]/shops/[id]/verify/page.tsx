import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RequireAuth } from "@/components/auth/require-auth";
import { OwnerOnly } from "@/components/shops/team/owner-only";
import { ShopVerifyFlow } from "@/components/shops/shop-verify-flow";
import { EmailConfirmGate } from "@/components/account/email-confirm-gate";

// SHOP-1: apply for "Verified shop". Signed in (shop owner) only, not indexed.
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
      <OwnerOnly shopId={Number(id)} action="applyVerified">
        <EmailConfirmGate reason="verify">
        <ShopVerifyFlow shopId={Number(id)} />
      </EmailConfirmGate>
      </OwnerOnly>
    </RequireAuth>
  );
}
