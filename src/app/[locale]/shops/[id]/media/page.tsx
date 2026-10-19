import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RequireAuth } from "@/components/auth/require-auth";
import { OwnerOnly } from "@/components/shops/team/owner-only";
import { ShopMediaForm } from "@/components/shops/shop-media-form";

// SHOP-MEDIA: the shop's "Photos & video" (owner, managers). Signed in only, not indexed.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shops.media" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function ShopMediaPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return (
    <RequireAuth>
      <OwnerOnly shopId={Number(id)} action="editShop">
        <ShopMediaForm shopId={Number(id)} />
      </OwnerOnly>
    </RequireAuth>
  );
}
