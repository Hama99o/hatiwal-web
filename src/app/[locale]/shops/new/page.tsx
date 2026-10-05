import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RequireAuth } from "@/components/auth/require-auth";
import { ShopForm } from "@/components/shops/shop-form";

// SHOP-1: "Open your shop". Signed in only, not indexed.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shops" });
  return { title: t("open"), robots: { index: false, follow: false } };
}

export default async function NewShopPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <RequireAuth>
      <ShopForm />
    </RequireAuth>
  );
}
