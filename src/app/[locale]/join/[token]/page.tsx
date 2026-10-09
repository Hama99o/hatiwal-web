import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JoinView } from "@/components/shops/team/join-view";
import { isInviteToken } from "@/lib/api/shop-team";
import { smartAppBanner } from "@/lib/app-links";
import { OpenInAppButton } from "@/components/shared/open-in-app-button";

// SHOP-3: a team invite (https://hatiwal.com/join/<token>). Public: a guest
// sees the shop and "Sign up to join". Never indexed (a token is a secret).
export async function generateMetadata({ params }: { params: Promise<{ locale: string; token: string }> }): Promise<Metadata> {
  const { locale, token } = await params;
  const t = await getTranslations({ locale, namespace: "shops" });
  return {
    title: t("team.join.accept"),
    robots: { index: false, follow: false },
    // iPhone: Safari's banner opens the invite in the app (hatiwal://join/<token>).
    ...(isInviteToken(token) && { itunes: smartAppBanner({ kind: "join", id: token }) }),
  };
}

export default async function JoinPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  if (!isInviteToken(token)) notFound();
  return (
    <>
      <div className="mx-auto max-w-md px-4 pt-4 md:hidden">
        <OpenInAppButton route={{ kind: "join", id: token }} />
      </div>
      <JoinView token={token} />
    </>
  );
}
