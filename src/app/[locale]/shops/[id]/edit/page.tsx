import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RequireAuth } from "@/components/auth/require-auth";
import { OwnerOnly } from "@/components/shops/team/owner-only";
import { ShopForm } from "@/components/shops/shop-form";

// SHOP-1: "Edit shop" (owner). Signed in only, not indexed.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shops" });
  return { title: t("edit"), robots: { index: false, follow: false } };
}

export default async function EditShopPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return (
    <RequireAuth>
      <OwnerOnly shopId={Number(id)}>
        <ShopForm shopId={Number(id)} />
      </OwnerOnly>
    </RequireAuth>
  );
}
