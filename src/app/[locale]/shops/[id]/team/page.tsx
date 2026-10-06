import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RequireAuth } from "@/components/auth/require-auth";
import { TeamView } from "@/components/shops/team/team-view";

// SHOP-3: the shop's team. Signed-in members only, not indexed.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shops" });
  return { title: t("team.title"), robots: { index: false, follow: false } };
}

export default async function ShopTeamPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return (
    <RequireAuth>
      <TeamView shopId={Number(id)} />
    </RequireAuth>
  );
}
