import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JoinView } from "@/components/shops/team/join-view";
import { isInviteToken } from "@/lib/api/shop-team";

// SHOP-3: a team invite (https://hatiwal.com/join/<token>). Public: a guest
// sees the shop and "Sign up to join". Never indexed (a token is a secret).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shops" });
  return { title: t("team.join.accept"), robots: { index: false, follow: false } };
}

export default async function JoinPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  if (!isInviteToken(token)) notFound();
  return <JoinView token={token} />;
}
