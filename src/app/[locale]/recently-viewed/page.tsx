import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RequireAuth } from "@/components/auth/require-auth";
import { RecentlyViewedList } from "@/components/account/recently-viewed-list";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "recentlyViewed" });
  return { title: t("title") };
}

export default async function RecentlyViewedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <RequireAuth>
      <RecentlyViewedList />
    </RequireAuth>
  );
}
